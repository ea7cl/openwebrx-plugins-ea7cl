/*
 * profile_jump - plugin local de EA7CL para OpenWebRX+
 *
 * Cuando rig_skin (DX cluster, balizas, satelites, etc.) intenta sintonizar
 * una frecuencia que queda fuera del perfil actual, busca en profiles.json
 * un perfil del receptor que la contenga, cambia a ese perfil y sintoniza.
 * Si no hay ningun perfil que la cubra, deja actuar a rig_skin como siempre.
 *
 * profiles.json se genera en el servidor con gen_profiles.py.
 * No modifica rig_skin: solo envuelve su funcion tuneTo, asi que las
 * actualizaciones de rig_skin no borran este plugin.
 */
Plugins.profile_jump = Plugins.profile_jump || {};
Plugins.profile_jump._version = 0.4;
Plugins.profile_jump.no_css = true;
Plugins.profile_jump.profiles = [];
Plugins.profile_jump.busy = null;

Plugins.profile_jump._select = function () {
	return document.getElementById('openwebrx-sdr-profiles-listbox');
};

// Perfil que mejor contiene la frecuencia f (la mas centrada), entre los
// que el visitante tiene disponibles en el desplegable.
Plugins.profile_jump.find = function (f) {
	var select = this._select();
	if (!select) return null;
	var available = {};
	Array.prototype.forEach.call(select.options, function (option) { available[option.value] = true; });
	var best = null, bestScore = Infinity;
	this.profiles.forEach(function (p) {
		if (!available[p.key]) return;
		var half = p.samp_rate / 2;
		var margin = Math.min(10000, half * 0.05);
		var distance = Math.abs(f - p.center_freq);
		if (distance >= half - margin) return;
		var score = distance / half;
		if (p.key === select.value) score -= 2; // el perfil actual gana si la cubre
		if (p.last) score += 10; // receptor de ultimo recurso: solo si no hay otro
		if (score < bestScore) { bestScore = score; best = p; }
	});
	return best;
};

Plugins.profile_jump._inWindow = function (f) {
	return typeof center_freq !== 'undefined' && typeof bandwidth !== 'undefined' &&
		Math.abs(f - center_freq) < bandwidth / 2;
};

Plugins.profile_jump._flash = function (text) {
	try {
		if (Plugins.rig_skin && typeof Plugins.rig_skin.flash === 'function') Plugins.rig_skin.flash(text);
	} catch (error) { /* aviso opcional */ }
};

Plugins.profile_jump._land = function (f, mode) {
	try {
		if (mode) UI.setModulation(mode);
		UI.setFrequency(f, false);
	} catch (error) {
		console.warn('profile_jump: no se pudo sintonizar', error);
	}
};

// Devuelve true si se ha encargado de la sintonia.
Plugins.profile_jump.jump = function (f, mode) {
	var self = this;
	if (!f || typeof UI === 'undefined' || this._inWindow(f)) return false;
	var select = this._select();
	var target = this.find(f);
	if (!select || !target || typeof window.sdr_profile_changed !== 'function') return false;
	if (target.key === select.value) return false;

	if (this.busy) clearInterval(this.busy);
	if (typeof UI.toggleScanner === 'function') UI.toggleScanner(false);
	select.value = target.key;
	window.sdr_profile_changed();

	var tries = 0;
	this.busy = setInterval(function () {
		if (self._inWindow(f) && Math.abs(center_freq - target.center_freq) < target.samp_rate / 2) {
			clearInterval(self.busy);
			self.busy = null;
			// un momento para que el demodulador arranque en el perfil nuevo
			setTimeout(function () { self._land(f, mode); }, 700);
		} else if (++tries > 60) { // 15 segundos
			clearInterval(self.busy);
			self.busy = null;
			self._flash('perfil no disponible');
		}
	}, 250);
	return true;
};

// --- Spots digitales (FT8, FT4, ...) ---------------------------------
// rig_skin trata cualquier spot que no sea CW/FM/SSB como USB, y por eso
// el decodificador FT8 se cerraba nada mas abrirse. Aqui se traduce el
// modo del spot al modo digital de OpenWebRX+ (si el receptor lo tiene).
Plugins.profile_jump.DIGITAL = {
	FT8: 'ft8', FT4: 'ft4', JS8: 'js8', WSPR: 'wspr', FST4: 'fst4', FST4W: 'fst4w',
	JT65: 'jt65', JT9: 'jt9', Q65: 'q65', MSK144: 'msk144', RTTY: 'rtty170'
};

// Frecuencias de dial habituales (Hz). Un spot FT8 suele traer la frecuencia
// exacta de la senal (dial + tono); para decodificar hay que ponerse en el dial.
Plugins.profile_jump.DIALS = {
	ft8: [1840000, 3573000, 5357000, 7074000, 10136000, 14074000, 18100000, 21074000,
		24915000, 28074000, 50313000, 50323000, 70154000, 144174000, 432174000],
	ft4: [3575000, 7047500, 10140000, 14080000, 18104000, 21140000, 24919000,
		28180000, 50318000, 144170000]
};

