/*
 * autozoom - plugin de receptor para OpenWebRX+
 *
 * Botón AZ (junto a LST):
 * - clic: activa o desactiva el autozoom. Por defecto está desactivado y cada
 *   navegador recuerda su elección.
 * - clic derecho (o mantener pulsado en el móvil): elegir cuánto zoom hacer,
 *   de 5 % (mínimo) a 50 % (máximo).
 *
 * Con el autozoom activado:
 * - 3 s después de sintonizar una frecuencia hace zoom a la banda que la contiene.
 *   Si la banda ocupa todo o casi todo el perfil, hace el zoom elegido alrededor
 *   de la frecuencia, sin salirse de la banda.
 * - Al tocar el waterfall/escala (clic, rueda o toque) vuelve a la vista completa.
 *   Ese toque solo abre el rango. Si en 3 s no se elige otra frecuencia, vuelve el zoom.
 */

Plugins.autozoom.no_css = true;

Plugins.autozoom.DELAY_MS = 3000;          // espera antes de hacer zoom
Plugins.autozoom.MARGIN = 0.05;            // 5 % de margen a cada lado de la banda
// opciones del menú: % de zoom -> % del perfil que queda a la vista (más zoom = se ve menos)
Plugins.autozoom.ZOOMS = { 5: 50, 10: 25, 25: 10, 50: 5 };
Plugins.autozoom.DEFAULT_ZOOM = 25;

// Bandas en Hz: [nombre, inicio, fin]. IARU Región 1 + radiodifusión. Edítalas a tu gusto.
// Si una frecuencia cae en varias, se usa la más estrecha.
Plugins.autozoom.bands = [
    ['2200m', 135700, 137800],
    ['630m', 472000, 479000],
    ['Onda Media', 531000, 1602000],
    ['160m', 1810000, 2000000],
    ['120m BC', 2300000, 2495000],
    ['90m BC', 3200000, 3400000],
    ['80m', 3500000, 3800000],
    ['75m BC', 3900000, 4000000],
    ['60m BC', 4750000, 5060000],
    ['60m', 5351500, 5366500],
    ['49m BC', 5900000, 6200000],
    ['40m', 7000000, 7200000],
    ['41m BC', 7200000, 7450000],
    ['31m BC', 9400000, 9900000],
    ['30m', 10100000, 10150000],
    ['25m BC', 11600000, 12100000],
    ['22m BC', 13570000, 13870000],
    ['20m', 14000000, 14350000],
    ['19m BC', 15100000, 15800000],
    ['16m BC', 17480000, 17900000],
    ['17m', 18068000, 18168000],
    ['15m BC', 18900000, 19020000],
    ['15m', 21000000, 21450000],
    ['13m BC', 21450000, 21850000],
    ['12m', 24890000, 24990000],
    ['11m BC', 25670000, 26100000],
    ['CB', 26965000, 27405000],
    ['10m', 28000000, 29700000],
    ['6m', 50000000, 52000000],
    ['4m', 70000000, 70500000],
    ['FM', 87500000, 108000000],
    ['Aviación', 118000000, 137000000],
    ['2m', 144000000, 146000000],
    ['Marina VHF', 156000000, 162050000],
    ['70cm', 430000000, 440000000],
    ['PMR446', 446000000, 446200000],
    ['23cm', 1240000000, 1300000000]
];

