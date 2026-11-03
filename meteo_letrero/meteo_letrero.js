/*
 * meteo_letrero - plugin local de EA7CL para OpenWebRX+
 *
 * Letrero a lo ancho de la pantalla, entre la cabecera y la cinta de bandas
 * (no tapa ninguna ventana: la cinta y la cascada bajan lo que mide).
 * Muestra el tiempo de la estacion Davis Vantage Pro2: los mismos datos del
 * pie de foto de la camara, que el Ubuntu lee cada minuto (datos.json).
 *
 * Dos formas: en movimiento (de derecha a izquierda, se para con el raton
 * encima) o quieto con los datos centrados. Cada oyente puede cambiar de una
 * a otra pulsando sobre el letrero (su navegador lo recuerda).
 */
Plugins.meteo_letrero = Plugins.meteo_letrero || {};
Plugins.meteo_letrero._version = 0.6;
Plugins.meteo_letrero.no_css = true;

// --- AJUSTES ---
Plugins.meteo_letrero.MOVER = true;      // true = en movimiento, false = quieto y centrado
Plugins.meteo_letrero.VELOCIDAD = 60;    // pixeles por segundo (menos = mas lento)
Plugins.meteo_letrero.ALTO = 36;         // alto del letrero en pixeles
Plugins.meteo_letrero.LETRA = 19;        // tamano de letra en pixeles
Plugins.meteo_letrero.LUGAR = 'Nueva Málaga (Málaga), 73 msnm';

Plugins.meteo_letrero._dec = function (v) {
	v = String(v == null ? '' : v).trim();
	if (!v || /N\/A/i.test(v)) return '';
	return v.replace('.', ',');
};

// saca un valor del pie de foto completo
Plugins.meteo_letrero._del = function (d, rx) {
	var m = String(d.texto || '').match(rx);
	return m ? m[1] : '';
};

Plugins.meteo_letrero._texto = function (d, corto) {
	var D = this._dec.bind(this), p = [], s = '<span class="ea7m-sep">•</span>';
	// si no se pudieron sacar los valores, se muestra el pie de foto tal cual
	if (!D(d.temp) && d.texto) return $('<div>').text(d.texto).html();
	var tmax = d.tmax || this._del(d, /Temp-Max:\s*(-?[\d.,]+)/i);
	var tmin = d.tmin || this._del(d, /Temp-Min:\s*(-?[\d.,]+)/i);
	// fecha tal como viene en el pie de foto (19-oct-2026, 19/10/26...)
	var fecha = d.fecha || this._del(d, /\b(\d{1,2}[-\/][^\s,\/-]{1,4}\.?[-\/]\d{2,4})\b/);

	var extra = corto !== 2;   // 2 = minimo: sin max/min ni racha (pantallas estrechas)
	p.push('<b>🌡 ' + D(d.temp) + ' °C</b>' +
		(extra && D(tmax) ? ' <span class="ea7m-g">(máx ' + D(tmax) + ' / mín ' + D(tmin) + ')</span>' : ''));
	if (D(d.hum)) p.push('💧 ' + (corto ? '' : 'Humedad ') + D(d.hum) + ' %');
	if (D(d.viento)) p.push('🌬 ' + (corto ? '' : 'Viento ') + D(d.viento) + ' km/h ' + (d.dir || '') +
		(extra && D(d.racha) ? ' <span class="ea7m-g">(racha ' + D(d.racha) + (d.racha_hora ? ' a las ' + d.racha_hora : '') + ')</span>' : ''));
	if (D(d.presion)) p.push('⏲ ' + D(d.presion) + ' hPa');
	if (D(d.lluvia)) p.push('☔ ' + (corto ? 'Lluvia ' : 'Lluvia hoy ') + D(d.lluvia) + ' mm');
	if (D(d.uv)) p.push('☀ UV ' + D(d.uv));
	if (!corto) p.push('<span class="ea7m-g">' + this.LUGAR + '</span>');
	if (fecha || d.hora) p.push('📅 ' + fecha + (d.hora ? ' · 🕒 ' + d.hora : '') +
		(corto ? '' : ' <span class="ea7m-g">hora local</span>'));
	return p.join(s);
};

// dibuja el letrero segun el modo (en movimiento o quieto)
Plugins.meteo_letrero._pintar = function () {
	var d = this._datos;
	if (!d) return;
	var fin = '<span class="ea7m-sep">◆</span>';
	this.$caja.toggleClass('quieto', !this._mover);
	if (this._mover) {
		var h = this._texto(d, false) + fin;
		this.$run.html('<span class="ea7m-c">' + h + '</span><span class="ea7m-c">' + h + '</span>');
		this.$run.css('font-size', this.LETRA + 'px');
	} else {
		this.$run[0].style.transform = '';
		// si no cabe, se reduce la letra; si aun asi queda pequena, se quitan
		// los datos secundarios (max/min y racha) para que se lea bien
		var ancho = this.$caja[0].clientWidth - 16, t;
		for (var nivel = 1; nivel <= 2; nivel++) {
			this.$run.html('<span class="ea7m-c">' + this._texto(d, nivel) + '</span>');
			t = this.LETRA;
			this.$run.css('font-size', t + 'px');
			while (t > 11 && this.$run.children()[0].offsetWidth > ancho) {
				t -= 1;
				this.$run.css('font-size', t + 'px');
			}
			if (t >= 15) break;
		}
	}
	this.$caja.attr('title', $('<div>').html(this._texto(d, false)).text() +
		'\n(pulsa para ' + (this._mover ? 'dejarlo quieto' : 'ponerlo en movimiento') + ')');
};

