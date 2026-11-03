/*
 * rig_skin_es - plugin local de EA7CL para OpenWebRX+
 *
 * Traduce al espanol los textos y las ayudas emergentes del plugin rig_skin
 * mientras se muestran en pantalla. No modifica rig_skin, asi que sus
 * actualizaciones no borran la traduccion; un texto nuevo de una version
 * futura simplemente saldra en ingles hasta anadirlo a la lista TEXTOS.
 *
 * Las siglas habituales de un equipo (MUTE, SQL, RIT, NR, LOCK, SCAN, VFO,
 * DX, SAT, WATCH...) se dejan como estan. Los textos dibujados dentro de
 * graficos (canvas) no se pueden traducir desde aqui.
 */
Plugins.rig_skin_es = Plugins.rig_skin_es || {};
Plugins.rig_skin_es._version = 0.1;
Plugins.rig_skin_es.no_css = true;

Plugins.rig_skin_es.AMBITO = '[id^="owrx-rig"],[class*="owrx-rig"],[id^="plugin-window-rig-"],[id^="plugin-button-rig-"]';

Plugins.rig_skin_es.TEXTOS = {
	// ventanas y rotulos
	'SAT TRACKING': 'SEGUIMIENTO SAT',
	'BAND SCOPE': 'VISOR DE BANDA',
	'ENTER FREQUENCY': 'INTRODUCIR FRECUENCIA',
	'CLEAR': 'BORRAR',
	'ENTER': 'INTRO',
	'HIDE': 'OCULTAR',
	'DAY': 'DÍA',
	'NIGHT': 'NOCHE',
	'NOW': 'AHORA',
	'NEXT PASSES (UTC)': 'PRÓXIMOS PASES (UTC)',
	'PASSES over this receiver - TLE: celestrak.org': 'PASES sobre este receptor - TLE: celestrak.org',
	'BAND CONDITIONS - est. from NOAA SWPC': 'CONDICIONES DE BANDA - est. de NOAA SWPC',
	'NCDXF/IARU BEACONS - click to listen': 'BALIZAS NCDXF/IARU - clic para escuchar',
	'MUF MAP - prop.kc2g.com': 'MAPA MUF - prop.kc2g.com',
	'→| NARROW': '→| ESTRECHO',
	'|← WIDE': '|← ANCHO',
	'Amateur radio satellites': 'Satélites de radioaficionados',
	'Weather satellites': 'Satélites meteorológicos',
	'note': 'nota',

	// mensajes
	'loading...': 'cargando...',
	'loading orbits...': 'cargando órbitas...',
	'out of range': 'fuera de rango',
	'orbit library unavailable': 'biblioteca de órbitas no disponible',
	'TLE download failed': 'fallo al descargar los TLE',
	'TLE download failed, retrying...': 'fallo al descargar los TLE, reintentando...',
	'receiver position not configured': 'posición del receptor sin configurar',
	'no passes: receiver position not configured': 'sin pases: posición del receptor sin configurar',
	'waiting for NOAA data...': 'esperando datos de NOAA...',
	'NOAA data unavailable': 'datos de NOAA no disponibles',
	'scroll to zoom, drag to pan, click to tune': 'rueda: zoom · arrastrar: mover · clic: sintonizar',
	'click a bird for its path, click again to tune': 'clic en un satélite: ver su órbita · otro clic: sintonizar',

	// ayudas emergentes
	'Close': 'Cerrar',
	'Download the orbits again': 'Volver a descargar las órbitas',
	'DX cluster spots': 'Spots del DX cluster',
	'Band activity: spots per band': 'Actividad por bandas: spots en cada banda',
	'NCDXF/IARU beacons on the map; colored by the beacon radar grades, click one to listen': 'Balizas NCDXF/IARU en el mapa, coloreadas según la valoración del radar de balizas; clic en una para escucharla',
	'Live satellite tracking map': 'Mapa de seguimiento de satélites en directo',
	'Add a watch window on the tuned frequency: a small live waterfall, press its speaker to listen there (right-click: hide or show all watches)': 'Añade una ventana de vigilancia en la frecuencia sintonizada: una pequeña cascada en directo; pulsa su altavoz para escuchar ahí (clic derecho: ocultar o mostrar todas)',
	'Click to listen, double-click to type, scroll to step': 'Clic para escuchar, doble clic para escribir, rueda para subir o bajar',
	'Listen here; press again to go back': 'Escuchar aquí; pulsa otra vez para volver',
	'Click to listen, double-click to add a note': 'Clic para escuchar, doble clic para añadir una nota',
	'rig skin releases on GitHub': 'Versiones de rig skin en GitHub',
	'Switch the active VFO (right-click: copy active VFO to the other)': 'Cambiar de VFO activo (clic derecho: copiar el VFO activo al otro)',
	'Dual watch: listen to the other VFO while it has activity (right-click: sensitivity)': 'Doble escucha: oír el otro VFO cuando tenga actividad (clic derecho: sensibilidad)',
	'Tune the VFO here': 'Sintonizar el VFO aquí',
	'Tune here in CW': 'Sintonizar aquí en CW',
	'Previous view': 'Vista anterior',
	'Next view': 'Vista siguiente',
	'Switch the layout (click: switch and keep, right-click: automatic)': 'Cambiar la disposición (clic: cambiar y mantener; clic derecho: automática)',
	'Drag to move the rig; double-click to snap back': 'Arrastra para mover el equipo; doble clic para devolverlo a su sitio',
	'Zoom waterfall out': 'Alejar la cascada',
	'Zoom waterfall in': 'Acercar la cascada',
	'Page waterfall down (right-click: move the receiver window)': 'Desplazar la cascada hacia abajo en frecuencia (clic derecho: mover la ventana del receptor)',
	'Page waterfall up (right-click: move the receiver window)': 'Desplazar la cascada hacia arriba en frecuencia (clic derecho: mover la ventana del receptor)',
	'Click the ms/Div label to change the scope timebase': 'Pulsa la etiqueta ms/Div para cambiar la base de tiempos del osciloscopio',
	'Toggle audio scope (right-click: bar / needle meter; drag the SQL marker to set the squelch)': 'Mostrar u ocultar el osciloscopio de audio (clic derecho: medidor de barra o de aguja; arrastra la marca SQL para ajustar el silenciador)',
	'Noise reduction on/off': 'Reducción de ruido: activar o desactivar',
	'Lock the dial': 'Bloquear el dial',
	'Tuning step': 'Paso de sintonía',
	'Scan bookmarks, stop where the squelch opens': 'Explorar los marcadores y parar donde se abra el silenciador',
	'Squelch on/off (level is set automatically)': 'Silenciador: activar o desactivar (el nivel se ajusta solo)',
	'Write a bookmark here (right-click: search bookmarks)': 'Guardar un marcador aquí (clic derecho: buscar marcadores)',
	'HF propagation screen': 'Pantalla de propagación en HF',
	'Satellite passes screen': 'Pantalla de pases de satélites',
	'Auto tune: snap to the nearest signal': 'Sintonía automática: ir a la señal más cercana',
	'Clarifier: arrows nudge RX while on (right-click: step)': 'Clarificador: con él activo, las flechas mueven la recepción (clic derecho: paso)',
	'Mute audio': 'Silenciar el audio',
	'VFO dial: drag, flick or scroll to tune': 'Dial del VFO: arrastra, lanza o usa la rueda para sintonizar',

	// ubicaciones de las balizas NCDXF/IARU
	'United Nations NY': 'Naciones Unidas NY',
	'Canada': 'Canadá',
	'USA West': 'EE. UU. Oeste',
	'Hawaii': 'Hawái',
	'New Zealand': 'Nueva Zelanda',
	'Japan': 'Japón',
	'Russia': 'Rusia',
	'South Africa': 'Sudáfrica',
	'Kenya': 'Kenia',
	'Finland': 'Finlandia',
	'Peru': 'Perú',
	'New York': 'Nueva York',
	'W. USA': 'O. EE.UU.',
	'N.Zealand': 'N.Zelanda',
	'S.Africa': 'Sudáfrica'
};

