/*
 * rig_fil_ea7cl 0.2 (EA7CL) · los letreros «FIL …» y «TS …» del panel rig se convierten en botones con desplegable.
 *
 * Clic en «FIL»: N / M / W, Ensanchar, Estrechar, Desplazar ← / →, Restaurar de fábrica (este modo)
 * y Restaurar todos los modos (lo mismo que Ctrl+Alt+1 o la tecla |).
 * Un segundo clic en el letrero (o un clic fuera) lo cierra y deja todo en reposo.
 * Es el mismo desplegable que el del MAIN del doble receptor (doble_receptor 1.8.2 y siguientes).
 * 0.2: funciona también con el doble receptor 2.x (que ya no trae su propio desplegable).
 */
(function () {
    'use strict';
    var VERSION = '0.2';
    var CLAVE = 'rig_fil_ea7cl';
    if (window.Plugins) { Plugins.rig_fil_ea7cl = Plugins.rig_fil_ea7cl || {}; Plugins.rig_fil_ea7cl._version = VERSION; }

    var fil = 1;    // 0 = N (estrecho), 1 = M (normal), 2 = W (ancho)
    try { var g = parseInt(localStorage.getItem(CLAVE), 10); if (g === 0 || g === 2) fil = g; } catch (e) {}
    function guardar() { try { localStorage.setItem(CLAVE, String(fil)); } catch (e) {} }

    function mod() { try { return UI.getModulation(); } catch (e) { return ''; } }
    function demod() { try { return UI.getDemodulator(); } catch (e) { return null; } }
    function modeObj(m) { try { return Modes.findByModulation(m); } catch (e) { return null; } }

    // ancho del filtro: el del modo, multiplicado por 0,6 (N), 1 (M) o 1,5 (W).
    // BCFM, DAB e IQ no tienen filtro ajustable (devuelve null).
    function bandpass(m, f) {
        var mo = modeObj(m), bp = null;
        if (m === 'cw' && UI.getCwBandpass) { try { bp = UI.getCwBandpass(); } catch (e) {} }
        if (!bp && mo && mo.bandpass) bp = { low_cut: mo.bandpass.low_cut, high_cut: mo.bandpass.high_cut };
        if (!bp) return null;
        var k = [0.6, 1, 1.5][f] || 1, lo = bp.low_cut, hi = bp.high_cut;
        if (k !== 1) {
            if (lo < 0 && hi > 0) { lo = lo * k; hi = hi * k; }
            else if (lo >= 0) {
                if (m === 'cw') { var c = (lo + hi) / 2, w = (hi - lo) * k / 2; lo = c - w; hi = c + w; }
                else hi = lo + (hi - lo) * k;
            } else { lo = hi - (hi - lo) * k; }
        }
        return { low_cut: Math.round(lo / 10) * 10, high_cut: Math.round(hi / 10) * 10 };
    }
    function aplicar() {
        var d = demod(), bp = bandpass(mod(), fil);
        if (d && bp && d.setBandpass) d.setBandpass(bp);
    }

    // ---- desplegable con el aspecto de los menús de rig_skin ----
    var $pop = null, ancla = null;
    function cerrar() {
        if ($pop) { $pop.remove(); $pop = null; }
        $(document).off('click.rigfil');
        setTimeout(function () { if (!$pop) ancla = null; }, 0);
    }
    function abrir(a, titulo, items) {
        // un segundo clic en el mismo letrero cierra el desplegable
        if ($pop && ancla === a) { cerrar(); ancla = null; return; }
        cerrar();
        ancla = a;
        var r = a.getBoundingClientRect();
        $pop = $('<div class="owrx-rig-rit-menu open rigfil-pop" translate="no">').addClass('notranslate').css({
            position: 'fixed', left: Math.round(r.left) + 'px', top: Math.round(r.bottom + 3) + 'px',
            right: 'auto', bottom: 'auto', margin: 0, zIndex: 10000,
            maxHeight: Math.max(120, window.innerHeight - r.bottom - 12) + 'px', overflowY: 'auto'
        });
        if (titulo) $('<div class="rigfil-pop-title">').text(titulo).appendTo($pop);
        items.forEach(function (it) {
            var $i = $('<div class="owrx-rig-rit-menu-item">').text(it.t).toggleClass('sel', !!it.sel);
            if (it.fn) $i.on('click', function (e) { e.stopPropagation(); cerrar(); it.fn(); });
            else $i.addClass('rigfil-pop-off');
            $pop.append($i);
        });
        $('body').append($pop);
        setTimeout(function () {
            $(document).on('click.rigfil', function (e) { if (!$pop || !$.contains($pop[0], e.target)) cerrar(); });
        }, 0);
    }

    function menu(a) {
        var d = demod(), m = mod(), mo = modeObj(m);
        var items;
        if (!bandpass(m, 1)) items = [{ t: (mo ? mo.name : m) + ': ancho fijo, sin filtro ajustable' }];
        else items = [0, 1, 2].map(function (f) {
            var bp = bandpass(m, f);
            return { t: ['N  estrecho', 'M  normal', 'W  ancho'][f] + '   ' + ((bp.high_cut - bp.low_cut) / 1000).toFixed(1) + ' kHz',
                sel: f === fil, fn: function () { fil = f; guardar(); aplicar(); } };
        });
        var ajustable = d && typeof d.low_cut === 'number' && typeof d.high_cut === 'number' && bandpass(m, 1);
        var titulo = 'Filtro' + (ajustable ? '  ·  ' + Math.round(d.low_cut) + ' / ' + Math.round(d.high_cut) : '');
        function mover(dl, dh) {
            return function () {
                var dd = demod();
                if (dd && dd.moveBandpass) dd.moveBandpass(dd.low_cut + dl, dd.high_cut + dh);
                setTimeout(function () { ancla = null; menu(a); }, 0);   // sigue abierto para seguir ajustando
            };
        }
        if (ajustable) {
            var paso = Math.max(50, Math.round((d.high_cut - d.low_cut) * 0.05 / 50) * 50);
            items.push({ t: '──────────' });
            items.push({ t: '⇔  Ensanchar   (±' + paso + ' Hz)', fn: mover(-paso, paso) });
            items.push({ t: '⇒⇐ Estrechar   (±' + paso + ' Hz)', fn: mover(paso, -paso) });
            items.push({ t: '←  Desplazar a la izquierda (50 Hz)', fn: mover(-50, -50) });
            items.push({ t: '→  Desplazar a la derecha (50 Hz)', fn: mover(50, 50) });
        }
        items.push({ t: '──────────' });
        items.push({ t: '↺  Restaurar de fábrica (este modo)', fn: function () {
            try { localStorage.removeItem('bp-' + m); if (typeof LS !== 'undefined' && LS.delete) LS.delete('bp-' + m); } catch (e) {}
            fil = 1; guardar();
            var dd = demod();
            if (dd && mo && mo.bandpass && dd.setBandpass) dd.setBandpass(mo.bandpass);
        } });
        items.push({ t: '↺  Restaurar todos los modos', fn: function () {   // = Ctrl+Alt+1 / tecla |
            fil = 1; guardar();
            try { UI.resetAllBandpasses(); } catch (e) {}
        } });
        abrir(a, titulo, items);
    }

    var lastMod = '';
    function tick() {
        // sin filtro ajustable (DAB, BCFM…) rig_skin deja el letrero vacío: se pone «FIL --» para poder abrirlo
        var $mf = $('#openwebrx-panel-receiver .owrx-rig-info-filter');
        if ($mf.length && !$.trim($mf.text())) $mf.text('FIL --');
        var m = mod();
        if (m !== lastMod) {    // OpenWebRX pone el ancho por defecto al cambiar de modo: se reaplica N o W
            lastMod = m;
            if (fil !== 1) setTimeout(aplicar, 150);
        }
    }

    var intentos = 0;
    (function esperar() {
        if (window.DR) return;   // solo el doble receptor 1.x traía su propio desplegable
        if (!$('#openwebrx-panel-receiver .owrx-rig-info-filter').length && ++intentos < 80) { setTimeout(esperar, 250); return; }
        document.body.classList.add('rigfil-on');
        lastMod = mod();
        $('#openwebrx-panel-receiver').on('click.rigfil', '.owrx-rig-info-filter', function (e) {
            e.stopPropagation();
            menu(this);
        });
        // TS (paso de sintonía): la misma lista de pasos que OpenWebRX
        $('#openwebrx-panel-receiver').on('click.rigfil', '.owrx-rig-info-step', function (e) {
            e.stopPropagation();
            var $lb = $('#openwebrx-tuning-step-listbox');
            var cur = $lb.val();
            abrir(this, 'Paso de sintonía', $lb.find('option').map(function () {
                var v = this.value, t = $(this).text();
                return { t: t, sel: v === cur, fn: function () { $lb.val(v).trigger('change'); } };
            }).get());
        });
        if (fil !== 1) setTimeout(aplicar, 1500);
        setInterval(tick, 500);
    })();
})();
