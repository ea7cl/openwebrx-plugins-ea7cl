/*
 * scan_recordado - plugin de receptor para OpenWebRX+ (EA7CL)
 *
 * Cada navegador recuerda qué memorias (marcadores) ve y cuáles entran en
 * el SCAN, y lo vuelve a aplicar cada vez que llegan las memorias: al abrir
 * el SDR, al cambiar de perfil...
 *  - Clic derecho sobre una memoria (toggle_scannable de 0xAF): activa o
 *    quita el scan; antes se perdía al recargar, ahora se recuerda.
 *  - Botón MEM: ventana con las memorias del perfil y dos casillas, Ver y
 *    Scan. Una memoria oculta desaparece del waterfall y del scan.
 * Todo se guarda solo en el navegador del oyente (localStorage), así que
 * cada uno tiene su propia lista sin afectar a los demás.
 *
 * No modifica toggle_scannable: escucha el mismo clic derecho y guarda el
 * resultado.
 */

Plugins.scan_recordado.no_css = true;
Plugins.scan_recordado._version = 1.1;

Plugins.scan_recordado._clave = 'ea7_scan_recordado';
Plugins.scan_recordado._claveOcultas = 'ea7_mem_ocultas';

// nombre de cada origen de memorias en la ventana, en este orden
Plugins.scan_recordado.ORIGENES = {
    server: 'Memorias del receptor',
    local: 'Mis memorias (MW)',
    dial_frequencies: 'Plan de bandas'
};

// listas completas tal como llegan, antes de quitar las ocultas
Plugins.scan_recordado._todas = {};

Plugins.scan_recordado._leer = function (clave) {
    try { return JSON.parse(localStorage.getItem(clave || this._clave) || 'null') || {}; } catch (e) { return {}; }
};
Plugins.scan_recordado._guardar = function (marcas, clave) {
    try { localStorage.setItem(clave || this._clave, JSON.stringify(marcas)); } catch (e) {}
};

// una memoria se reconoce por su origen (server, local...), frecuencia y nombre
Plugins.scan_recordado._id = function (source, b) {
    return source + '|' + Number(b.frequency) + '|' + b.name;
};

// pone a cada memoria la marca de scan que eligió este oyente
Plugins.scan_recordado._aplicar = function (lista, source) {
    var marcas = this._leer();
    var me = this;
    (lista || []).forEach(function (b) {
        var m = marcas[me._id(source, b)];
        if (typeof m === 'boolean') b.scannable = m;
    });
};

Plugins.scan_recordado._oculta = function (source, b, ocultas) {
    return !!(ocultas || this._leer(this._claveOcultas))[this._id(source, b)];
};

// vuelve a dibujar las memorias de un origen con las marcas actuales
Plugins.scan_recordado._redibujar = function (source) {
    var t = this._todas[source];
    if (t) bookmarks.replace_bookmarks(t.lista, source, t.editable);
    if (typeof scanner !== 'undefined' && scanner && scanner.isRunning()) {
        scanner.stop();
        scanner.start();
    }
};

Plugins.scan_recordado._marcar = function (source, b, scan) {
    var marcas = this._leer();
    marcas[this._id(source, b)] = !!scan;
    this._guardar(marcas);
    b.scannable = !!scan;
};

Plugins.scan_recordado._ver = function (source, b, ver) {
    var ocultas = this._leer(this._claveOcultas);
    if (ver) delete ocultas[this._id(source, b)];
    else ocultas[this._id(source, b)] = true;
    this._guardar(ocultas, this._claveOcultas);
};

// --- ventana MEM ---

