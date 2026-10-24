/*
 * Listeners plugin for OpenWebRX+
 * Share and display live listener tuning through Supabase Realtime Presence.
 *
 * Copyright (c) 2026 Stanislav Lechev [0xAF], LZ2SLL
 * Licensed under MIT
 */

Plugins.listeners = Plugins.listeners || {};
Plugins.listeners._version = 0.1;

Plugins.listeners.defaults = {
	supabaseUrl: '',
	supabaseKey: '',
	network: '',
	receiverId: '',
	receiverName: '',
	receiverUrl: '',
	open: false,
	sdkUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
};

Plugins.listeners.config = Plugins.utils && Plugins.utils.deepMerge
	? Plugins.utils.deepMerge({}, Plugins.listeners.defaults)
	: {};

Plugins.listeners.state = {
	initialized: false,
	client: null,
	channel: null,
	connected: false,
	generation: 0,
	sessionId: null,
	presences: [],
	lastPayload: '',
	lastTrackAt: 0,
	candidatePayload: '',
	candidateSince: 0,
	tuningSignature: '',
	tunedSince: null,
	country: '',
	city: '',
	pendingTune: null,
	publishTimer: null,
	reconnectTimer: null,
	reconnectAttempts: 0,
	pollTimer: null,
	renderTimer: null,
	statusKind: 'idle',
	statusText: 'Sin configurar'
};

