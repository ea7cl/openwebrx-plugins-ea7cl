/*
 * smeter_bandas - plugin local de EA7CL para OpenWebRX+
 *
 * Corrige SOLO LA LECTURA del S-meter de rig_skin en perfiles concretos
 * (por ejemplo 27 y 28 MHz, que marcan de mas). La senal, la ganancia del
 * SDR y el silenciador (squelch) no cambian; solo lo que marca la aguja.
 *
 * Como funciona: rig_skin calibra el S-meter con offset_hf / offset_vhf
 * (en init.js, window.rig_skin_config). Este plugin, al entrar en uno de
 * los perfiles de la lista, suma a ese offset la correccion en dB de ese
 * perfil, y al salir lo deja como estaba. 6 dB = 1 unidad S.
 */
Plugins.smeter_bandas = Plugins.smeter_bandas || {};
Plugins.smeter_bandas._version = 0.4;
Plugins.smeter_bandas.no_css = true;

// --- AJUSTES: correccion en dB por perfil (negativo = marca menos) ---
// La clave es el identificador del perfil tal como sale en el desplegable
// (dispositivo|perfil). Se puede cambiar el numero y recargar la web.
Plugins.smeter_bandas.CORRECCION = {
	// 🟡 27 MHz CB Band 11m
	'fbaa4051-1375-41d1-b875-5b31a6aa7cc8|bb892440-47b1-4622-aa17-82fdf9d73158': -65,
	// 🟡 28 Mhz HAM 10m
	'f6a0b95d-b1b5-45b3-9309-9f1a42d40172|e5771524-30c7-4d57-975d-419af02caedd': -60,
	// 🟡 50-52 MHz HAM 6m
	'be110986-6915-484c-8748-22ebe6f49906|6df79557-0cd3-4fe2-ae54-79596ddb2076': -30,
	// 🟡 3,5 Mhz HAM 80m
	'f3f4e3d2-12cf-450c-950e-4c9e1fe57fe1|60bbf66b-30e9-47a7-98b0-7e52b9a64688': -55,
	// 🟡 21 MHz Ham 15m
	'3f984e89-52f3-4d80-84a4-ed73e3f1fe30|d27dc8fc-1ee8-46ad-969a-8fa117169bed': -59
};

Plugins.smeter_bandas._perfil = function () {
	var s = document.getElementById('openwebrx-sdr-profiles-listbox');
	return s ? s.value : '';
};

Plugins.smeter_bandas._aplicar = function () {
	var rs = Plugins.rig_skin;
	if (!rs || !rs.smeter || !this._base) return;
	var c = this.CORRECCION[this._perfil()] || 0;
	if (c === this._actual) return;
	this._actual = c;
	if (typeof this._base.offset_hf === 'number') rs.smeter.offset_hf = this._base.offset_hf + c;
	if (typeof this._base.offset_vhf === 'number') rs.smeter.offset_vhf = this._base.offset_vhf + c;
};

Plugins.smeter_bandas._arrancar = function () {
	var self = this;
	var rs = Plugins.rig_skin;
	if (!rs || !rs.smeter) return false;
	// copia propia de los valores originales (rig_skin usa el mismo objeto que init.js)
	rs.smeter = $.extend({}, rs.smeter);
	this._base = { offset_hf: rs.smeter.offset_hf, offset_vhf: rs.smeter.offset_vhf };
	this._actual = null;
	this._aplicar();
	// el perfil cambia al elegirlo en la lista o al saltar desde un spot
	setInterval(function () { self._aplicar(); }, 500);
	return true;
};

Plugins.smeter_bandas.init = function () {
	var self = this, intentos = 0;
	// rig_skin puede terminar de arrancar despues: se reintenta 30 s
	if (this._arrancar()) return true;
	var t = setInterval(function () {
		if (self._arrancar() || ++intentos > 30) clearInterval(t);
		if (intentos > 30) console.log('smeter_bandas: rig_skin sin calibrar (rig_skin_config.smeter); no hace nada');
	}, 1000);
	return true;
};