Plugins.scan_recordado._css =
    '#plugin-window-mem{width:380px;height:460px}' +
    '.ea7-mem{display:flex;flex-direction:column;height:100%;font:13px Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#eef1f4}' +
    '.ea7-mem__barra{display:flex;flex-wrap:wrap;gap:4px;padding:6px;background:#1b242c}' +
    '.ea7-mem__barra input{flex:1 1 100%;box-sizing:border-box;padding:3px 6px;border:1px solid #5d6873;border-radius:4px;background:#11171c;color:#eef1f4}' +
    '.ea7-mem__barra button{flex:1;padding:3px 4px;border:1px solid #5d6873;border-radius:6px;background:#2c343c;color:#e3e8ec;cursor:pointer;font-size:12px}' +
    '.ea7-mem__barra button:hover{filter:brightness(1.3)}' +
    '.ea7-mem__lista{flex:1;overflow-y:auto;padding:2px 4px}' +
    '.ea7-mem table{width:100%;border-collapse:collapse}' +
    '.ea7-mem th{position:sticky;top:0;background:#26303a;color:#ffd166;text-align:left;padding:3px 4px;font-weight:600}' +
    '.ea7-mem th.c,.ea7-mem td.c{text-align:center;width:38px}' +
    '.ea7-mem td{padding:2px 4px;border-bottom:1px solid #2a333b}' +
    '.ea7-mem td.n{cursor:pointer;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ea7-mem td.n:hover{color:#9fd4ff}' +
    '.ea7-mem td.f{color:#9fd4ff;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.ea7-mem td.m{color:#b9c3cb;font-size:11px;text-transform:uppercase}' +
    '.ea7-mem tr.oculta td.n,.ea7-mem tr.oculta td.f{opacity:.45}' +
    '.ea7-mem input[type=checkbox]{width:16px;height:16px;cursor:pointer}' +
    '.ea7-mem__pie{padding:4px 8px;background:#1b242c;color:#b9c3cb;font-size:12px}';

Plugins.scan_recordado._crearVentana = function () {
    var me = this;
    $('<style id="ea7-mem-style"></style>').text(this._css).appendTo('head');

    Plugins.addButton('mem', 'MEM', function () {
        Plugins.toggleWindow('mem');
        me._pintar();
    });
    Plugins.addWindow('mem', 'Memorias',
        '<div class="ea7-mem">' +
            '<div class="ea7-mem__barra">' +
                '<input type="search" class="ea7-mem__buscar" placeholder="Buscar memoria...">' +
                '<button data-accion="ver">Ver todas</button>' +
                '<button data-accion="scan">Scan todas</button>' +
                '<button data-accion="noscan">Scan ninguna</button>' +
                '<button data-accion="restaurar" title="Volver a como vienen del receptor">Restaurar</button>' +
            '</div>' +
            '<div class="ea7-mem__lista"></div>' +
            '<div class="ea7-mem__pie">Pulsa un nombre para sintonizarlo. Se guarda solo en este navegador.</div>' +
        '</div>');

    var $w = $('#plugin-window-mem');
    $w.on('input', '.ea7-mem__buscar', function () { me._pintar(); });

    // casillas Ver y Scan
    $w.on('change', 'input[type=checkbox]', function () {
        var $tr = $(this).closest('tr');
        var source = $tr.data('source');
        var b = me._todas[source].lista[$tr.data('i')];
        if ($(this).data('col') === 'ver') me._ver(source, b, this.checked);
        else me._marcar(source, b, this.checked);
        me._redibujar(source);
    });

    // pulsar el nombre sintoniza la memoria
    $w.on('click', 'td.n', function () {
        var $tr = $(this).closest('tr');
        var b = me._todas[$tr.data('source')].lista[$tr.data('i')];
        if (window.UI && UI.tuneBookmark) UI.tuneBookmark(b);
    });

    // botones de la barra: actúan sobre las memorias que se ven en la lista
    $w.on('click', '.ea7-mem__barra button', function () {
        var accion = $(this).data('accion');
        var marcas = me._leer();
        var ocultas = me._leer(me._claveOcultas);
        var tocados = {};
        me._filas().forEach(function (f) {
            var id = me._id(f.source, f.b);
            if (accion === 'ver') delete ocultas[id];
            else if (accion === 'scan' || accion === 'noscan') {
                marcas[id] = (accion === 'scan');
                f.b.scannable = marcas[id];
            } else if (accion === 'restaurar') {
                delete marcas[id];
                delete ocultas[id];
                if (typeof f.b._scanOriginal === 'boolean') f.b.scannable = f.b._scanOriginal;
            }
            tocados[f.source] = true;
        });
        me._guardar(marcas);
        me._guardar(ocultas, me._claveOcultas);
        Object.keys(tocados).forEach(function (s) { me._redibujar(s); });
    });
};

