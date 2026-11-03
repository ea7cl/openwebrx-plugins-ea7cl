/*
 * rig_dx_spotter - plugin local de EA7CL para OpenWebRX+
 *
 * Mejora la lista de la ventana DX CLUSTER de rig_skin:
 *  - columna con el indicativo de quien pone el spot ("de EA4XX");
 *  - botones EU / TODOS: solo spots anunciados desde Europa, o todos;
 *  - selector de BANDA para ver solo los spots de una banda sin mover el dial;
 *  - boton COMENT: muestra el comentario de cada spot al final de su linea
 *    (abreviado si no cabe; entero al pasar el raton);
 *  - cada modo con su color (CW amarillo, SSB rosa, FT8 cian, FT4 azul,
 *    RTTY/PSK/digitales violeta, FM rojo; la fila escuchada sigue en verde);
 *    si el cluster no trae el modo se deduce del comentario o del plan de
 *    bandas IARU R1 (en letra normal, sin negrita) y al pulsar se sintoniza
 *    en ese modo.
 *
 * Usa los spots que ya recibe rig_skin y escucha HolyCluster solo para saber
 * de que continente es cada anunciante. No modifica rig_skin: sus
 * actualizaciones no borran este plugin. El mapa sigue los botones propios
 * de rig_skin (banda/HF/ALL); estos filtros afectan a la lista.
 */
Plugins.rig_dx_spotter = Plugins.rig_dx_spotter || {};
Plugins.rig_dx_spotter._version = 0.61;
Plugins.rig_dx_spotter.no_css = true;

Plugins.rig_dx_spotter.MAX_FILAS = 40;

Plugins.rig_dx_spotter.BANDAS = [
	['TODAS', 0, 0],
	['160m', 1800000, 2000000], ['80m', 3500000, 3800000], ['60m', 5250000, 5450000],
	['40m', 7000000, 7300000], ['30m', 10100000, 10150000], ['20m', 14000000, 14350000],
	['17m', 18068000, 18168000], ['15m', 21000000, 21450000], ['12m', 24890000, 24990000],
	['10m', 28000000, 29700000], ['6m', 50000000, 54000000], ['VHF/UHF', 100000000, 3000000000]
];

