/*
 * mi_ip - plugin local de EA7CL para OpenWebRX+
 *
 * Sustituye en la cabecera desplegable el recuadro de wieistmeineip.de
 * (dejo de funcionar en octubre de 2026) por una tarjeta propia con la IP
 * del oyente, su pais con bandera, la ciudad, el navegador y el idioma.
 *
 * La IP y el pais los da el primer servicio que responda: geojs, ipwho.is
 * o country.is (los mismos que usa el plugin listeners). El navegador y el
 * idioma salen del propio navegador. No hace falta tocar la configuracion:
 * el plugin busca el recuadro antiguo y se pone en su sitio, tambien cuando
 * OpenWebRX vuelve a escribir la cabecera.
 */
Plugins.mi_ip = Plugins.mi_ip || {};
Plugins.mi_ip._version = 0.2;
Plugins.mi_ip.no_css = true;

// --- AJUSTES ---
// recuadro al que sustituye (cualquier imagen cuya direccion contenga esto)
Plugins.mi_ip.BUSCAR = 'wieistmeineip';
Plugins.mi_ip.ANCHO = 170;          // ancho de la tarjeta en pixeles
Plugins.mi_ip.ALTO = 127;           // alto si no se puede medir la pastilla de Meteoclimatic
Plugins.mi_ip.ESPERA = 5000;        // milisegundos maximos por servicio

// misma altura que la pastilla de Meteoclimatic, para que todo quede alineado
Plugins.mi_ip._alto = function () {
	var h = $('.webrx-rx-photo-desc img[src*="meteoclimatic"]').outerHeight();
	return h > 40 ? Math.round(h) : this.ALTO;
};

Plugins.mi_ip._datos = null;        // {ip, pais, ciudad} una vez conocidos

Plugins.mi_ip._estilo = function () {
	if (document.getElementById('ea7-mi-ip-css')) return;
	$('<style id="ea7-mi-ip-css">').text(
		'.ea7-mi-ip{display:inline-flex;flex-direction:column;justify-content:center;vertical-align:top;' +
		'box-sizing:border-box;margin:0 4px 4px 0;overflow:hidden;' +
		'padding:6px 8px;background:#fff;color:#111;border:1px solid #ccc;border-radius:4px;' +
		'font:12px/1.35 Arial,Helvetica,sans-serif;text-align:left;text-shadow:none}' +
		'.ea7-mi-ip>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
		'.ea7-mi-ip__f span{overflow:hidden;text-overflow:ellipsis}' +
		'.ea7-mi-ip__t{font-weight:bold;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px}' +
		'.ea7-mi-ip__ip{font:bold 14px/1.3 Consolas,"Courier New",monospace;color:#c00;margin:1px 0 3px}' +
		'.ea7-mi-ip__f{display:flex;align-items:center;gap:5px}' +
		'.ea7-mi-ip__f img{width:20px;height:15px;border:1px solid #ddd;flex:none}' +
		'.ea7-mi-ip__g{color:#555;font-size:11px}'
	).appendTo('head');
};

Plugins.mi_ip._con_espera = function (url) {
	var ctl = window.AbortController ? new AbortController() : null;
	var t = ctl ? setTimeout(function () { ctl.abort(); }, this.ESPERA) : null;
	return fetch(url, {cache: 'no-store', signal: ctl ? ctl.signal : undefined})
		.then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
		.finally(function () { if (t) clearTimeout(t); });
};

// IP, pais y ciudad: el primer servicio que conteste
Plugins.mi_ip._consultar = function () {
	var self = this;
	var ok = function (ip, pais, ciudad) {
		if (!ip) throw new Error('sin ip');
		pais = String(pais || '').toUpperCase();
		return {ip: String(ip), pais: /^[A-Z]{2}$/.test(pais) ? pais : '', ciudad: String(ciudad || '')};
	};
	return this._con_espera('https://get.geojs.io/v1/ip/geo.json')
		.then(function (d) { return ok(d.ip, d.country_code, d.city); })
		.catch(function () {
			return self._con_espera('https://ipwho.is/?fields=ip,city,country_code,success')
				.then(function (d) { return ok(d.success !== false && d.ip, d.country_code, d.city); });
		})
		.catch(function () {
			return self._con_espera('https://api.country.is/')
				.then(function (d) { return ok(d.ip, d.country, ''); });
		});
};

Plugins.mi_ip._nombre_pais = function (code) {
	try {
		return new Intl.DisplayNames([navigator.language || 'es'], {type: 'region'}).of(code) || code;
	} catch (e) {
		return code;
	}
};

