/*
 * perfil_recordado - plugin local de EA7CL para OpenWebRX+
 *
 * Cada navegador recuerda el ultimo perfil, frecuencia y modo que uso:
 *  - al volver a abrir la web, entra directamente en ese perfil;
 *  - si se corta la conexion (muy habitual en iPhone/iPad) y OpenWebRX+
 *    reconecta, vuelve al mismo perfil y frecuencia en vez del primero.
 * Lo recordado se guarda solo en el navegador del oyente (localStorage).
 */
Plugins.perfil_recordado = Plugins.perfil_recordado || {};
Plugins.perfil_recordado._version = 0.3;
// EA7CL: enlace con frecuencia (#freq=...): al entrar por un enlace, no volver al perfil recordado
Plugins.perfil_recordado._enlace = +((location.hash.match(/freq=(\d+)/) || [])[1] || 0);
// 0.3: modo del enlace (#...,mod=nfm) para usarlo si hay que saltar de perfil
Plugins.perfil_recordado._enlaceModo = (location.hash.match(/[#,]mod=([a-z0-9]+)/i) || [])[1] || '';
Plugins.perfil_recordado.no_css = true;

// dias que se recuerda el perfil al abrir la web de nuevo
Plugins.perfil_recordado.DIAS = 7;
// true = no devolver automaticamente a un perfil de un SDR que tiene varios
// perfiles (el 🔻), para no mover ese SDR a otros oyentes al entrar
Plugins.perfil_recordado.EVITAR_SDR_COMPARTIDO = true;

Plugins.perfil_recordado._clave = 'ea7_perfil_recordado';

Plugins.perfil_recordado._leer = function () {
	try { return JSON.parse(localStorage.getItem(this._clave) || 'null'); } catch (e) { return null; }
};
Plugins.perfil_recordado._guardar = function (d) {
	try { localStorage.setItem(this._clave, JSON.stringify(d)); } catch (e) {}
};

Plugins.perfil_recordado._lista = function () { return $('#openwebrx-sdr-profiles-listbox'); };

Plugins.perfil_recordado._compartido = function (valor) {
	var sdr = String(valor).split('|')[0], n = 0;
	this._lista().find('option').each(function () {
		if (String(this.value).split('|')[0] === sdr) n++;
	});
	return n > 1;
};

Plugins.perfil_recordado._existe = function (valor) {
	var ok = false;
	this._lista().find('option').each(function () { if (this.value === valor) ok = true; });
	return ok;
};

Plugins.perfil_recordado._enVentana = function (f) {
	return typeof center_freq !== 'undefined' && typeof bandwidth !== 'undefined' &&
		Math.abs(f - center_freq) < bandwidth / 2 - 5000;
};

// tras cambiar de perfil, recolocar frecuencia y modo
Plugins.perfil_recordado._sintonizar = function (d) {
	var self = this, intentos = 0;
	var iv = setInterval(function () {
		intentos++;
		if (self._lista().val() === d.p && self._enVentana(d.f)) {
			clearInterval(iv);
			setTimeout(function () {
				try { if (d.m) UI.setModulation(d.m); } catch (e) {}
				try { UI.setFrequency(d.f, false); } catch (e) {}
				self._fin();
			}, 800);
		} else if (intentos > 30) {
			clearInterval(iv);
			self._fin();
		}
	}, 500);
};

Plugins.perfil_recordado._fin = function () {
	this._pendiente = false;
	this._restaurando = false;
};

// 0.3: si el enlace pide una frecuencia que no esta en el perfil inicial,
// ir al perfil que la cubra (lista de profile_jump). Devuelve true si salta.
Plugins.perfil_recordado._irAlEnlace = function () {
	var f = this._enlace, m = this._enlaceModo;
	this._enlace = 0;
	if (!f || this._enVentana(f)) return false;   // ya la tiene el perfil inicial
	var pj = Plugins.profile_jump;
	if (!pj || typeof pj.find !== 'function' || !pj.profiles || !pj.profiles.length) return false;
	var destino = pj.find(f);
	var $l = this._lista();
	if (!destino || destino.key === $l.val()) return false;
	$l.val(destino.key);
	try { sdr_profile_changed(); } catch (e) { return false; }
	this._sintonizar({ p: destino.key, f: f, m: m });
	return true;
};

Plugins.perfil_recordado._restaurar = function (reconexion) {
	// entrada por enlace #freq=: manda el enlace, no lo recordado
	if (!reconexion && this._enlace) {
		var d0 = this._leer();
		if (!d0 || !d0.p || Math.abs(this._enlace - (d0.f || 0)) > 50) {
			if (!this._irAlEnlace()) this._fin();
			return;
		}
		this._enlace = 0;   // el enlace coincide con lo recordado (p. ej. F5): seguir normal
	}
	var d = this._leer();
	var $l = this._lista();
	var actual = $l.val();
	if (!d || !d.p || !actual) { this._fin(); return; }
	if (!reconexion && Date.now() - (d.t || 0) > this.DIAS * 86400000) { this._fin(); return; }
	if (!this._existe(d.p)) { this._fin(); return; }
	if (this.EVITAR_SDR_COMPARTIDO && !reconexion && this._compartido(d.p)) { this._fin(); return; }

	if (actual === d.p) {
		// mismo perfil: solo recolocar la frecuencia si hace falta
		if (d.f && this._enVentana(d.f) && Math.abs(UI.getFrequency() - d.f) > 50) {
			this._sintonizar(d);
		} else {
			this._fin();
		}
		return;
	}
	$l.val(d.p);
	try { sdr_profile_changed(); } catch (e) { this._fin(); return; }
	this._sintonizar(d);
};

Plugins.perfil_recordado.init = function () {
	var self = this;
	this._pendiente = true;
	this._reconexion = false;
	this._abierto = Date.now();

	// enterarse de cada reconexion del WebSocket
	if (typeof window.on_ws_opened === 'function' && !window.on_ws_opened._ea7) {
		var original = window.on_ws_opened;
		window.on_ws_opened = function () {
			self._pendiente = true;
			self._restaurando = false;
			// 0.3: solo es reconexion si antes se corto (la primera apertura no lo es)
			self._reconexion = !!self._cortado;
			self._abierto = Date.now();
			return original.apply(this, arguments);
		};
		window.on_ws_opened._ea7 = true;
	}
	// al cortarse, dejar de apuntar hasta que se haya restaurado
	if (typeof window.on_ws_closed === 'function' && !window.on_ws_closed._ea7) {
		var cierre = window.on_ws_closed;
		window.on_ws_closed = function () {
			self._pendiente = true;
			self._restaurando = true;
			self._cortado = true;
			return cierre.apply(this, arguments);
		};
		window.on_ws_closed._ea7 = true;
	}

	setInterval(function () {
		var $l = self._lista();
		if (!$l.length || !$l.val()) return;
		if (self._pendiente) {
			// esperar a que el servidor mande el perfil inicial
			if (Date.now() - self._abierto < 2000 || self._restaurando) return;
			self._restaurando = true;
			self._restaurar(self._reconexion);
			return;
		}
		// apuntar lo que el oyente esta usando
		try {
			if (typeof ws === 'undefined' || !ws || ws.readyState !== 1) return;
			var f = UI.getFrequency(), m = UI.getModulation();
			if (!f || f <= 0 || !m) return;
			self._guardar({ p: $l.val(), f: f, m: m, t: Date.now() });
		} catch (e) {}
	}, 1000);
	return true;
};
