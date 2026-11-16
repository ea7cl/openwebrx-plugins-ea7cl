/*
 * rig_volumen_ea7cl - plugin local de EA7CL para OpenWebRX+
 *
 * Anade al frontal del equipo de rig_skin una barra deslizante de volumen,
 * para no depender de la seccion CONTROLES. Pulsar "VOL" silencia/activa el
 * audio (igual que MUTE). Va sincronizada con el volumen normal de
 * OpenWebRX+. No modifica rig_skin: sus actualizaciones no la borran.
 * v0.3: tambien se mueve con la rueda del raton (raton encima de la fila).
 */
Plugins.rig_volumen_ea7cl = Plugins.rig_volumen_ea7cl || {};
Plugins.rig_volumen_ea7cl._version = 0.3;
Plugins.rig_volumen_ea7cl.PASO_RUEDA = 5;   // cuanto sube/baja cada golpe de rueda
Plugins.rig_volumen_ea7cl.no_css = true;

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

Plugins.rig_volumen_ea7cl._montar = function () {
	if (document.getElementById('ea7-vol')) return;
	var $linea = $('#owrx-rig-knob-line');
	if (!$linea.length || typeof UI === 'undefined' || typeof UI.setVolume !== 'function') return;

	var self = this;
	var $fila = $('<div id="ea7-vol" class="openwebrx-panel-line">');
	var $val = $('<span class="ea7-vol-val">');
	var $ico = $('<span class="ea7-vol-ico" title="Silenciar / activar el audio">VOL</span>');
	var $sl = $('<input type="range" min="0" max="150" title="Volumen (tambien con la rueda del raton)">');

	function sincronizar() {
		var silenciado = typeof UI.volumeMuted === 'number' && UI.volumeMuted >= 0;
		$ico.toggleClass('muted', silenciado).text(silenciado ? 'MUTE' : 'VOL');
		if (document.activeElement !== $sl[0]) {
			$sl.val(UI.volume);
			$val.text(UI.volume);
		}
	}

	$ico.on('click', function () {
		if (typeof UI.toggleMute === 'function') UI.toggleMute();
		sincronizar();
	});
	$sl.on('input change', function () {
		UI.setVolume(this.value);
		$val.text(this.value);
	});

	// EA7CL v0.3: rueda del raton sobre la fila del volumen (arriba = mas
	// volumen); no deja que la pagina ni la cascada se muevan a la vez
	$fila.on('wheel', function (e) {
		var ev = e.originalEvent || e;
		var d = ev.deltaY || ev.deltaX || 0;
		if (!d) return;
		e.preventDefault();
		e.stopPropagation();
		var v = parseInt($sl.val(), 10) || 0;
		v += (d < 0 ? 1 : -1) * self.PASO_RUEDA;
		v = Math.max(0, Math.min(150, v));
		$sl.val(v);
		UI.setVolume(v);
		$val.text(v);
	});

	$fila.append($ico, $sl, $val);
	$linea.after($fila);
	sincronizar();
	this._sincronizar = sincronizar;
};

Plugins.rig_volumen_ea7cl.init = function () {
	var self = this;
	var st = document.createElement('style');
	st.id = 'rig-volumen-ea7cl-style';
	st.textContent = this.CSS;
	document.head.appendChild(st);
	setInterval(function () {
		self._montar();
		if (self._sincronizar) self._sincronizar();
	}, 1000);
	return true;
};
