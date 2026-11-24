/*
 * banderas_emoji - plugin local de EA7CL para OpenWebRX+
 *
 * Chrome, Edge y demas navegadores basados en Chromium en Windows no traen
 * dibujos para las banderas emoji (🇪🇸 sale como "ES"). Firefox si, porque
 * lleva su propia fuente. Este plugin, solo en los navegadores que no las
 * pintan, carga una fuente pequena con las banderas (Twemoji Country
 * Flags, ~77 kB, licencias MIT / CC-BY 4.0 de TalkJS y Twemoji) y la pone
 * delante en los textos que llevan banderas: perfiles, titulo, ventanas...
 * La fuente solo se usa para las banderas; el resto del texto no cambia.
 */
Plugins.banderas_emoji = Plugins.banderas_emoji || {};
Plugins.banderas_emoji._version = 0.2;
Plugins.banderas_emoji.no_css = true;

Plugins.banderas_emoji.FUENTE = 'Twemoji Country Flags';
Plugins.banderas_emoji.URL =
	'https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1.8/dist/TwemojiCountryFlags.woff2';

// deteccion (adaptada de country-flag-emoji-polyfill, MIT): pinta el emoji en
// 1 pixel en blanco y en negro; si sale igual y con color, el navegador lo sabe pintar
Plugins.banderas_emoji._pinta = function (texto) {
	try {
		var c = document.createElement('canvas');
		c.width = c.height = 1;
		var ctx = c.getContext('2d', { willReadFrequently: true });
		ctx.textBaseline = 'top';
		ctx.font = '100px "Twemoji Mozilla","Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif';
		ctx.scale(0.01, 0.01);
		var color = function (col) {
			ctx.clearRect(0, 0, 100, 100);
			ctx.fillStyle = col;
			ctx.fillText(texto, 0, 0);
			return ctx.getImageData(0, 0, 1, 1).data.join(',');
		};
		var b = color('#fff'), n = color('#000');
		return b === n && n.indexOf('0,0,0,') !== 0;
	} catch (e) { return true; }
};

// pone la fuente de banderas delante en cada elemento con banderas
Plugins.banderas_emoji._RE = /[\uD83C][\uDDE6-\uDDFF]/;
Plugins.banderas_emoji._aplicar = function () {
	var self = this;
	var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
	var n, el;
	while ((n = w.nextNode())) {
		if (!self._RE.test(n.nodeValue)) continue;
		el = n.parentElement;
		if (!el || el.getAttribute('data-ea7-bandera')) continue;
		self._fuente(el);
		// en los desplegables, tambien el propio select (texto elegido)
		if (el.tagName === 'OPTION' || el.tagName === 'OPTGROUP') {
			var sel = el.closest('select');
			if (sel && !sel.getAttribute('data-ea7-bandera')) self._fuente(sel);
		}
	}
	// el titulo de la pestana no se puede cambiar de fuente (lo pinta el navegador)
};
Plugins.banderas_emoji._fuente = function (el) {
	var actual = window.getComputedStyle(el).fontFamily || 'sans-serif';
	if (actual.indexOf(this.FUENTE) < 0) {
		el.style.setProperty('font-family', '"' + this.FUENTE + '", ' + actual, 'important');
	}
	el.setAttribute('data-ea7-bandera', '1');
};

// 0.2: rig_skin 0.10.22 o posterior (de George Anestopoulos, aganet) mira si
// el navegador pinta banderas y, si no, pone letras (ES, IT) en el DX cluster.
// Con la fuente de este plugin si se pintan: se le avisa para que siga
// poniendo la bandera. Solo si rig_skin ya esta cargado (crearlo antes lo
// estropearia: el cargador pensaria que ya esta y no lo cargaria).
Plugins.banderas_emoji._avisarRig = function () {
	if (window.Plugins && Plugins.rig_skin && Plugins.rig_skin._version) Plugins.rig_skin._flags = true;
};

Plugins.banderas_emoji.init = function () {
	var self = this;
	// navegadores que ya pintan las banderas (Firefox, Mac, moviles): no se hace nada
	if (!this._pinta('😊') || this._pinta('🇪🇸')) return true;

	var st = document.createElement('style');
	st.id = 'banderas-emoji-fuente';
	st.textContent = '@font-face{font-family:"' + this.FUENTE + '";' +
		'unicode-range:U+1F1E6-1F1FF,U+1F3F4,U+E0062-E0063,U+E0065,U+E0067,U+E006C,U+E006E,U+E0073-E0074,U+E0077,U+E007F;' +
		'src:url("' + this.URL + '") format("woff2");font-display:swap}' +
		// 0.2: la lista del DX cluster de rig_skin se rehace cada poco y el repaso
		// de cada 2 s no llega a ponerle la fuente: regla fija para su columna
		'\n.owrx-rig-dx-spot td.call{font-family:"' + this.FUENTE + '",Consolas,"Cascadia Mono","DejaVu Sans Mono",Menlo,monospace!important}';
	document.head.appendChild(st);

	this._avisarRig();
	this._aplicar();
	// los perfiles, ventanas y listas se crean o cambian despues: se repasa cada 2 s
	setInterval(function () { self._avisarRig(); self._aplicar(); }, 2000);
	return true;
};
