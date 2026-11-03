/*
 * contador - plugin de receptor para OpenWebRX+ (EA7CL)
 *
 * Contador de visitas propio en la cabecera desplegable del receptor, sin
 * servicios externos como Flag Counter. Los datos los cuenta el propio
 * servidor (owrx/contador.py) y los deja en datos.json, junto a este fichero:
 * visitas, visitantes unicos y paises. Solo las imagenes de las banderas
 * vienen de flagcdn.com (si fallan, sale el codigo del pais).
 */
Plugins.contador = Plugins.contador || {};
Plugins.contador._version = 1.0;
Plugins.contador.no_css = true;

// --- AJUSTES ---
Plugins.contador.BANDERAS = 12;          // banderas que se muestran (filas de 4); 0 para ninguna
Plugins.contador.REFRESCO = 120000;      // milisegundos entre lecturas de datos.json
Plugins.contador.ANCHO = 200;            // ancho de la tarjeta en pixeles
Plugins.contador.ALTO = 0;               // alto en pixeles; 0 para el que necesite
Plugins.contador.DESPUES_DE = '';        // selector CSS dentro de la cabecera tras el que se coloca; '' al final

Plugins.contador._datos = null;

// textos en espanol o en ingles segun el idioma del navegador
Plugins.contador._es = /^es\b/i.test(navigator.language || '');
Plugins.contador._txt = Plugins.contador._es
	? {visitas: 'Visitas', unicos: 'únicos', paises: 'países'}
	: {visitas: 'Visits', unicos: 'unique', paises: 'countries'};

Plugins.contador._estilo = function () {
	if (document.getElementById('ea7-contador-css')) return;
	$('<style id="ea7-contador-css">').text(
		'.ea7-contador{display:inline-flex;flex-direction:column;justify-content:center;vertical-align:top;' +
		'box-sizing:border-box;margin:0 4px 4px 0;overflow:hidden;' +
		'padding:5px 8px;background:#fff;color:#111;border:1px solid #ccc;border-radius:4px;' +
		'font:12px/1.3 Arial,Helvetica,sans-serif;text-align:left;text-shadow:none}' +
		'.ea7-contador>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
		'.ea7-contador__c{display:flex;align-items:baseline;gap:8px}' +
		'.ea7-contador__t{font-weight:bold;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px}' +
		'.ea7-contador__n{font:bold 18px/1.2 Arial,Helvetica,sans-serif;color:#c00}' +
		'.ea7-contador__g{color:#555;font-size:11px}' +
		'.ea7-contador__p{display:grid;grid-template-columns:repeat(4,1fr);gap:2px 4px;margin-top:4px}' +
		'.ea7-contador__p span{display:flex;align-items:center;gap:3px;white-space:nowrap;overflow:hidden}' +
		'.ea7-contador__p img{width:16px;height:11px;border:1px solid #ddd;flex:none}' +
		'.ea7-contador__p b{font-size:10px;color:#333}'
	).appendTo('head');
};

Plugins.contador._num = function (n) {
	try { return Number(n).toLocaleString(navigator.language || 'es-ES'); } catch (e) { return String(n); }
};

Plugins.contador._nombre_pais = function (code) {
	try {
		return new Intl.DisplayNames([navigator.language || 'es'], {type: 'region'}).of(code) || code;
	} catch (e) {
		return code;
	}
};

Plugins.contador._tarjeta = function () {
	var self = this, d = this._datos, t = this._txt;
	var $c = $('<div class="ea7-contador">').css('width', this.ANCHO + 'px');
	if (this.ALTO > 0) $c.css('height', this.ALTO + 'px');
	var $cab = $('<div class="ea7-contador__c">').append($('<span class="ea7-contador__t">').text(t.visitas));
	$c.append($cab);
	if (!d) {
		$cab.append($('<span class="ea7-contador__n">').text('…'));
		return $c;
	}
	$cab.append($('<span class="ea7-contador__n">').text(this._num(d.visitas)));
	$c.append($('<div class="ea7-contador__g">').text(this._num(d.unicos) + ' ' + t.unicos +
		(d.num_paises ? ' · ' + d.num_paises + ' ' + t.paises : '')));
	var $p = $('<div class="ea7-contador__p">');
	(d.paises || []).filter(function (p) { return /^[A-Z]{2}$/.test(p[0]); }).slice(0, this.BANDERAS).forEach(function (p) {
		var $i = $('<span>').attr('title', self._nombre_pais(p[0]));
		$i.append($('<img alt="">').attr('src', 'https://flagcdn.com/' + p[0].toLowerCase() + '.svg')
			.on('error', function () { $(this).replaceWith($('<b>').text(p[0])); }));
		$i.append($('<b>').text(self._num(p[1])));
		$p.append($i);
	});
	if ($p.children().length) $c.append($p);
	return $c;
};

Plugins.contador._colocar = function () {
	var $desc = $('.webrx-rx-photo-desc');
	if (!$desc.length || $desc.find('.ea7-contador').length) return;
	var $t = this._tarjeta();
	var $tras = this.DESPUES_DE ? $desc.find(this.DESPUES_DE).last() : $();
	if ($tras.length) $t.insertAfter($tras);
	else $desc.append($t);
};

Plugins.contador._actualizar = function () {
	var self = this;
	$('.webrx-rx-photo-desc .ea7-contador').each(function () { $(this).replaceWith(self._tarjeta()); });
};

Plugins.contador._leer = function () {
	var self = this;
	return fetch('static/plugins/receiver/contador/datos.json?t=' + Date.now(), {cache: 'no-store'})
		.then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
		.then(function (d) {
			if (typeof d.visitas !== 'number') throw new Error('datos incorrectos');
			self._datos = d;
			self._actualizar();
		})
		.catch(function () { /* se queda con los ultimos datos; la proxima lectura lo reintenta */ });
};

Plugins.contador.init = function () {
	var self = this;
	this._estilo();
	var $desc = $('.webrx-rx-photo-desc');
	if (!$desc.length) return false;
	// OpenWebRX reescribe la cabecera cada vez que cambian los datos del receptor
	new MutationObserver(function () { self._colocar(); })
		.observe($desc[0], {childList: true, subtree: true});
	this._colocar();
	this._leer();
	setInterval(function () { self._leer(); }, this.REFRESCO);
	return true;
};