// Textos con una parte variable.
Plugins.rig_skin_es.REGLAS = [
	[/^Grade all 18 beacons on (.+?) by what this receiver hears \(3 min cycle\)$/,
		'Valorar las 18 balizas en $1 según lo que oye este receptor (ciclo de 3 min)']
];

Plugins.rig_skin_es.traducir = function (texto) {
	if (!texto || texto.length > 200) return null;
	var limpio = texto.trim();
	if (!limpio) return null;
	var nuevo = null;
	if (Object.prototype.hasOwnProperty.call(this.TEXTOS, limpio)) {
		nuevo = this.TEXTOS[limpio];
	} else {
		for (var i = 0; i < this.REGLAS.length; i++) {
			if (this.REGLAS[i][0].test(limpio)) {
				nuevo = limpio.replace(this.REGLAS[i][0], this.REGLAS[i][1]);
				break;
			}
		}
	}
	if (nuevo === null || nuevo === limpio) return null;
	return texto.replace(limpio, nuevo); // conserva los espacios de alrededor
};

Plugins.rig_skin_es._dentro = function (nodo) {
	var elemento = nodo && nodo.nodeType === 1 ? nodo : (nodo ? nodo.parentElement : null);
	return !!(elemento && elemento.closest && elemento.closest(this.AMBITO));
};