Plugins.meteo_letrero._leer = function () {
	var self = this;
	$.ajax({ url: this._base + 'datos.json?t=' + Date.now(), dataType: 'json', cache: false })
		.done(function (d) {
			if (!d) return;
			var nuevo = JSON.stringify(d.texto || d);
			if (nuevo === self._ultimo) return;
			self._ultimo = nuevo;
			self._datos = d;
			var primera = !self.$caja.is(':visible');
			self.$caja.show();
			self._pintar();
			if (primera) window.dispatchEvent(new Event('resize'));
		});
};

Plugins.meteo_letrero.init = function () {
	var self = this;
	this._base = (this._script_loaded || 'static/plugins/receiver/meteo_letrero/meteo_letrero.js')
		.replace(/[^\/]*$/, '');
	// modo elegido por el oyente (si lo cambio alguna vez), si no el de AJUSTES
	this._mover = this.MOVER;
	try {
		var g = localStorage.getItem('ea7_meteo_mover');
		if (g === '1' || g === '0') this._mover = g === '1';
	} catch (e) {}

	var st = document.createElement('style');
	st.textContent =
		'#ea7-meteo{flex:0 0 ' + this.ALTO + 'px;height:' + this.ALTO + 'px;width:100%;' +
		'overflow:hidden;position:relative;z-index:50;background:rgba(8,16,26,.92);border-top:1px solid #2e5c8a;' +
		'border-bottom:1px solid #2e5c8a;box-sizing:border-box;cursor:pointer;display:none;' +
		// por encima de los trozos de cascada que asoman hacia arriba (si no, el raton
		// sobre el letrero llegaba a la cascada: movia la cruz y cambiaba la frecuencia)
		'z-index:20}' +
		'#ea7-meteo .ea7m-run{position:absolute;top:0;left:0;height:100%;display:flex;align-items:center;' +
		'white-space:nowrap;will-change:transform;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
		'font-weight:600;color:#cfe9ff}' +
		'#ea7-meteo.quieto .ea7m-run{left:0;right:0;justify-content:center}' +
		'#ea7-meteo b{color:#ffd500}' +
		'#ea7-meteo .ea7m-g{color:#9fb0bd;font-weight:normal}' +
		'#ea7-meteo .ea7m-sep{color:#5d6b77;margin:0 14px}' +
		'#ea7-meteo.quieto .ea7m-sep{margin:0 10px}';
	document.head.appendChild(st);

	this.$caja = $('<div id="ea7-meteo">');
	this.$run = $('<div class="ea7m-run">').appendTo(this.$caja);
	// entre la cabecera y la cinta de bandas
	var $cinta = $('#openwebrx-frequency-container');
	if ($cinta.length) this.$caja.insertBefore($cinta);
	else this.$caja.prependTo('.openwebrx-waterfall-container');
	setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 500);

	// el raton y los toques sobre el letrero son solo del letrero: que no
	// lleguen a la cascada ni a la cinta (si no, mueven la cruz o cambian
	// la frecuencia como si se pulsara en la cascada)
	this.$caja.on('mousedown mouseup mousemove wheel dblclick contextmenu ' +
		'touchstart touchmove touchend pointerdown pointerup pointermove', function (e) {
		e.stopPropagation();
	});

	// pulsar sobre el letrero: en movimiento <-> quieto
	this.$caja.on('click', function (e) {
		e.stopPropagation();
		e.preventDefault();
		self._mover = !self._mover;
		try { localStorage.setItem('ea7_meteo_mover', self._mover ? '1' : '0'); } catch (e) {}
		self._pintar();
	});
	$(window).on('resize', function () { if (!self._mover) self._pintar(); });

	// movimiento continuo; se para con el raton encima
	var x = 0, antes = null, parado = false;
	this.$caja.on('mouseenter', function () { parado = true; })
		.on('mouseleave', function () { parado = false; });
	function paso(t) {
		if (antes !== null && !parado && self._mover) {
			x -= self.VELOCIDAD * (t - antes) / 1000;
			var c = self.$run.children()[0];
			var w = c ? c.offsetWidth : 0;
			if (w && -x >= w) x += w;
			if (x > 0) x = 0;
			self.$run[0].style.transform = 'translateX(' + x.toFixed(1) + 'px)';
		}
		antes = t;
		requestAnimationFrame(paso);
	}
	requestAnimationFrame(paso);

	this._leer();
	setInterval(function () { self._leer(); }, 60000);
	return true;
};