Plugins.rig_dx_spotter.CSS =
	'#owrx-rig-dx table.owrx-rig-dx-list:not(.ea7-dx-list){display:none !important}' +
	'#owrx-rig-dx .ea7-dx-bar{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:9pt;color:#93a0ab}' +
	'#owrx-rig-dx .ea7-dx-bar .ea7-chip{cursor:pointer;padding:1px 7px;border-radius:3px;border:1px solid #3a454e;color:#c5ced6;user-select:none}' +
	'#owrx-rig-dx .ea7-dx-bar .ea7-chip.on{background:#1a4fb0;border-color:#3d7bff;color:#fff}' +
	'#owrx-rig-dx .ea7-dx-bar select{background:#1b242c;color:#eef1f4;border:1px solid #3a454e;border-radius:3px;font-size:9pt;padding:0 2px}' +
	'#owrx-rig-dx .ea7-dx-bar .ea7-cuenta{margin-left:auto;color:#8a959e}' +
	'#owrx-rig-dx .owrx-rig-dx-lcd.activity .ea7-dx-bar{display:none}' +
	// columnas de ancho fijo: al ensanchar la ventana solo crece el comentario
	'#owrx-rig-dx table.ea7-dx-list td.call{flex:0 0 96px !important;min-width:96px;max-width:96px;overflow:hidden;text-overflow:ellipsis}' +
	'#owrx-rig-dx table.ea7-dx-list td.age{flex:0 0 30px !important}' +
	'#owrx-rig-dx table.ea7-dx-list td.freq{flex:0 0 66px !important}' +
	'#owrx-rig-dx table.ea7-dx-list td.mode{flex:0 0 40px !important}' +
	// colores por modo (la fila que se esta escuchando mantiene el verde de rig_skin);
	// con !important porque el plugin de claridad del DX pone el modo en azul con !important
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode{font-weight:bold !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.m-cw{color:#ffd500 !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.m-ssb{color:#ff7ad9 !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.m-ft8{color:#00e0ff !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.m-ft4{color:#5a8cff !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.m-digi{color:#c58cff !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.m-fm{color:#ff6b6b !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.m-otro{color:#c5ced6 !important}' +
	'#owrx-rig-dx table.ea7-dx-list tr:not(.listening) td.mode.est{font-weight:normal !important;opacity:.85}' +
	'#owrx-rig-dx table.ea7-dx-list tr.listening td.mode{color:#3adb4a !important}' +
	'#owrx-rig-dx table.ea7-dx-list td.spotter{flex:0 0 80px !important;overflow:hidden;' +
	'text-overflow:ellipsis;color:#ffb347 !important;font-size:8.5pt !important;font-weight:normal}' +
	'#owrx-rig-dx .owrx-rig-dx-list td.spotter:before{content:"de ";color:#8a959e}' +
	'#owrx-rig-dx .owrx-rig-dx-list td.cty{flex:1 1 30px !important;min-width:0}' +
	'#owrx-rig-dx .owrx-rig-dx-list td.vacio{flex:1 1 auto;text-align:center;color:#8a959e;white-space:normal}' +
	// comentario en una segunda linea bajo el spot
	'#owrx-rig-dx table.ea7-dx-list td.coment{flex:1 1 40px !important;min-width:0;overflow:hidden;' +
	'text-overflow:ellipsis;white-space:nowrap;color:#8fc7ff !important;font-size:8pt !important;font-style:italic;font-weight:normal}';

// --- memoria pequena (preferencias y continentes de anunciantes) ---

Plugins.rig_dx_spotter._leer = function (k, def) {
	try { var v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; }
};
Plugins.rig_dx_spotter._guardar = function (k, v) {
	try { localStorage.setItem(k, v); } catch (e) {}
};

Plugins.rig_dx_spotter._cont = {};   // indicativo del anunciante -> continente

Plugins.rig_dx_spotter._cargarCont = function () {
	try { this._cont = JSON.parse(this._leer('ea7_dx_spotter_cont', '{}')) || {}; } catch (e) { this._cont = {}; }
};
Plugins.rig_dx_spotter._guardarCont = function () {
	var claves = Object.keys(this._cont);
	if (claves.length > 4000) {
		var nuevo = {};
		claves.slice(-3000).forEach(function (k) { nuevo[k] = this._cont[k]; }, this);
		this._cont = nuevo;
	}
	this._guardar('ea7_dx_spotter_cont', JSON.stringify(this._cont));
};

// escucha HolyCluster solo para aprender el continente de cada anunciante
Plugins.rig_dx_spotter._escuchar = function () {
	var self = this;
	if (this._ws || typeof WebSocket === 'undefined') return;
	try {
		this._ws = new WebSocket('wss://holycluster.iarc.org/spots_ws');
	} catch (e) { this._ws = null; return; }
	this._ws.onmessage = function (m) {
		try {
			var d = JSON.parse(m.data);
			(d.spots || []).forEach(function (s) {
				if (s && s.spotter_callsign && s.spotter_continent) {
					self._cont[String(s.spotter_callsign).toUpperCase()] = s.spotter_continent;
				}
			});
			self._sucio = true;
		} catch (e) {}
	};
	this._ws.onclose = function () {
		self._ws = null;
		setTimeout(function () { self._escuchar(); }, 20000);
	};
};

// si aun no sabemos el continente de un anunciante, se estima por su prefijo
// (aproximado: sirve para los spots que llegaron antes de aprenderlo)
Plugins.rig_dx_spotter.PREFIJOS_EU = /^(2[A-Z]|9A|9H|C[TU]|D[A-R]|E[A-H]|E[IJ]|ES|E[U-W]|E7|ER|F|G|M|H[A-G]|HB|HV|I|L[A-N]|L[XYZ]|O[E-JK-MN-TYZ]|P[A-I]|S[5-9]|S[A-M]|S[N-R]|SV|SY|T7|TF|TK|YL|Y[O-R]|YT|YU|Z3|ZA|Z6|4O|R[A-Z]?[1-7]|U[A-I][1-7]|U[R-Z])/;

Plugins.rig_dx_spotter._esEU = function (call) {
	var c = String(call || '').toUpperCase();
	var cont = this._cont[c];
	if (cont) return cont === 'EU';
	c = c.split('-')[0].split('/')[0];
	return this.PREFIJOS_EU.test(c);
};

// --- lista propia ---

Plugins.rig_dx_spotter._listaRig = function () {
	var f = Plugins.rig_skin && Plugins.rig_skin._dxSpots;
	if (typeof f !== 'function') return [];
	try { return f() || []; } catch (e) { return []; }
};

Plugins.rig_dx_spotter._filtrar = function (lista) {
	var self = this;
	var soloEU = this.region === 'EU';
	var banda = null;
	this.BANDAS.forEach(function (b) { if (b[0] === self.banda && b[1]) banda = b; });
	var ahora = Date.now();
	return lista.filter(function (s) {
		if (!s || !s.freq || ahora - s.time > 60 * 60 * 1000) return false;
		if (banda && (s.freq < banda[1] || s.freq > banda[2])) return false;
		if (soloEU) return self._esEU(s.spotter);
		return true;
	});
};

Plugins.rig_dx_spotter._edad = function (t) {
	var m = Math.max(0, Math.floor((Date.now() - t) / 60000));
	return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h';
};

Plugins.rig_dx_spotter._escuchando = function (s) {
	try {
		var f = UI.getFrequency();
		return Math.abs(f - s.freq) <= 1000;
	} catch (e) { return false; }
};

Plugins.rig_dx_spotter._pintar = function () {
	var self = this;
	var $t = this.$tabla;
	if (!$t || !$t.closest('body').length) return;
	// mismo alto que la lista original de rig_skin
	var orig = $('#owrx-rig-dx table.owrx-rig-dx-list:not(.ea7-dx-list)')[0];
	if (orig) {
		$t.css({ 'max-height': orig.style.maxHeight, 'min-height': orig.style.minHeight });
	}
	var todos = this._listaRig();
	var lista = this._filtrar(todos);
	this.$cuenta.text(lista.length + ' de ' + todos.length);
	var banderas = (Plugins.rig_skin && Plugins.rig_skin._dxccFlag) || {};
	$t.empty();
	if (!lista.length) {
		$t.append($('<tr>').append($('<td>').addClass('vacio').text(
			this.region === 'EU'
				? 'Sin spots anunciados desde Europa en esta banda (la última hora)'
				: 'Sin spots en esta banda (la última hora)')));
		return;
	}
	lista.slice(0, this.MAX_FILAS).forEach(function (s) {
		var bandera = s.dxcc && banderas[s.dxcc] ? banderas[s.dxcc] + ' ' : '';
		var contAnun = self._cont[String(s.spotter || '').toUpperCase()] || '';
		var md = self._modoSpot(s);
		var $tr = $('<tr>').addClass('owrx-rig-dx-spot')
			.toggleClass('listening', self._escuchando(s))
			.attr('title', (s.spotter ? 'de ' + s.spotter + (contAnun ? ' (' + contAnun + ')' : '') : '') +
				(s.cont ? ' · ' + s.cont : '') + (s.comment ? ': ' + s.comment : ''))
			.on('click', function () {
				// sintoniza con el modo deducido (un spot de CW sin modo entra en CW)
				var s2 = $.extend({}, s, { mode: md.m });
				try { Plugins.rig_skin.tuneTo(s.freq, Plugins.rig_skin.spotMode(s2)); } catch (e) {}
				setTimeout(function () { self._pintar(); }, 800);
			});
		$tr.append($('<td>').addClass('age').text(self._edad(s.time)));
		$tr.append($('<td>').addClass('call').text(bandera + s.call));
		$tr.append($('<td>').addClass('spotter').text(s.spotter || ''));
		$tr.append($('<td>').addClass('freq').text((s.freq / 1000000).toFixed(4)));
		$tr.append($('<td>').addClass('mode').addClass(self._claseModo(md.m))
			.toggleClass('est', md.est).text(md.m === 'DIGI' ? 'DIG' : md.m));
		if (self.comentarios) {
			// el comentario ocupa el hueco del final; el pais va en la ayuda emergente
			$tr.append($('<td>').addClass('coment').text(s.comment || ''));
		} else {
			$tr.append($('<td>').addClass('cty').text(s.cont || ''));
		}
		$t.append($tr);
	});
};

// modo del spot: el que trae el cluster o, si viene vacio (casi siempre en
// HolyCluster), deducido del comentario o del plan de bandas IARU R1.
// Devuelve { m: 'CW', est: true } (est = estimado).
Plugins.rig_dx_spotter.FT8 = [1840, 3573, 5357, 7074, 10136, 14074, 18100, 21074, 24915, 28074, 50313, 144174];
Plugins.rig_dx_spotter.FT4 = [3575, 7047, 10140, 14080, 18104, 21140, 24919, 28180, 50318];
// [desde, hasta, modo] en kHz; fuera de estos tramos se toma SSB
Plugins.rig_dx_spotter.PLAN = [
	[1810, 1838, 'CW'], [1838, 1843, 'DIGI'],
	[3500, 3570, 'CW'], [3570, 3600, 'DIGI'],
	[5351, 5354, 'CW'], [5354, 5366, 'DIGI'],
	[7000, 7040, 'CW'], [7040, 7060, 'DIGI'],
	[10100, 10130, 'CW'], [10130, 10150, 'DIGI'],
	[14000, 14070, 'CW'], [14070, 14100, 'DIGI'],
	[18068, 18095, 'CW'], [18095, 18111, 'DIGI'],
	[21000, 21070, 'CW'], [21070, 21151, 'DIGI'],
	[24890, 24915, 'CW'], [24915, 24931, 'DIGI'],
	[28000, 28070, 'CW'], [28070, 28225, 'DIGI'],
	[50000, 50100, 'CW'], [50300, 50400, 'DIGI'],
	[144000, 144150, 'CW'], [144500, 144794, 'FM'], [145000, 146000, 'FM'],
	[430000, 432100, 'FM'], [432100, 432150, 'CW'], [433000, 440000, 'FM']
];
Plugins.rig_dx_spotter._modoSpot = function (s) {
	var m = String(s.mode || '').toUpperCase();
	if (m) return { m: m, est: false };
	var c = String(s.comment || '').toUpperCase();
	var r = c.match(/\b(FT8|FT4|CW|SSB|USB|LSB|RTTY|PSK\d*|JT65|JT9|Q65|MSK144|FM|SSTV|JS8|OLIVIA)\b/);
	if (r) {
		m = r[1] === 'USB' || r[1] === 'LSB' ? 'SSB' : r[1];
		return { m: m, est: true };
	}
	var k = (s.freq || 0) / 1000, i;
	for (i = 0; i < this.FT8.length; i++) if (Math.abs(k - this.FT8[i]) <= 3) return { m: 'FT8', est: true };
	for (i = 0; i < this.FT4.length; i++) if (Math.abs(k - this.FT4[i]) <= 3) return { m: 'FT4', est: true };
	for (i = 0; i < this.PLAN.length; i++) {
		if (k >= this.PLAN[i][0] && k < this.PLAN[i][1]) return { m: this.PLAN[i][2], est: true };
	}
	return { m: 'SSB', est: true };
};

// clase de color segun el modo del spot
Plugins.rig_dx_spotter._claseModo = function (m) {
	m = String(m || '').toUpperCase();
	if (m === 'CW') return 'm-cw';
	if (m === 'SSB' || m === 'USB' || m === 'LSB' || m === 'PHONE') return 'm-ssb';
	if (m === 'FT8') return 'm-ft8';
	if (m === 'FT4') return 'm-ft4';
	if (m === 'FM' || m === 'NFM' || m === 'AM') return 'm-fm';
	if (/RTTY|PSK|DIGI|DATA|JT|MSK|Q65|FSK|SSTV|OLIVIA|JS8|VARA|WSPR/.test(m)) return 'm-digi';
	return m ? 'm-otro' : '';
};

Plugins.rig_dx_spotter._montar = function () {
	var self = this;
	var $orig = $('#owrx-rig-dx table.owrx-rig-dx-list:not(.ea7-dx-list)');
	if (!$orig.length || $('#owrx-rig-dx .ea7-dx-list').length) return;

	var $bar = $('<div>').addClass('ea7-dx-bar');
	var chips = {};
	['EU', 'TODOS'].forEach(function (k) {
		chips[k] = $('<span>').addClass('ea7-chip').text(k)
			.attr('title', k === 'EU' ? 'Solo spots anunciados por estaciones de Europa' : 'Spots de todo el mundo')
			.on('click', function () {
				self.region = k;
				self._guardar('ea7_dx_region', k);
				chips.EU.toggleClass('on', k === 'EU');
				chips.TODOS.toggleClass('on', k === 'TODOS');
				self._pintar();
			});
		$bar.append(chips[k]);
	});
	chips.EU.toggleClass('on', this.region === 'EU');
	chips.TODOS.toggleClass('on', this.region !== 'EU');

	var $com = $('<span>').addClass('ea7-chip').text('COMENT')
		.attr('title', 'Mostrar u ocultar los comentarios de los spots')
		.toggleClass('on', this.comentarios)
		.on('click', function () {
			self.comentarios = !self.comentarios;
			self._guardar('ea7_dx_coment', self.comentarios ? '1' : '0');
			$com.toggleClass('on', self.comentarios);
			self._pintar();
		});
	$bar.append($com);

	var $sel = $('<select>').attr('title', 'Ver solo una banda (no mueve el dial)');
	this.BANDAS.forEach(function (b) {
		$sel.append($('<option>').val(b[0]).text(b[0]));
	});
	$sel.val(this.banda).on('change', function () {
		self.banda = $sel.val();
		self._guardar('ea7_dx_banda', self.banda);
		self._pintar();
	});
	$bar.append($('<span>').text('Banda')).append($sel);
	this.$cuenta = $('<span>').addClass('ea7-cuenta');
	$bar.append(this.$cuenta);

	this.$tabla = $('<table>').addClass('owrx-rig-dx-list ea7-dx-list');
	$orig.after(this.$tabla).after($bar);
	this._pintar();
};

Plugins.rig_dx_spotter.init = function () {
	var self = this;
	this.region = this._leer('ea7_dx_region', 'TODOS');
	this.banda = this._leer('ea7_dx_banda', 'TODAS');
	this.comentarios = this._leer('ea7_dx_coment', '1') === '1';
	this._cargarCont();

	var st = document.createElement('style');
	st.id = 'rig-dx-spotter-style';
	st.textContent = this.CSS;
	document.head.appendChild(st);

	this._escuchar();
	var vueltas = 0;
	setInterval(function () {
		self._montar();
		var $w = $('#owrx-rig-dx');
		if ($w.length && $w.is(':visible')) self._pintar();
		if (self._sucio && ++vueltas % 15 === 0) { self._sucio = false; self._guardarCont(); }
	}, 2000);
	return true;
};