Plugins.profile_jump._modeAvailable = function (id) {
	try {
		if (typeof Modes === 'undefined' || typeof Modes.findByModulation !== 'function') return true;
		var mode = Modes.findByModulation(id);
		if (!mode) return false;
		return typeof mode.isAvailable !== 'function' || !!mode.isAvailable();
	} catch (error) {
		return true;
	}
};

Plugins.profile_jump.digitalMode = function (spot) {
	var name = String(spot && spot.mode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
	var id = this.DIGITAL[name];
	return id && this._modeAvailable(id) ? id : null;
};

// Lleva la frecuencia de un spot FT8/FT4 a su dial (si cae dentro de sus 3 kHz).
Plugins.profile_jump.snap = function (f, mode) {
	var dials = this.DIALS[mode];
	if (!dials) return f;
	for (var i = 0; i < dials.length; i++) {
		if (f >= dials[i] - 200 && f <= dials[i] + 3200) return dials[i];
	}
	return f;
};

// Envuelve Plugins.rig_skin.tuneTo cuando rig_skin termine de cargar.
Plugins.profile_jump._hook = function () {
	var self = this;
	var tries = 0;
	var timer = setInterval(function () {
		var rig = Plugins.rig_skin;
		if (rig && typeof rig.tuneTo === 'function') {
			clearInterval(timer);
			if (rig.tuneTo._profile_jump) return;
			var original = rig.tuneTo;
			rig.tuneTo = function (f, mode) {
				if (mode && self.DIALS[mode]) f = self.snap(f, mode);
				arguments[0] = f;
				try {
					if (self.profiles.length && self.jump(f, mode)) return;
				} catch (error) {
					console.warn('profile_jump:', error);
				}
				return original.apply(this, arguments);
			};
			rig.tuneTo._profile_jump = true;
			if (typeof rig.spotMode === 'function' && !rig.spotMode._profile_jump) {
				var originalSpotMode = rig.spotMode;
				rig.spotMode = function (spot) {
					try {
						var digital = self.digitalMode(spot);
						if (digital) return digital;
					} catch (error) {
						console.warn('profile_jump:', error);
					}
					return originalSpotMode.apply(this, arguments);
				};
				rig.spotMode._profile_jump = true;
			}
		} else if (++tries > 240) { // 2 minutos esperando a rig_skin
			clearInterval(timer);
		}
	}, 500);
};

Plugins.profile_jump.init = function () {
	var self = this;
	// EA7CL: indicativos del DX cluster de rig_skin mas legibles (letra clara
	// con cero barrado, mas grande y sin resplandor). No modifica rig_skin.
	if (!document.getElementById('ea7cl-rig-dx-style')) {
		var style = document.createElement('style');
		style.id = 'ea7cl-rig-dx-style';
		style.textContent = '#owrx-rig-dx .owrx-rig-dx-list{font-family:Consolas,Cascadia Mono,DejaVu Sans Mono,Menlo,monospace !important;font-size:10pt !important}#owrx-rig-dx .owrx-rig-dx-list td{color:#c5ced6 !important;padding:3px 4px !important}#owrx-rig-dx .owrx-rig-dx-list td.call{color:#ffffff !important;font-size:11pt !important;font-weight:bold !important;letter-spacing:.4px;text-shadow:none !important;flex:1 1 84px !important}#owrx-rig-dx .owrx-rig-dx-list td.age{flex:0 0 30px !important}#owrx-rig-dx .owrx-rig-dx-list td.freq{flex:0 0 66px !important}#owrx-rig-dx .owrx-rig-dx-list td.freq.inwin{color:#ffffff !important}#owrx-rig-dx .owrx-rig-dx-list td.mode{flex:0 0 36px !important;color:#7cc0ff !important}#owrx-rig-dx .owrx-rig-dx-list td.brg{flex:0 0 84px !important}#owrx-rig-dx .owrx-rig-dx-list td.cty{flex:0 0 104px !important}#owrx-rig-dx .owrx-rig-dx-list tr.listening td,#owrx-rig-dx .owrx-rig-dx-list tr.listening td.call,#owrx-rig-dx .owrx-rig-dx-list tr.listening td.mode{color:#4dff62 !important;text-shadow:none !important}.owrx-rig-spot{font-family:Consolas,Cascadia Mono,DejaVu Sans Mono,Menlo,monospace !important;font-size:11px !important;font-weight:bold !important;line-height:13px !important;color:#d6ecff !important}';
		document.head.appendChild(style);
	}
	fetch('static/plugins/receiver/profile_jump/profiles.json', {cache: 'no-store'}).then(function (response) {
		return response.json();
	}).then(function (data) {
		self.profiles = (data && data.profiles || []).filter(function (p) {
			return p && p.key && Number.isFinite(p.center_freq) && Number.isFinite(p.samp_rate) && p.samp_rate > 0;
		});
	}).catch(function (error) {
		console.warn('profile_jump: no se pudo leer profiles.json', error);
	});
	this._hook();
	return true;
};