Plugins.listeners._shortText = function (value, maxLength) {
	if (value === undefined || value === null) return '';
	return String(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
};

Plugins.listeners._number = function (value) {
	if (value === undefined || value === null || value === '') return null;
	var number = Number(value);
	return Number.isFinite(number) ? number : null;
};

// EA7CL: mostrar tambien la localidad aproximada del oyente (segun su IP;
// a veces sale la ciudad del proveedor de internet). false = solo bandera.
Plugins.listeners.MOSTRAR_LOCALIDAD = true;

// EA7CL: milisegundos que la frecuencia debe estar quieta antes de publicarla
Plugins.listeners.ESPERA_ESTABLE_MS = 1500;

// EA7CL: cada modo con su color, igual que en el DX cluster
// (CW amarillo, USB rosa, LSB verde lima, FT8 cian, FT4 azul, digitales violeta,
// NFM rojo, WFM ocre, AM naranja)
Plugins.listeners._claseModo = function (id) {
	id = String(id || '').toLowerCase();
	if (id === 'cw') return 'ea7-m-cw';
	if (id === 'usb' || id === 'usbd') return 'ea7-m-usb';
	if (id === 'lsb' || id === 'lsbd') return 'ea7-m-lsb';
	if (id === 'ft8') return 'ea7-m-ft8';
	if (id === 'ft4') return 'ea7-m-ft4';
	if (id === 'nfm' || id === 'fm') return 'ea7-m-fm';
	if (id === 'wfm') return 'ea7-m-wfm';
	if (id === 'am' || id === 'sam') return 'ea7-m-am';
	if (id) return 'ea7-m-digi';
	return '';
};
Plugins.listeners.CSS_MODOS =
	'.owrx-listeners .owrx-listeners__mode.ea7-m-cw{color:#ffd500 !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-usb{color:#ff7ad9 !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-lsb{color:#a6ff4d !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-ft8{color:#00e0ff !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-ft4{color:#5a8cff !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-digi{color:#c58cff !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-fm{color:#ff6b6b !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-wfm{color:#d4a373 !important;font-weight:bold}' +
	'.owrx-listeners .owrx-listeners__mode.ea7-m-am{color:#ffa040 !important;font-weight:bold}';

// EA7CL: pais del oyente (solo el codigo de 2 letras, nunca la IP).
Plugins.listeners._countryCode = function (value) {
	var code = String(value || '').trim().toUpperCase();
	return /^[A-Z]{2}$/.test(code) ? code : '';
};

Plugins.listeners._fetchCountry = function () {
	var self = this;
	var done = function (code, city) {
		code = self._countryCode(code);
		if (code) self.state.country = code;
		if (code && city && self.MOSTRAR_LOCALIDAD) self.state.city = self._shortText(city, 40).trim();
		return code;
	};
	// 1) geojs (pais + localidad)  2) ipwho.is (pais + localidad)
	// 3) country.is y Cloudflare (solo pais)
	return fetch('https://get.geojs.io/v1/ip/geo.json', {cache: 'no-store'}).then(function (response) {
		return response.json();
	}).then(function (data) {
		if (!done(data && data.country_code, data && data.city)) throw new Error('no country');
	}).catch(function () {
		return fetch('https://ipwho.is/?fields=city,country_code,success', {cache: 'no-store'}).then(function (response) {
			return response.json();
		}).then(function (data) {
			if (!done(data && data.country_code, data && data.city)) throw new Error('no country');
		});
	}).catch(function () {
		return fetch('https://api.country.is/', {cache: 'no-store'}).then(function (response) {
			return response.json();
		}).then(function (data) {
			if (!done(data && data.country)) throw new Error('no country');
		});
	}).catch(function () {
		return fetch('https://www.cloudflare.com/cdn-cgi/trace', {cache: 'no-store'}).then(function (response) {
			return response.text();
		}).then(function (text) {
			var match = /^loc=([A-Za-z]{2})$/m.exec(text);
			done(match ? match[1] : '');
		});
	}).catch(function () { /* sin pais: el oyente aparece igualmente */ });
};

Plugins.listeners._countryName = function (code) {
	try {
		if (!this._countryNames) this._countryNames = new Intl.DisplayNames([navigator.language || 'es'], {type: 'region'});
		return this._countryNames.of(code) || code;
	} catch (error) {
		return code;
	}
};

Plugins.listeners._sessionId = function () {
	var bytes = new Uint8Array(12);
	if (window.crypto && window.crypto.getRandomValues) {
		window.crypto.getRandomValues(bytes);
	} else {
		for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	return Array.prototype.map.call(bytes, function (value) {
		return ('0' + value.toString(16)).slice(-2);
	}).join('');
};

Plugins.listeners._receiverId = function () {
	return this._shortText(this.config.receiverId || window.location.host, 100);
};

Plugins.listeners._receiverName = function () {
	var title = $('.webrx-rx-title').first().text().trim();
	return this._shortText(this.config.receiverName || title || window.location.host, 100);
};

Plugins.listeners._receiverUrl = function () {
	return this._shortText(this.config.receiverUrl || (window.location.origin + window.location.pathname), 500);
};

Plugins.listeners._topic = function () {
	var scope = String(this.config.network || this._receiverId());
	var slug = String(scope).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
	var hash = 2166136261;
	for (var i = 0; i < scope.length; i++) {
		hash ^= scope.charCodeAt(i);
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}
	return 'owrx-listeners-' + (slug || 'network').slice(0, 80) + '-' + (hash >>> 0).toString(16);
};

Plugins.listeners._normalizeSupabaseUrl = function (value) {
	var raw = String(value || '').trim();
	if (!raw) return '';
	try {
		var url = new URL(raw);
		var path = url.pathname.replace(/\/+$/, '');
		var match = path.match(/^(.*)\/(?:rest|auth|realtime|storage)\/v1$/);
		if (match) {
			url.pathname = match[1] || '/';
			url.search = '';
			url.hash = '';
		}
		return url.href.replace(/\/+$/, '');
	} catch (error) {
		return raw.replace(/\/+$/, '');
	}
};

Plugins.listeners._panel = function () {
	if (window.UI && typeof UI.getDemodulatorPanel === 'function') return UI.getDemodulatorPanel();
	return $('#openwebrx-panel-receiver').demodulatorPanel();
};

Plugins.listeners._nativeFrequency = function () {
	var container = document.querySelector('.webrx-actual-freq');
	var display = container ? $(container).data('frequencyDisplay') : null;
	if (display && Number.isFinite(display.frequency)) return Math.round(display.frequency);

	var panel = this._panel();
	var demodulator = panel && panel.getDemodulator ? panel.getDemodulator() : null;
	if (!demodulator || typeof center_freq === 'undefined') return null;
	var frequency = Number(center_freq) + Number(demodulator.get_offset_frequency());
	if (demodulator.get_modulation() === 'cw' && window.UI && UI.getCwOffset) {
		frequency += UI.getCwOffset();
	}
	return Number.isFinite(frequency) ? Math.round(frequency) : null;
};

Plugins.listeners._profile = function () {
	var select = document.getElementById('openwebrx-sdr-profiles-listbox');
	var selected = select && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
	var profile = window.currentprofile || {};
	return {
		profile_key: this._shortText(select ? select.value : '', 160),
		profile_name: this._shortText(selected ? selected.text : '', 100),
		sdr_id: this._shortText(profile.sdr_id, 80),
		profile_id: this._shortText(profile.profile_id, 80)
	};
};

Plugins.listeners._capture = function () {
	var panel = this._panel();
	var demodulator = panel && panel.getDemodulator ? panel.getDemodulator() : null;
	if (!panel || !demodulator) return null;

	var profile = this._profile();
	var mode = panel.mode || null;
	var bandpass = demodulator.getBandpass ? demodulator.getBandpass() : {};
	var frequency = this._nativeFrequency();
	var modeId = mode && mode.modulation ? mode.modulation : (demodulator.get_secondary_demod() || demodulator.get_modulation());
	var underlyingId = demodulator.get_modulation ? demodulator.get_modulation() : '';
	var signature = [profile.profile_key, frequency, modeId, underlyingId].join('|');

	if (signature !== this.state.tuningSignature) {
		this.state.tuningSignature = signature;
		this.state.tunedSince = new Date().toISOString();
	}

	return {
		protocol_version: 1,
		plugin_version: this._version,
		receiver_id: this._receiverId(),
		receiver_name: this._receiverName(),
		receiver_url: this._receiverUrl(),
		sdr_id: profile.sdr_id,
		profile_id: profile.profile_id,
		profile_key: profile.profile_key,
		profile_name: profile.profile_name || profile.profile_id || profile.profile_key,
		frequency: frequency,
		mode_id: this._shortText(modeId, 40),
		mode: this._shortText(mode && mode.name ? mode.name : String(modeId).toUpperCase(), 40),
		underlying_mode_id: this._shortText(underlyingId, 40),
		underlying_mode: this._shortText(String(underlyingId).toUpperCase(), 40),
		filter_low: this._number(bandpass.low_cut),
		filter_high: this._number(bandpass.high_cut),
		tuned_since: this.state.tunedSince,
		country: this.state.country,
		city: this.state.city
	};
};

Plugins.listeners._publish = function () {
	if (!this.state.connected || !this.state.channel) return;
	var self = this;
	var payload = this._capture();
	if (!payload || payload.frequency === null || !payload.profile_key) return;
	var serialized = JSON.stringify(payload);
	if (serialized === this.state.lastPayload) return;

	// EA7CL: no publicar las frecuencias de paso (arrastrar, rueda, teclear):
	// esperar a que la sintonia lleve ESPERA_ESTABLE_MS sin cambiar. Si no, se
	// publicaba la primera frecuencia intermedia y la buena tardaba hasta 6,5 s.
	if (serialized !== this.state.candidatePayload) {
		this.state.candidatePayload = serialized;
		this.state.candidateSince = Date.now();
		return;
	}
	if (Date.now() - this.state.candidateSince < this.ESPERA_ESTABLE_MS) return;

	// Supabase Presence is rate-limited. Coalesce rapid tuning changes and
	// publish the most recent receiver state when the interval expires.
	var wait = 6500 - (Date.now() - this.state.lastTrackAt);
	if (wait > 0) {
		if (!this.state.publishTimer) {
			this.state.publishTimer = setTimeout(function () {
				self.state.publishTimer = null;
				self._publish();
			}, wait);
		}
		return;
	}

	this.state.lastPayload = serialized;
	this.state.lastTrackAt = Date.now();
	this.state.channel.track(payload).then(function (result) {
		if (result !== 'ok') {
			self.state.lastPayload = '';
			console.warn('Listeners: presence track returned', result);
		}
	}).catch(function (error) {
		self.state.lastPayload = '';
		console.warn('Listeners: unable to publish presence', error);
	});
};

Plugins.listeners._validPresence = function (presence) {
	if (!presence || Number(presence.protocol_version) !== 1) return null;
	var frequency = this._number(presence.frequency);
	if (frequency === null || frequency <= 0 || frequency > 1e12) return null;
	var tunedSince = Date.parse(presence.tuned_since);
	return {
		receiver_id: this._shortText(presence.receiver_id, 100) || 'unknown',
		receiver_name: this._shortText(presence.receiver_name, 100) || 'Receptor',
		receiver_url: this._safeUrl(presence.receiver_url),
		sdr_id: this._shortText(presence.sdr_id, 80),
		profile_id: this._shortText(presence.profile_id, 80),
		profile_key: this._shortText(presence.profile_key, 160),
		profile_name: this._shortText(presence.profile_name, 100) || 'Perfil',
		frequency: Math.round(frequency),
		mode_id: this._shortText(presence.mode_id, 40),
		mode: this._shortText(presence.mode, 40) || '—',
		underlying_mode_id: this._shortText(presence.underlying_mode_id, 40),
		underlying_mode: this._shortText(presence.underlying_mode, 40),
		filter_low: this._number(presence.filter_low),
		filter_high: this._number(presence.filter_high),
		tuned_since: Number.isFinite(tunedSince) ? new Date(tunedSince).toISOString() : null,
		country: this._countryCode(presence.country),
		city: this._shortText(presence.city, 40)
	};
};

Plugins.listeners._safeUrl = function (value) {
	try {
		var url = new URL(String(value || ''), window.location.href);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
	} catch (error) {
		return '';
	}
};

Plugins.listeners._syncPresence = function () {
	if (!this.state.channel) return;
	var raw = this.state.channel.presenceState();
	var presences = [];
	var self = this;
	Object.keys(raw).forEach(function (key) {
		(raw[key] || []).forEach(function (presence) {
			var valid = self._validPresence(presence);
			if (valid) presences.push(valid);
		});
	});
	this.state.presences = presences;
	this._render();
};

Plugins.listeners._setStatus = function (kind, text) {
	this.state.statusKind = kind;
	this.state.statusText = text;
	var status = $('#owrx-listeners-status');
	status.attr('data-status', kind).text(text);
	$('#plugin-button-listeners').attr('data-status', kind);
	this._render();
};

// EA7CL: siempre en MHz con precision de 10 Hz (432.27525 MHz)
Plugins.listeners._formatFrequency = function (frequency) {
	return (Math.round(Number(frequency) / 10) / 1e5).toFixed(5) + ' MHz';
};

Plugins.listeners._formatDuration = function (isoDate) {
	if (!isoDate) return '';
	var seconds = Math.max(0, Math.floor((Date.now() - Date.parse(isoDate)) / 1000));
	if (seconds < 60) return seconds + 's';
	if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
	if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
	return Math.floor(seconds / 86400) + 'd ' + Math.floor((seconds % 86400) / 3600) + 'h';
};

Plugins.listeners._groups = function () {
	var receivers = Object.create(null);
	this.state.presences.forEach(function (presence) {
		var receiver = receivers[presence.receiver_id];
		if (!receiver) {
			receiver = receivers[presence.receiver_id] = {
				id: presence.receiver_id,
				name: presence.receiver_name,
				url: presence.receiver_url,
				count: 0,
				profiles: Object.create(null)
			};
		}
		receiver.count++;
		var profileKey = presence.profile_key || presence.profile_id || presence.profile_name;
		var profile = receiver.profiles[profileKey];
		if (!profile) {
			profile = receiver.profiles[profileKey] = {
				key: presence.profile_key,
				name: presence.profile_name,
				count: 0,
				tunings: Object.create(null)
			};
		}
		profile.count++;
		var tuningKey = [presence.frequency, presence.mode_id, presence.underlying_mode_id,
			presence.filter_low, presence.filter_high].join('|');
		var tuning = profile.tunings[tuningKey];
		if (!tuning) {
			tuning = profile.tunings[tuningKey] = {
				data: presence,
				count: 0,
				countries: Object.create(null),
				places: Object.create(null),
				oldest: presence.tuned_since
			};
		}
		tuning.count++;
		if (presence.country) {
			tuning.countries[presence.country] = (tuning.countries[presence.country] || 0) + 1;
			var placeKey = presence.country + '|' + (presence.city || '');
			tuning.places[placeKey] = (tuning.places[placeKey] || 0) + 1;
		}
		if (presence.tuned_since && (!tuning.oldest || presence.tuned_since < tuning.oldest)) {
			tuning.oldest = presence.tuned_since;
		}
	});
	return receivers;
};

Plugins.listeners._renderReceiver = function (receiver, local) {
	var self = this;
	var section = $('<section class="owrx-listeners__receiver"></section>');
	var heading = $('<div class="owrx-listeners__receiver-heading"></div>');
	var name = $('<span class="owrx-listeners__receiver-name"></span>').text(receiver.name);
	if (!local && receiver.url) {
		name = $('<a class="owrx-listeners__receiver-name" target="_blank" rel="noopener noreferrer"></a>')
			.attr('href', receiver.url).text(receiver.name);
	}
	heading.append(name).append($('<span class="owrx-listeners__badge"></span>').text(receiver.count));
	if (!local) heading.append($('<span class="owrx-listeners__remote"></span>').text('remoto'));
	section.append(heading);

	Object.keys(receiver.profiles).sort(function (a, b) {
		return receiver.profiles[a].name.localeCompare(receiver.profiles[b].name);
	}).forEach(function (profileKey) {
		var profile = receiver.profiles[profileKey];
		var block = $('<div class="owrx-listeners__profile"></div>');
		var profileHeading = $('<div class="owrx-listeners__profile-heading"></div>')
			.append($('<span></span>').text(profile.name))
			.append($('<span class="owrx-listeners__profile-count"></span>').text(profile.count));
		block.append(profileHeading);

		Object.keys(profile.tunings).sort(function (a, b) {
			return profile.tunings[a].data.frequency - profile.tunings[b].data.frequency;
		}).forEach(function (tuningKey) {
			var tuning = profile.tunings[tuningKey];
			var data = tuning.data;
			var row = $('<div class="owrx-listeners__tuning"></div>');
			if (local) {
				row.addClass('owrx-listeners__tuning--local').attr('title', 'Sintonizar aquí').on('click', function () {
					self._tune(data);
				});
			}
			// EA7CL: los dos ultimos digitos (centenas y decenas de Hz) mas
			// pequeños y en otro tono: 432.275|25 MHz
			var freqText = self._formatFrequency(data.frequency);
			var freqParts = /^(\d+\.\d{3})(\d{2})(.*)$/.exec(freqText);
			var freqCell = $('<span class="owrx-listeners__frequency"></span>');
			if (freqParts) {
				freqCell.append(document.createTextNode(freqParts[1]))
					.append($('<span class="owrx-listeners__decimals"></span>').text(freqParts[2]))
					.append(document.createTextNode(freqParts[3]));
			} else {
				freqCell.text(freqText);
			}
			row.append(freqCell);
			var modeLabel = data.mode;
			if (data.underlying_mode && data.underlying_mode_id !== data.mode_id) modeLabel += ' · ' + data.underlying_mode;
			row.append($('<span class="owrx-listeners__mode"></span>').addClass(self._claseModo(data.mode_id)).text(modeLabel));
			// EA7CL: banderas de los paises de los oyentes, en la misma linea
			var flags = $('<span class="owrx-listeners__countries"></span>');
			Object.keys(tuning.places).sort().forEach(function (placeKey) {
				var n = tuning.places[placeKey];
				var code = placeKey.split('|')[0];
				var city = placeKey.slice(code.length + 1);
				var name = self._countryName(code);
				var item = $('<span class="owrx-listeners__country"></span>')
					.attr('title', (city ? city + ', ' : '') + name + (n > 1 ? ' \u00d7' + n : ''));
				var img = $('<img class="owrx-listeners__flag" width="15" height="11" loading="lazy">')
					.attr('src', 'https://flagcdn.com/' + code.toLowerCase() + '.svg')
					.attr('alt', code)
					.attr('style', 'width:15px !important;height:11px !important;min-width:0 !important;max-width:15px !important;max-height:11px !important;flex:0 0 15px;object-fit:cover;margin:0;padding:0;')
					.on('error', function () { $(this).replaceWith($('<span></span>').text(code)); });
				item.append(img);
				if (city && self.MOSTRAR_LOCALIDAD) item.append($('<span class="owrx-listeners__city"></span>').text(city));
				if (n > 1) item.append($('<span class="owrx-listeners__country-count"></span>').text('\u00d7' + n));
				flags.append(item);
			});
			// EA7CL: oyentes sin pais conocido, para que la suma cuadre con el total de la fila
			var known = Object.keys(tuning.countries).reduce(function (sum, code) { return sum + tuning.countries[code]; }, 0);
			var unknown = tuning.count - known;
			if (unknown > 0) {
				var missing = $('<span class="owrx-listeners__country"></span>')
					.attr('title', 'Pa\u00eds desconocido' + (unknown > 1 ? ' \u00d7' + unknown : ''));
				missing.append($('<span class="owrx-listeners__noflag"></span>').text('?'));
				if (unknown > 1) missing.append($('<span class="owrx-listeners__country-count"></span>').text('\u00d7' + unknown));
				flags.append(missing);
			}
			row.append(flags);
			row.append($('<span class="owrx-listeners__duration"></span>').text(self._formatDuration(tuning.oldest)));
			row.append($('<span class="owrx-listeners__count"></span>').text(tuning.count));
			block.append(row);
		});
		section.append(block);
	});
	return section;
};

Plugins.listeners._render = function () {
	var content = $('#owrx-listeners-content');
	if (!content.length) return;
	content.empty();
	var receivers = this._groups();
	var ids = Object.keys(receivers);
	var localId = this._receiverId();
	var total = this.state.presences.length;
	$('#owrx-listeners-total').text(total + (total === 1 ? ' oyente' : ' oyentes'));
	$('#plugin-button-listeners')
		.attr('data-count', total)
		.attr('title', 'Oyentes: ' + total)
		.attr('aria-label', 'Oyentes: ' + total);
	if (!ids.length) {
		var emptyText = 'Conectando…';
		if (this.state.connected) emptyText = 'No hay oyentes activos.';
		else if (this.state.statusKind === 'idle') emptyText = 'El plugin no está configurado.';
		else if (this.state.statusKind === 'error') emptyText = this.state.statusText + '. Revisa la consola del navegador.';
		content.append($('<div class="owrx-listeners__empty"></div>').text(emptyText));
		return;
	}
	var self = this;
	ids.sort(function (a, b) {
		if (a === localId) return -1;
		if (b === localId) return 1;
		return receivers[a].name.localeCompare(receivers[b].name);
	}).forEach(function (id) {
		content.append(self._renderReceiver(receivers[id], id === localId));
	});
};

Plugins.listeners._setFrequency = function (frequency) {
	var container = document.querySelector('.webrx-actual-freq');
	if (container) $(container).trigger('frequencychange', [frequency]);
};

Plugins.listeners._applyTune = function (data) {
	var panel = this._panel();
	if (!panel) return;
	if (data.mode_id && panel.setMode) panel.setMode(data.mode_id, data.underlying_mode_id || undefined);
	var demodulator = panel.getDemodulator ? panel.getDemodulator() : null;
	if (demodulator && demodulator.setBandpass && data.filter_low !== null && data.filter_high !== null) {
		demodulator.setBandpass({low_cut: data.filter_low, high_cut: data.filter_high});
	}
	this._setFrequency(data.frequency);
	this.state.pendingTune = null;
};

Plugins.listeners._tune = function (data) {
	var select = document.getElementById('openwebrx-sdr-profiles-listbox');
	if (!select || !data.profile_key) return;
	if (select.value === data.profile_key) {
		this._applyTune(data);
		return;
	}
	var exists = Array.prototype.some.call(select.options, function (option) {
		return option.value === data.profile_key;
	});
	if (!exists || typeof window.sdr_profile_changed !== 'function') return;
	this.state.pendingTune = data;
	select.value = data.profile_key;
	window.sdr_profile_changed();
};

Plugins.listeners._profileChanged = function () {
	var self = this;
	setTimeout(function () {
		var pending = self.state.pendingTune;
		var select = document.getElementById('openwebrx-sdr-profiles-listbox');
		if (pending && select && select.value === pending.profile_key) self._applyTune(pending);
		self._publish();
	}, 250);
};

Plugins.listeners._disconnect = function () {
	this.state.generation++;
	this.state.connected = false;
	this.state.lastPayload = '';
	this.state.lastTrackAt = 0;
	this.state.presences = [];
	if (this.state.publishTimer) clearTimeout(this.state.publishTimer);
	if (this.state.reconnectTimer) clearTimeout(this.state.reconnectTimer);
	this.state.publishTimer = null;
	this.state.reconnectTimer = null;
	var client = this.state.client;
	var channel = this.state.channel;
	this.state.channel = null;
	this.state.client = null;
	if (channel) {
		try { channel.untrack(); } catch (error) { /* socket cleanup is best effort */ }
		if (client && client.removeChannel) client.removeChannel(channel);
	}
	this._render();
};

Plugins.listeners._scheduleReconnect = function (generation) {
	if (generation !== this.state.generation || this.state.reconnectTimer) return;
	var self = this;
	var delay = Math.min(1000 * Math.pow(2, this.state.reconnectAttempts), 30000);
	this.state.reconnectAttempts++;
	this.state.connected = false;
	this.state.presences = [];
	this._setStatus('connecting', 'Reconectando en ' + Math.ceil(delay / 1000) + ' s');
	this.state.reconnectTimer = setTimeout(function () {
		self.state.reconnectTimer = null;
		if (generation === self.state.generation) self._connect(true);
	}, delay);
};

Plugins.listeners._loadSdk = function () {
	if (window.supabase && window.supabase.createClient) return Promise.resolve();
	return Plugins._load_script(this.config.sdkUrl).then(function () {
		if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase SDK did not load');
	});
};

Plugins.listeners._connect = function (retry) {
	var self = this;
	if (!retry) this.state.reconnectAttempts = 0;
	this._disconnect();
	if (!this.config.supabaseUrl || !this.config.supabaseKey) {
		this._setStatus('idle', 'Sin configurar');
		return Promise.resolve(false);
	}

	var generation = this.state.generation;
	this._setStatus('connecting', 'Conectando');
	return this._loadSdk().then(function () {
		if (generation !== self.state.generation) return false;
		var projectUrl = self._normalizeSupabaseUrl(self.config.supabaseUrl);
		var client = window.supabase.createClient(projectUrl, self.config.supabaseKey, {
			auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
		});
		var channel = client.channel(self._topic(), {
			config: {presence: {key: self.state.sessionId}}
		});
		self.state.client = client;
		self.state.channel = channel;
		channel.on('presence', {event: 'sync'}, function () { self._syncPresence(); });
		channel.subscribe(function (status, error) {
			if (generation !== self.state.generation) return;
			if (status === 'SUBSCRIBED') {
				if (self.state.reconnectTimer) clearTimeout(self.state.reconnectTimer);
				self.state.reconnectTimer = null;
				self.state.reconnectAttempts = 0;
				self.state.connected = true;
				self._setStatus('live', 'En directo');
				self._publish();
			} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
				self.state.connected = false;
				if (error) console.error('Listeners: Realtime subscription failed', error);
				self._scheduleReconnect(generation);
			} else if (status === 'CLOSED') {
				self.state.connected = false;
				self._scheduleReconnect(generation);
			}
		});
		return true;
	}).catch(function (error) {
		if (generation === self.state.generation) {
			self._setStatus('error', 'Error de conexión');
			console.error('Listeners:', error);
			self._scheduleReconnect(generation);
		}
		return false;
	});
};

Plugins.listeners.setup = function (options) {
	this.config = Plugins.utils.deepMerge({}, this.defaults, options || {});
	this.config.supabaseUrl = this._normalizeSupabaseUrl(this.config.supabaseUrl);
	if (!this.state.initialized) return Promise.resolve(true);
	if (options && Object.prototype.hasOwnProperty.call(options, 'open')) {
		Plugins.toggleWindow('listeners', !!options.open);
	}
	return this._connect(false);
};

Plugins.listeners.init = async function () {
	if (!Plugins.isLoaded('utils', 0.9)) {
		console.warn('Listeners plugin requires utils plugin v0.9 or higher.');
		return false;
	}
	if (typeof Plugins.addButton !== 'function' || typeof Plugins.addWindow !== 'function') {
		console.warn('Listeners plugin requires an OpenWebRX+ version with native plugin windows.');
		return false;
	}
	if (this.state.initialized) return true;
	await new Promise(function (resolve) { Plugins.utils.on_ready(resolve); });

	this.state.initialized = true;
	this.state.sessionId = this._sessionId();
	this._fetchCountry();
	// EA7CL: estilos de las banderas incluidos aqui para no depender de la cache del CSS
	if (!document.getElementById('owrx-listeners-ea7cl-style5')) {
		$('<style id="owrx-listeners-ea7cl-style5"></style>').text('.owrx-listeners .owrx-listeners__tuning{grid-template-columns:minmax(98px,auto) minmax(50px,auto) minmax(0,1fr) 46px 30px}.owrx-listeners .owrx-listeners__countries{grid-column:auto;display:flex;align-items:center;gap:4px;overflow:hidden;white-space:nowrap;font-size:inherit;color:inherit}.owrx-listeners .owrx-listeners__country{display:inline-flex;align-items:center;gap:3px;color:#9da8b0;font-size:.85em;min-width:0;white-space:nowrap}.owrx-listeners .owrx-listeners__city{overflow:hidden;text-overflow:ellipsis;max-width:110px;color:#e3e8ec}.owrx-listeners .owrx-listeners__countries{min-width:0}.owrx-listeners .owrx-listeners__flag{display:block;width:15px;height:11px;border-radius:1px;box-shadow:0 0 0 1px rgba(255,255,255,.15)}#plugin-window-listeners{height:600px;width:430px;min-width:min(400px,96vw) !important}.owrx-listeners{line-height:1.2 !important}.owrx-listeners .owrx-listeners__summary{padding:4px 10px !important}.owrx-listeners .owrx-listeners__hint{padding:3px 10px !important}.owrx-listeners .owrx-listeners__content{padding:4px !important}.owrx-listeners .owrx-listeners__receiver{margin-bottom:4px !important}.owrx-listeners .owrx-listeners__receiver-heading{padding:4px 8px !important}.owrx-listeners .owrx-listeners__profile-heading{padding:3px 8px !important}.owrx-listeners .owrx-listeners__tuning{padding:2px 8px 2px 16px !important;min-height:0 !important}.owrx-listeners .owrx-listeners__badge,.owrx-listeners .owrx-listeners__count,.owrx-listeners .owrx-listeners__profile-count{padding:0 5px !important}.owrx-listeners{font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;font-size:13px !important;color:#eef1f4 !important;font-variant-numeric:tabular-nums;text-shadow:none !important}.owrx-listeners .owrx-listeners__summary,.owrx-listeners .owrx-listeners__hint{background:#1b242c !important;color:#eef1f4 !important}.owrx-listeners #owrx-listeners-total{font-weight:bold;color:#ffffff !important}.owrx-listeners .owrx-listeners__hint{color:#b9c3cb !important;font-size:12px !important}.owrx-listeners #owrx-listeners-status[data-status=live]{color:#6ff08f !important;font-weight:bold}.owrx-listeners .owrx-listeners__receiver-name{color:#ffffff !important}.owrx-listeners .owrx-listeners__profile-heading{color:#ffd166 !important}.owrx-listeners .owrx-listeners__frequency{color:#9fd4ff !important;font-weight:600}.owrx-listeners .owrx-listeners__mode{color:#e3e8ec !important}.owrx-listeners .owrx-listeners__duration{color:#c2ccd4 !important}.owrx-listeners .owrx-listeners__country{color:#e3e8ec !important}.owrx-listeners .owrx-listeners__noflag{display:inline-block;box-sizing:border-box;width:15px;height:11px;border-radius:1px;background:#3a454e;color:#e3e8ec;font-size:9px;line-height:11px;font-weight:bold;text-align:center;box-shadow:0 0 0 1px rgba(255,255,255,.15)}@media (max-width:500px){.owrx-listeners .owrx-listeners__tuning{grid-template-columns:minmax(100px,1fr) 65px auto 30px}}').appendTo('head');
		$('<style id="owrx-listeners-ea7cl-modos"></style>').text(Plugins.listeners.CSS_MODOS).appendTo('head');
	}
	var button = Plugins.addButton('listeners', 'LST', function () { Plugins.toggleWindow('listeners'); });
	$(button).attr('data-count', 0).attr('aria-label', 'Oyentes: 0');
	Plugins.addWindow('listeners', 'Oyentes',
		'<div class="owrx-listeners">' +
			'<div class="owrx-listeners__summary">' +
				'<span id="owrx-listeners-total">0 oyentes</span>' +
				'<span id="owrx-listeners-status" data-status="idle">Sin configurar</span>' +
			'</div>' +
			'<div id="owrx-listeners-content" class="owrx-listeners__content"></div>' +
			'<div class="owrx-listeners__hint">Pulsa una fila para sintonizar esa frecuencia.</div>' +
		'</div>');

	var self = this;
	// EA7CL: ventana con ancho minimo para las localidades y siempre dentro
	// de la pantalla (OpenWebRX+ la coloca por su centro y recuerda el ancho
	// antiguo; al ensancharla podia quedar medio fuera por la izquierda)
	setInterval(function () {
		var w = document.getElementById('plugin-window-listeners');
		if (!w || w.offsetParent === null) return;
		var minW = Math.min(400, Math.round(window.innerWidth * 0.96));
		if (parseFloat(w.style.width) < minW) w.style.width = minW + 'px';
		var r = w.getBoundingClientRect();
		var left = parseFloat(w.style.left);
		if (!isFinite(left)) return;
		if (r.left < 4) w.style.left = (left + (4 - r.left)) + 'px';
		else if (r.right > window.innerWidth - 4) w.style.left = (left - (r.right - window.innerWidth + 4)) + 'px';
	}, 1000);
	this.state.pollTimer = setInterval(function () { self._publish(); }, 1000);
	this.state.renderTimer = setInterval(function () { self._render(); }, 30000);
	$(document).on('server:config:after.listeners event:profile_changed.listeners', function () {
		self._profileChanged();
	});
	window.addEventListener('beforeunload', function () { self._disconnect(); });
	if (this.config.open) Plugins.toggleWindow('listeners', true);
	this._render();
	if (this.config.supabaseUrl && this.config.supabaseKey) this._connect(false);
	return true;
};