Plugins.rig_skin_es._texto = function (nodo) {
	var nuevo = this.traducir(nodo.nodeValue);
	if (nuevo !== null && this._dentro(nodo)) nodo.nodeValue = nuevo;
};

Plugins.rig_skin_es._atributos = function (elemento) {
	var self = this;
	['title', 'placeholder'].forEach(function (nombre) {
		if (!elemento.hasAttribute || !elemento.hasAttribute(nombre)) return;
		var nuevo = self.traducir(elemento.getAttribute(nombre));
		if (nuevo !== null && self._dentro(elemento)) elemento.setAttribute(nombre, nuevo);
	});
};

Plugins.rig_skin_es._recorrer = function (raiz) {
	var self = this;
	if (!raiz) return;
	if (raiz.nodeType === 3) { this._texto(raiz); return; }
	if (raiz.nodeType !== 1) return;
	this._atributos(raiz);
	var elementos = raiz.querySelectorAll('[title],[placeholder]');
	for (var i = 0; i < elementos.length; i++) this._atributos(elementos[i]);
	var paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null);
	var pendientes = [], nodo;
	while ((nodo = paseo.nextNode())) pendientes.push(nodo);
	pendientes.forEach(function (n) { self._texto(n); });
};

Plugins.rig_skin_es.init = function () {
	var self = this;
	if (this._observador || typeof MutationObserver === 'undefined') return true;
	this._observador = new MutationObserver(function (cambios) {
		for (var i = 0; i < cambios.length; i++) {
			var cambio = cambios[i];
			try {
				if (cambio.type === 'characterData') {
					self._texto(cambio.target);
				} else if (cambio.type === 'attributes') {
					self._atributos(cambio.target);
				} else {
					for (var j = 0; j < cambio.addedNodes.length; j++) self._recorrer(cambio.addedNodes[j]);
				}
			} catch (error) { /* la traduccion nunca debe estorbar */ }
		}
	});
	this._observador.observe(document.body, {
		subtree: true, childList: true, characterData: true,
		attributes: true, attributeFilter: ['title', 'placeholder']
	});
	try { this._recorrer(document.body); } catch (error) { /* idem */ }
	return true;
};
