/*
 * autozoom - plugin de receptor para OpenWebRX+
 *
 * Botón AZ (junto a LST):
 * - clic: activa o desactiva el autozoom. Por defecto está desactivado y cada
 *   navegador recuerda su elección.
 * - clic derecho (o mantener pulsado en el móvil): elegir cuánto zoom hacer,
 *   de 5 % (mínimo: se ve la mitad del perfil) a 50 % (máximo: 1/16 del perfil).
 *   Cada opción hace el doble de zoom que la anterior. No depende de las bandas.
 *
 * Con el autozoom activado:
 * - 3 s después de sintonizar una frecuencia hace el zoom elegido, con la
 *   frecuencia en el centro.
 * - Un clic o toque en el waterfall, la escala o un marcador sintoniza directamente
 *   dentro del zoom; a los 3 s el zoom se recentra en la nueva frecuencia.
 * - La rueda del ratón sobre el waterfall/escala abre el rango completo (sin
 *   sintonizar). Si en 3 s no se elige otra frecuencia, vuelve el zoom.
 */

Plugins.autozoom.no_css = true;

Plugins.autozoom.DELAY_MS = 3000;          // espera antes de hacer zoom
// opciones del menú: % de zoom -> en cuántas partes se divide el perfil
// (5 % = se ve la mitad; cada opción siguiente, el doble de zoom)
Plugins.autozoom.ZOOMS = { 5: 2, 10: 4, 25: 8, 50: 16 };
Plugins.autozoom.DEFAULT_ZOOM = 25;

Plugins.autozoom.init = function () {
    var self = Plugins.autozoom;
    var timer = null;
    var lastFreq = null;
    var autoZoomed = false;

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

    function applyZoom(level, centerAbs) {
        zoom_level = level;
        zoom_center_rel = centerAbs - center_freq;
        zoom_center_where = 0.5;
        resize_canvases(true);
        mkscale();
        if (typeof bandplan !== 'undefined' && bandplan) bandplan.draw();
        if (typeof bookmarks !== 'undefined' && bookmarks.position) bookmarks.position();
    }

    // el mayor nivel de zoom cuya anchura visible todavía cubre ese ancho
    function levelFor(span) {
        var level = 0;
        for (var i = 0; i < zoom_levels.length; i++) {
            if (bandwidth / zoom_levels[i] >= span) level = i;
        }
        return level;
    }

    // el zoom elegido, con la frecuencia en el centro (OpenWebRX no deja que la
    // vista se salga del perfil: en los bordes queda desplazada)
    function zoomToFreq() {
        timer = null;
        if (!enabled) return;
        var f = currentFreq();
        if (f === null) return;
        var level = levelFor(bandwidth / self.ZOOMS[zoom]);
        if (level === 0) return;
        applyZoom(level, f);
        autoZoomed = true;
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
        timer = setTimeout(zoomToFreq, self.DELAY_MS);
    }

    // la rueda abre el rango completo; un clic o toque (en el waterfall, la escala o
    // un marcador) sintoniza dentro del zoom y el zoom se recentra a los 3 s
    function onWheel(e) {
        if (!enabled || !inArea(e)) return;
        schedule();   // si en 3 s no se elige otra frecuencia, vuelve el zoom
        if (autoZoomed && zoom_level > 0) {
            zoomOut();
            // esta rueda solo abre el rango completo, no sintoniza
            e.stopPropagation();
            e.preventDefault();
        } else {
            autoZoomed = false;
        }
    }

    document.addEventListener('wheel', onWheel, { capture: true, passive: false });

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
        if (on) zoomToFreq();
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
                    if (enabled) zoomToFreq();
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
