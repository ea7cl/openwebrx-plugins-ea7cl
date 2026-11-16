/*
 * rig_volumen_ea7cl - plugin local de EA7CL para OpenWebRX+
 *
 * TODO lo del volumen del receptor (MAIN) está en este plugin:
 *  - Barra VOL en el frontal del equipo de rig_skin (no depende de CONTROLES).
 *    Pulsar "VOL" silencia/activa el audio (igual que MUTE); en MUTE se pone
 *    "MUTE" en rojo.
 *  - MUTE (tecla MUTE, VOL o el altavoz de CONTROLES) sin mover las barras:
 *    se quedan donde estaban y al quitar el MUTE vuelve ese volumen. Moverlas
 *    en MUTE cambia el volumen al que volverá, sin quitar el MUTE.
 *  - Rueda del ratón en las dos barras (VOL y la de CONTROLES): un paso por
 *    golpe de rueda, también en MUTE; la página no se desplaza.
 *  - Las dos barras siempre iguales, al momento.
 * No modifica rig_skin ni OpenWebRX: sus actualizaciones no lo borran.
 * El VOL del SUB del doble receptor copia este comportamiento.
 *
 * 0.6: todo en el plugin (antes la rueda era la de OpenWebRX) y la barra de
 *      CONTROLES sigue a la VOL también en MUTE.
 * 0.5: rueda con step="1" (la de OpenWebRX). 0.4: MUTE sin mover la barra.
 */
Plugins.rig_volumen_ea7cl = Plugins.rig_volumen_ea7cl || {};
Plugins.rig_volumen_ea7cl._version = 0.6;
Plugins.rig_volumen_ea7cl.no_css = true;

// cuánto sube o baja cada golpe de rueda
Plugins.rig_volumen_ea7cl.PASO_RUEDA = 1;

Plugins.rig_volumen_ea7cl.CSS =
	'#ea7-vol{display:flex;align-items:center;gap:8px;padding:4px 10px 2px 12px;' +
	'font:bold 9pt roboto-mono,monospace;color:#c5ced6}' +
	'#ea7-vol .ea7-vol-ico{cursor:pointer;min-width:34px;text-align:center;padding:2px 4px;border-radius:3px;' +
	'background:linear-gradient(#31363c,#262a2f);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 1px 2px rgba(0,0,0,.5);user-select:none}' +
	'#ea7-vol .ea7-vol-ico.muted{color:#ff5050}' +
	// color de la barra (amarillo oro)
	'#ea7-vol input{flex:1 1 auto;accent-color:#ffd700;cursor:pointer;height:14px}' +
	'#ea7-vol .ea7-vol-val{min-width:30px;text-align:right;color:#ffd700}' +
	// vista apaisada (dos columnas): la columna izquierda termina en la fila de
	// los circulitos de paso, para que la barra no salte a la columna derecha
	'body.theme-rig #openwebrx-panel-receiver.rig-wide > #id-step-freq{break-after:column;-webkit-column-break-after:always}';

// ---- estado del volumen ----

Plugins.rig_volumen_ea7cl._silenciado = function () {
	return typeof UI.volumeMuted === 'number' && UI.volumeMuted >= 0;
};

// volumen que se ve en las barras: en MUTE, el que volverá al quitarlo
Plugins.rig_volumen_ea7cl._valor = function () {
	return Math.round(+(this._silenciado() ? UI.volumeMuted : UI.volume)) || 0;
};

// poner un volumen desde cualquier barra o la rueda
Plugins.rig_volumen_ea7cl._poner = function (v) {
	v = Math.min(150, Math.max(0, Math.round(+v) || 0));
	if (this._silenciado()) UI.volumeMuted = v;   // en MUTE: solo el volumen al que volverá
	else UI.setVolume(v);
	this._pintar();
};