// memorias del perfil que encajan con la búsqueda, ordenadas por origen
Plugins.scan_recordado._filas = function () {
    var me = this;
    var texto = String($('#plugin-window-mem .ea7-mem__buscar').val() || '').toLowerCase();
    var filas = [];
    var origenes = Object.keys(this.ORIGENES);
    Object.keys(this._todas).forEach(function (s) { if (origenes.indexOf(s) < 0) origenes.push(s); });
    origenes.forEach(function (source) {
        var t = me._todas[source];
        if (!t) return;
        t.lista.forEach(function (b, i) {
            if (texto && String(b.name).toLowerCase().indexOf(texto) < 0) return;
            filas.push({ source: source, b: b, i: i });
        });
    });
    return filas;
};

Plugins.scan_recordado._pintar = function () {
    var $lista = $('#plugin-window-mem .ea7-mem__lista');
    if (!$lista.length || !$lista.is(':visible')) return;
    var me = this;
    var ocultas = this._leer(this._claveOcultas);
    var esc = Utils.htmlEscape;
    var html = '';
    var actual = null;
    this._filas().forEach(function (f) {
        if (f.source !== actual) {
            actual = f.source;
            html += (html ? '</table>' : '') +
                '<table><tr><th>' + esc(me.ORIGENES[actual] || actual) + '</th><th></th><th></th>' +
                '<th class="c">Ver</th><th class="c">Scan</th></tr>';
        }
        var oculta = me._oculta(f.source, f.b, ocultas);
        html += '<tr data-source="' + esc(f.source) + '" data-i="' + f.i + '"' + (oculta ? ' class="oculta"' : '') + '>' +
            '<td class="n" title="' + esc(f.b.name) + '">' + esc(f.b.name) + '</td>' +
            '<td class="f">' + (Number(f.b.frequency) / 1e6).toFixed(4) + '</td>' +
            '<td class="m">' + esc(f.b.modulation || '') + '</td>' +
            '<td class="c"><input type="checkbox" data-col="ver"' + (oculta ? '' : ' checked') + '></td>' +
            '<td class="c"><input type="checkbox" data-col="scan"' + (f.b.scannable ? ' checked' : '') + '></td>' +
            '</tr>';
    });
    $lista.html(html ? html + '</table>' : '<p style="padding:8px">No hay memorias en este perfil.</p>');
};

Plugins.scan_recordado.init = function () {
    if (!Plugins.isLoaded('utils', 0.4)) {
        console.error('scan_recordado necesita el plugin "utils >= 0.4".');
        return false;
    }
    var me = this;

    // el clic derecho de toggle_scannable corta la propagación, así que se
    // escucha en fase de captura y se lee el resultado justo después
    var cont = document.getElementById('openwebrx-bookmarks-container');
    if (cont) cont.addEventListener('contextmenu', function (e) {
        var b = $(e.target).closest('.bookmark');
        if (!b.length) return;
        setTimeout(function () {
            var d = b.data();
            if (!d || !d.source || !d.toggle_scannable) return;
            var marcas = me._leer();
            marcas[me._id(d.source, d)] = !!d.scannable;
            me._guardar(marcas);
            me._pintar();
        }, 0);
    }, true);

    Plugins.utils.on_ready(function () {
        // cada vez que llegan memorias, antes de dibujarlas: guardar la lista
        // completa, aplicar las marcas de scan y quitar las ocultas
        Plugins.utils.wrap_func(
            'replace_bookmarks',
            function (orig, thisArg, args) {
                var lista = args[0] || [];
                var source = args[1];
                var ocultas = me._leer(me._claveOcultas);
                lista.forEach(function (b) {
                    if (typeof b._scanOriginal !== 'boolean') b._scanOriginal = !!b.scannable;
                });
                me._aplicar(lista, source);
                me._todas[source] = { lista: lista, editable: args[2] };
                args[0] = lista.filter(function (b) { return !me._oculta(source, b, ocultas); });
                return true;
            },
            function () { me._pintar(); },
            bookmarks
        );

        if (typeof Plugins.addButton === 'function' && typeof Plugins.addWindow === 'function') {
            me._crearVentana();
        }

        // las que ya estaban cargadas antes de este plugin
        Object.keys(bookmarks.bookmarks).forEach(function (source) {
            var lista = bookmarks.bookmarks[source];
            if (!lista || !lista.length) return;
            bookmarks.replace_bookmarks(lista, source, lista[0].editable);
        });
    });

    return true;
};