// navegador y sistema a partir del propio navegador
Plugins.mi_ip._navegador = function () {
	var ua = navigator.userAgent || '';
	var nav = 'Navegador desconocido', m;
	var lista = [
		['Edge', /Edg(?:e|A|iOS)?\/(\d+)/], ['Opera', /(?:OPR|Opera)\/(\d+)/],
		['Samsung Internet', /SamsungBrowser\/(\d+)/], ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
		['Chrome', /(?:Chrome|CriOS)\/(\d+)/], ['Safari', /Version\/(\d+).*Safari\//]
	];
	for (var i = 0; i < lista.length; i++) {
		if ((m = ua.match(lista[i][1]))) { nav = lista[i][0] + ' ' + m[1]; break; }
	}
	var so = '';
	if ((m = ua.match(/Windows NT ([\d.]+)/))) so = 'Windows' + (m[1] === '10.0' ? ' 10/11' : '');
	else if ((m = ua.match(/Android ([\d.]+)/))) so = 'Android ' + m[1];
	else if ((m = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)/))) so = 'iOS ' + m[1];
	else if (/Mac OS X/.test(ua)) so = 'macOS';
	else if (/CrOS/.test(ua)) so = 'ChromeOS';
	else if (/Linux/.test(ua)) so = 'Linux';
	return so ? nav + ' · ' + so : nav;
};

Plugins.mi_ip._tarjeta = function () {
	var d = this._datos;
	var $c = $('<div class="ea7-mi-ip">').css({width: this.ANCHO + 'px', height: this._alto() + 'px'});
	$c.append($('<div class="ea7-mi-ip__t">').text('Tu conexión'));
	if (!d) {
		$c.append($('<div class="ea7-mi-ip__ip">').text('…'));
		$c.append($('<div class="ea7-mi-ip__g">').text('Consultando tu IP'));
	} else if (d.error) {
		$c.append($('<div class="ea7-mi-ip__ip">').text('IP no disponible'));
	} else {
		$c.append($('<div class="ea7-mi-ip__ip">').text(d.ip).attr('title', d.ip));
		if (d.pais) {
			var $f = $('<div class="ea7-mi-ip__f">');
			$f.append($('<img alt="">')
				.attr('src', 'https://flagcdn.com/' + d.pais.toLowerCase() + '.svg')
				.on('error', function () { $(this).remove(); }));
			$f.append($('<span>').text(this._nombre_pais(d.pais) + (d.ciudad ? ' · ' + d.ciudad : '')));
			$c.append($f);
		}
	}
	$c.append($('<div class="ea7-mi-ip__g">').text(this._navegador()));
	var idioma = navigator.language || '';
	if (idioma) $c.append($('<div class="ea7-mi-ip__g">').text('Idioma: ' + idioma));
	return $c;
};

// pone la tarjeta en lugar del recuadro antiguo; solo cambia algo si el recuadro esta
Plugins.mi_ip._colocar = function () {
	var self = this;
	$('.webrx-rx-photo-desc img').filter(function () {
		return (this.getAttribute('src') || '').indexOf(self.BUSCAR) >= 0;
	}).each(function () {
		var $viejo = $(this).closest('a').length ? $(this).closest('a') : $(this);
		$viejo.replaceWith(self._tarjeta());
	});
};

// redibuja las tarjetas ya puestas (cuando llegan los datos)
Plugins.mi_ip._actualizar = function () {
	var self = this;
	$('.webrx-rx-photo-desc .ea7-mi-ip').each(function () { $(this).replaceWith(self._tarjeta()); });
};

Plugins.mi_ip.init = function () {
	var self = this;
	this._estilo();
	var $desc = $('.webrx-rx-photo-desc');
	if (!$desc.length) return false;

	// OpenWebRX reescribe la cabecera cada vez que cambian los datos del receptor:
	// si vuelve a aparecer el recuadro antiguo, se sustituye otra vez
	new MutationObserver(function () { self._colocar(); })
		.observe($desc[0], {childList: true, subtree: true});
	this._colocar();
	// cuando termina de cargar la pastilla de Meteoclimatic se iguala la altura
	$desc[0].addEventListener('load', function (e) {
		if (/meteoclimatic/.test(e.target.src || '')) $desc.find('.ea7-mi-ip').css('height', self._alto() + 'px');
	}, true);

	// una sola consulta por pestaña
	var guardado = null;
	try { guardado = JSON.parse(sessionStorage.getItem('ea7_mi_ip') || 'null'); } catch (e) {}
	if (guardado && guardado.ip) {
		this._datos = guardado;
		this._actualizar();
	} else {
		this._consultar().then(function (d) {
			self._datos = d;
			try { sessionStorage.setItem('ea7_mi_ip', JSON.stringify(d)); } catch (e) {}
		}).catch(function () {
			self._datos = {error: true};
		}).then(function () { self._actualizar(); });
	}
	return true;
};