// las dos barras, el número y el letrero VOL/MUTE iguales al estado actual
Plugins.rig_volumen_ea7cl._pintar = function (salvo) {
	var v = this._valor();
	var silenciado = this._silenciado();
	$('#ea7-vol input, #openwebrx-panel-volume').each(function () {
		if (this !== salvo && +this.value !== v) this.value = v;
	});
	$('#ea7-vol .ea7-vol-val').text(v);
	$('#ea7-vol .ea7-vol-ico').toggleClass('muted', silenciado).text(silenciado ? 'MUTE' : 'VOL');
};

// ---- barra VOL en el frontal del rig ----

Plugins.rig_volumen_ea7cl._montar = function () {
	if (document.getElementById('ea7-vol')) return;
	var $linea = $('#owrx-rig-knob-line');
	if (!$linea.length) return;
	var self = this;

	var $fila = $('<div id="ea7-vol" class="openwebrx-panel-line">');
	var $val = $('<span class="ea7-vol-val">');
	var $ico = $('<span class="ea7-vol-ico" title="Silenciar / activar el audio">VOL</span>');
	var $sl = $('<input type="range" min="0" max="150" step="1" title="Volumen (también con la rueda del ratón)">');

	$ico.on('click', function () { UI.toggleMute(); });
	$sl.on('input change', function () {
		self._poner(this.value);
	});
	this._rueda($sl);

	$fila.append($ico, $sl, $val);
	$linea.after($fila);
	this._pintar();
};

// rueda del ratón propia: un paso por golpe, también en MUTE. Corta el
// evento para que no actúe además la rueda de OpenWebRX (initSliders) ni se
// desplace la página.
Plugins.rig_volumen_ea7cl._rueda = function ($barra) {
	var self = this;
	$barra.on('wheel', function (e) {
		var ev = e.originalEvent || e;
		var d = ev.deltaY || ev.deltaX || 0;
		e.preventDefault();
		e.stopPropagation();
		if (!d) return;
		self._poner(self._valor() + (d < 0 ? 1 : -1) * self.PASO_RUEDA);
	});
};

// ---- MUTE y barra de CONTROLES de OpenWebRX ----

Plugins.rig_volumen_ea7cl._enganchar = function () {
	if (this._enganchado) return;
	this._enganchado = true;
	var self = this;

	// tras cualquier cambio de volumen o MUTE (venga de donde venga), barras iguales
	var setVolume = UI.setVolume;
	UI.setVolume = function () {
		var r = setVolume.apply(this, arguments);
		self._pintar();
		return r;
	};
	var toggleMute = UI.toggleMute;
	UI.toggleMute = function () {
		var r = toggleMute.apply(this, arguments);
		self._pintar();            // OpenWebRX bajaba la barra a 0: vuelve a su sitio
		return r;
	};

	// barra de CONTROLES movida en MUTE: que OpenWebRX no quite el silencio,
	// solo cambia el volumen al que volverá
	['input', 'change'].forEach(function (tipo) {
		document.addEventListener(tipo, function (e) {
			var t = e.target;
			if (!t || t.id !== 'openwebrx-panel-volume' || !self._silenciado()) return;
			e.stopPropagation();
			UI.volumeMuted = Math.min(150, Math.max(0, Math.round(+t.value)));
			self._pintar(t);
		}, true);
	});

	var $controles = $('#openwebrx-panel-volume');
	if ($controles.length) this._rueda($controles);
	this._pintar();
};

Plugins.rig_volumen_ea7cl.init = function () {
	if (typeof UI === 'undefined' || typeof UI.setVolume !== 'function' || typeof UI.toggleMute !== 'function') {
		console.error('rig_volumen_ea7cl: no encuentro los controles de volumen de OpenWebRX.');
		return false;
	}
	var self = this;
	self._enganchar();
	var st = document.createElement('style');
	st.id = 'rig-volumen-ea7cl-style';
	st.textContent = this.CSS;
	document.head.appendChild(st);
	// rig_skin monta su frontal más tarde (y puede rehacerlo): se mira cada segundo
	setInterval(function () {
		self._montar();
		self._pintar(document.activeElement);
	}, 1000);
	return true;
};