Plugins.autozoom.init = function () {
    var self = Plugins.autozoom;
    var timer = null;
    var lastFreq = null;
    var autoZoomed = false;
    var swallowUntilUp = false;

    // preferencias de este navegador (por defecto: desactivado y zoom normal)
    function load(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function save(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
    }
    var enabled = load('autozoom_on') === '1';
    // 'autozoom_zoom' y no el antiguo 'autozoom_pct', que significaba lo contrario
    var zoom = parseInt(load('autozoom_zoom'), 10);
    if (!(zoom in self.ZOOMS)) zoom = self.DEFAULT_ZOOM;

    function currentFreq() {
        try {
            var d = UI.getDemodulator();
            if (!d || !center_freq) return null;
            return center_freq + d.get_offset_frequency();
        } catch (e) {
            return null;
        }
    }

    // Bandas de la cinta (bandplan) del servidor; si no hay, la tabla de arriba
    function bandList() {
        if (typeof bandplan !== 'undefined' && bandplan && bandplan.bands && bandplan.bands.length) {
            return bandplan.bands.map(function (b) { return [b.name, b.low_bound, b.high_bound]; });
        }
        return self.bands;
    }

    function findBand(f) {
        var best = null;
        bandList().forEach(function (b) {
            if (f >= b[1] && f <= b[2] && (!best || (b[2] - b[1]) < (best[2] - best[1]))) best = b;
        });
        return best;
    }

    function applyZoom(level, centerAbs) {
        zoom_level = level;
        zoom_center_rel = centerAbs - center_freq;
        zoom_center_where = 0.5;
        resize_canvases(true);
        mkscale();
        if (typeof bandplan !== 'undefined' && bandplan) bandplan.draw();
        if (typeof bookmarks !== 'undefined' && bookmarks.position) bookmarks.position();
    }

    function zoomToBand() {
        timer = null;
        if (!enabled) return;
        var f = currentFreq();
        if (f === null) return;
        var band = findBand(f);
        if (!band) return;

        // recortar la banda a lo que cubre el perfil
        var lo = Math.max(band[1], center_freq - bandwidth / 2);
        var hi = Math.min(band[2], center_freq + bandwidth / 2);
        var span = (hi - lo) * (1 + 2 * self.MARGIN);
        var center = (lo + hi) / 2;

        // el mayor nivel de zoom cuya anchura visible todavía cubre ese ancho
        function levelFor(s) {
            var level = 0;
            for (var i = 0; i < zoom_levels.length; i++) {
                if (bandwidth / zoom_levels[i] >= s) level = i;
            }
            return level;
        }

        var level = levelFor(span);

        // la banda ocupa todo o casi todo el perfil: el zoom elegido alrededor de la
        // frecuencia, desplazado si hace falta para no salirse de la banda
        if (level === 0) {
            span = Math.min(bandwidth * self.ZOOMS[zoom] / 100, hi - lo);
            level = levelFor(span);
            // los niveles de zoom son fijos: ajustar con el ancho que de verdad se verá
            var shown = Math.min(bandwidth / zoom_levels[level], hi - lo);
            center = Math.min(Math.max(f, lo + shown / 2), hi - shown / 2);
        }
        if (level === 0) return;

        applyZoom(level, center);
        autoZoomed = true;
        if (Plugins._enable_debug) console.log('autozoom: ' + band[0] + ' nivel ' + level);
    }

    function zoomOut() {
        autoZoomed = false;
        applyZoom(0, center_freq);
    }

    var AREA = '#webrx-canvas-container, #openwebrx-scale-container, #openwebrx-frequency-container';

    function inArea(e) {
        return e.target.closest && e.target.closest(AREA);
    }

    // (re)arranca la cuenta atrás hasta el zoom
    function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(zoomToBand, self.DELAY_MS);
    }

    function onUserTouch(e) {
        if (!enabled || !inArea(e)) return;
        schedule();   // si en 3 s no se elige otra frecuencia, vuelve el zoom
        if (autoZoomed && zoom_level > 0) {
            zoomOut();
            // este toque solo abre el rango completo, no sintoniza
            e.stopPropagation();
            e.preventDefault();
            if (e.type !== 'wheel') swallowUntilUp = true;
        } else {
            autoZoomed = false;
        }
    }

    function onUserRelease(e) {
        if (!swallowUntilUp) return;
        e.stopPropagation();
        e.preventDefault();
        if (e.type === 'click' || e.type === 'touchend') swallowUntilUp = false;
    }

    ['mousedown', 'wheel', 'touchstart'].forEach(function (ev) {
        document.addEventListener(ev, onUserTouch, { capture: true, passive: false });
    });
    ['mouseup', 'click', 'touchend'].forEach(function (ev) {
        document.addEventListener(ev, onUserRelease, { capture: true, passive: false });
    });

    // mientras se mueve el ratón por el waterfall con la vista abierta, aplazar el zoom
    document.addEventListener('mousemove', function (e) {
        if (enabled && timer && !autoZoomed && inArea(e)) schedule();
    }, { capture: true, passive: true });

    // detectar cambios de frecuencia (clic, teclado, marcadores, cambio de perfil...)
    setInterval(function () {
        var f = currentFreq();
        if (f === null || f === lastFreq) return;
        lastFreq = f;
        if (enabled) schedule();
    }, 300);

    // --- botón AZ y menú de porcentaje ---
    $('<style id="autozoom-style"></style>').text(
        // order:-1 lo pone arriba de la columna, para no tapar LST ni quedar bajo la barra CPU
        '#plugin-button-autozoom{position:relative;order:-1;white-space:nowrap;font-weight:bold}' +
        '#plugin-button-autozoom::after{content:attr(data-pct);position:absolute;top:-5px;right:-9px;' +
            'box-sizing:border-box;min-width:15px;height:16px;padding:0 3px;border:1px solid rgba(255,255,255,.75);' +
            'border-radius:8px;color:#fff;background:#5a6570;font:bold 9px/14px sans-serif;text-align:center}' +
        '#plugin-button-autozoom[data-on="1"]{color:#6ff08f !important;box-shadow:inset 0 -3px #42c86a}' +
        '#plugin-button-autozoom[data-on="1"]::after{background:#00c743}' +
        '#autozoom-menu{position:fixed;z-index:10000;padding:4px 0;border:1px solid #3a454e;border-radius:4px;' +
            'background:#1b242c;color:#eef1f4;font:13px Segoe UI,Roboto,Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.5)}' +
        '#autozoom-menu div{padding:5px 14px;cursor:pointer;white-space:nowrap}' +
        '#autozoom-menu div:hover{background:#2c3a46}' +
        '#autozoom-menu .autozoom-sel{color:#6ff08f;font-weight:bold}' +
        '#autozoom-menu .autozoom-title{padding:3px 14px 5px;color:#9da8b0;font-size:11px;cursor:default}' +
        '#autozoom-menu .autozoom-title:hover{background:none}'
    ).appendTo('head');

    var button = Plugins.addButton('autozoom', 'AZ', function () { setEnabled(!enabled); });

    function refreshButton() {
        if (!button) return;
        $(button)
            .attr('data-on', enabled ? '1' : '0')
            .attr('data-pct', zoom + '%')
            .attr('title', 'Autozoom ' + (enabled ? 'activado' : 'desactivado') + ' (zoom ' + zoom + ' %)\n' +
                'Clic: activar o desactivar\nClic derecho: elegir cuánto zoom');
    }

    function setEnabled(on) {
        enabled = on;
        save('autozoom_on', on ? '1' : '0');
        refreshButton();
        if (timer) { clearTimeout(timer); timer = null; }
        if (on) zoomToBand();
        else if (autoZoomed) zoomOut();
    }

    function closeMenu() {
        $('#autozoom-menu').remove();
    }

    function openMenu() {
        closeMenu();
        var $menu = $('<div id="autozoom-menu"></div>')
            .append('<div class="autozoom-title">Cuánto zoom</div>');
        var notes = { 5: ' (mínimo)', 50: ' (máximo)' };
        notes[self.DEFAULT_ZOOM] = ' (normal)';
        Object.keys(self.ZOOMS).map(Number).sort(function (a, b) { return a - b; }).forEach(function (p) {
            $('<div></div>')
                .text(p + ' %' + (notes[p] || ''))
                .toggleClass('autozoom-sel', p === zoom)
                .on('click', function () {
                    zoom = p;
                    save('autozoom_zoom', String(p));
                    refreshButton();
                    closeMenu();
                    if (enabled) zoomToBand();
                })
                .appendTo($menu);
        });
        $menu.appendTo('body');

        // junto al botón y siempre dentro de la pantalla
        var r = button.getBoundingClientRect();
        var w = $menu.outerWidth(), h = $menu.outerHeight();
        $menu.css({
            left: Math.max(4, Math.min(r.left, window.innerWidth - w - 4)),
            top: r.top - h - 4 >= 4 ? r.top - h - 4 : Math.min(r.bottom + 4, window.innerHeight - h - 4)
        });
    }

    if (button) {
        button.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            openMenu();
        });
    }
    document.addEventListener('mousedown', function (e) {
        if (!e.target.closest || !e.target.closest('#autozoom-menu')) closeMenu();
    }, true);

    refreshButton();
    return true;
};
