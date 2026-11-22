/*
 * rig_fil_ea7cl 0.4 (EA7CL) · los letreros «FIL …» y «TS …» del panel rig se convierten en botones con desplegable.
 *
 * Clic en «FIL»: N / M / W, anchos fijos del modo (como la tecla FIL/WIDTH de un transceptor),
 * Ensanchar, Estrechar, Desplazar ← / →, Restaurar de fábrica (este modo)
 * y Restaurar todos los modos (lo mismo que Ctrl+Alt+1 o la tecla |).
 * Un segundo clic en el letrero (o un clic fuera) lo cierra y deja todo en reposo.
 * 0.2: funciona también con el doble receptor 2.x (que ya no trae su propio desplegable).
 * 0.3: banda aérea (118-137 MHz) en AM: ancho normal ±4 kHz.
 * 0.4: anchos fijos por modo en FIL; letrero «BAJO» (corte bajo del filtro en LSB/USB y modos de una banda)
 *      en lugar de «TS» (el letrero TS se quita siempre). Al cambiar BAJO se mantiene el ancho.
 */
(function () {
    'use strict';
    var VERSION = '0.4';
    var CLAVE = 'rig_fil_ea7cl';
    if (window.Plugins) { Plugins.rig_fil_ea7cl = Plugins.rig_fil_ea7cl || {}; Plugins.rig_fil_ea7cl._version = VERSION; }

    var fil = 1;    // 0 = N (estrecho), 1 = M (normal), 2 = W (ancho)
    try { var g = parseInt(localStorage.getItem(CLAVE), 10); if (g === 0 || g === 2) fil = g; } catch (e) {}
    function guardar() { try { localStorage.setItem(CLAVE, String(fil)); } catch (e) {} }

    function mod() { try { return UI.getModulation(); } catch (e) { return ''; } }
    function demod() { try { return UI.getDemodulator(); } catch (e) { return null; } }
    // 0.3: banda aerea (118-137 MHz) en AM: ancho normal +-4 kHz (canales de 8,33 kHz)
    function esAerea() { try { var f = center_freq + demod().get_offset_frequency(); return f >= 118e6 && f <= 137e6; } catch (e) { return false; } }
    function modeObj(m) { try { return Modes.findByModulation(m); } catch (e) { return null; } }

    // ancho del filtro: el del modo, multiplicado por 0,6 (N), 1 (M) o 1,5 (W).
    // BCFM, DAB e IQ no tienen filtro ajustable (devuelve null).
    function bandpass(m, f) {
        var mo = modeObj(m), bp = null;
        if (m === 'cw' && UI.getCwBandpass) { try { bp = UI.getCwBandpass(); } catch (e) {} }
        if (!bp && mo && mo.bandpass) bp = { low_cut: mo.bandpass.low_cut, high_cut: mo.bandpass.high_cut };
        if (bp && m === 'am' && esAerea()) bp = { low_cut: -4000, high_cut: 4000 };
        if (!bp) return null;
        var k = [0.6, 1, 1.5][f] || 1, lo = bp.low_cut, hi = bp.high_cut;
        if (k !== 1) {
            if (lo < 0 && hi > 0) { lo = lo * k; hi = hi * k; }
            else if (lo >= 0) {
                if (m === 'cw') { var c = (lo + hi) / 2, w = (hi - lo) * k / 2; lo = c - w; hi = c + w; }
                else hi = lo + (hi - lo) * k;
            } else { lo = hi - (hi - lo) * k; }
        }
        var q = 10;
        return { low_cut: Math.round(lo / q) * q, high_cut: Math.round(hi / q) * q };
    }
    function aplicar() {
        var d = demod(), bp = bandpass(mod(), fil);
        if (d && bp && d.setBandpass) d.setBandpass(bp);
    }

    // 0.4: pone el filtro como al arrastrarlo con el ratón (moveBandpass de OpenWebRX): dentro de los
    // límites, con el ancho mínimo, y guardado para ese modo (se recuerda al volver a él)
    function poner(lo, hi) {
        var d = demod();
        if (!d || typeof d.set !== 'function') return false;
        var f = d.filter || {}, lim = f.limits || {}, minp = f.min_passband || 100;
        lo = Math.round(lo); hi = Math.round(hi);
        if (typeof lim.low === 'number' && lo < lim.low) return false;
        if (typeof lim.high === 'number' && hi > lim.high) return false;
        if (hi - lo < minp) return false;
        try { if (!d.secondary_demod && UI.saveBandpass) UI.saveBandpass(mod(), lo, hi); } catch (e) {}
        d.low_cut = lo; d.high_cut = hi; d.set();
        return true;
    }
    function ajustable(d) {
        return d && typeof d.low_cut === 'number' && typeof d.high_cut === 'number' && !!bandpass(mod(), 1);
    }
    function cabe(d, lo, hi) {
        var f = (d && d.filter) || {}, lim = f.limits || {}, minp = f.min_passband || 100;
        return !(typeof lim.low === 'number' && lo < lim.low) && !(typeof lim.high === 'number' && hi > lim.high) && hi - lo >= minp;
    }

    // ---- anchos fijos por modo (ancho total del filtro, en Hz), como la tecla FIL/WIDTH de un transceptor ----
    var SSB = [1800, 2100, 2400, 2700, 3000, 3300, 3600, 4000];
    var AM = [3000, 4000, 5000, 6000, 8000, 9000, 10000, 12000];
    var ANCHOS = {
        usb: SSB, lsb: SSB,
        cw: [100, 150, 200, 300, 500, 800, 1200],
        am: AM, sam: AM,
        nfm: [6000, 8000, 10000, 12000, 16000, 20000]
    };
    // nuevo filtro de ancho w: en LSB/USB se queda quieto el borde de la portadora (el corte bajo),
    // en CW y en los modos simétricos se queda quieto el centro
    function r50(v) { return Math.max(50, v); }
    function conAncho(d, m, w) {
        var lo = d.low_cut, hi = d.high_cut;
        if (m !== 'cw' && lo >= 0) return { lo: lo, hi: lo + w };
        if (m !== 'cw' && hi <= 0) return { lo: hi - w, hi: hi };
        var c = (lo + hi) / 2;
        return { lo: c - w / 2, hi: c + w / 2 };
    }

    // ---- corte bajo (borde del filtro más cercano a la portadora), solo en modos de una banda ----
    // pasos de 50 Hz; 300 Hz es el estándar de SSB (canal de voz 300-2700 Hz con 2,4 kHz)
    var BAJOS = [50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 800, 1000];
    var BAJO_STD = 300;
    function lado(d, m) {        // 'usb' (filtro por encima de la portadora), 'lsb' (por debajo) o null
        if (!d || m === 'cw' || typeof d.low_cut !== 'number' || typeof d.high_cut !== 'number') return null;
        if (d.low_cut >= 0) return 'usb';
        if (d.high_cut <= 0) return 'lsb';
        return null;
    }
    function bajo(d, l) { return l === 'usb' ? Math.round(d.low_cut) : Math.round(-d.high_cut); }
    // al cambiar el corte bajo se mueve el filtro entero y se queda el mismo ancho
    // (así sigue coincidiendo con el botón de ancho fijo que se eligió)
    function conBajo(d, l, v) {
        var w = d.high_cut - d.low_cut;
        return l === 'usb' ? { lo: v, hi: v + w } : { lo: -v - w, hi: -v };
    }

    // ---- desplegable con el aspecto de los menús de rig_skin ----
    var $pop = null, ancla = null;
    function cerrar() {
        if ($pop) { $pop.remove(); $pop = null; }
        $(document).off('click.rigfil');
        setTimeout(function () { if (!$pop) ancla = null; }, 0);
    }
    function elemento(it, chip) {
        var $i = $('<div class="owrx-rig-rit-menu-item">').text(it.t).toggleClass('sel', !!it.sel).toggleClass('rigfil-chip', !!chip);
        if (it.fn) $i.on('click', function (e) { e.stopPropagation(); if (!it.seguir) cerrar(); it.fn(); });
        else $i.addClass('rigfil-pop-off');
        return $i;
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
            if (it.chips) {          // fila de botones pequeños (anchos fijos, cortes bajos)
                var $c = $('<div class="rigfil-chips">');
                it.chips.forEach(function (c) { $c.append(elemento(c, true)); });
                $pop.append($c);
            } else if (it.sub) {
                $('<div class="rigfil-pop-sub">').text(it.sub).appendTo($pop);
            } else $pop.append(elemento(it, false));
        });
        $('body').append($pop);
        // si no cabe por debajo (panel abajo, como en el doble receptor), se abre hacia arriba
        var h = $pop[0].scrollHeight, abajo = window.innerHeight - r.bottom - 12, arriba = r.top - 12;
        if (h > abajo && arriba > abajo) $pop.css({ top: Math.max(4, Math.round(r.top - 3 - Math.min(h, arriba))) + 'px', maxHeight: arriba + 'px' });
        // que no se salga por la derecha de la ventana
        var w = $pop.outerWidth();
        if (r.left + w > window.innerWidth - 4) $pop.css('left', Math.max(4, window.innerWidth - w - 4) + 'px');
        setTimeout(function () {
            $(document).on('click.rigfil', function (e) { if (!$pop || !$.contains($pop[0], e.target)) cerrar(); });
        }, 0);
    }
    // vuelve a abrir el mismo desplegable con los valores nuevos (para seguir ajustando)
    function reabrir(fn, a) { setTimeout(function () { ancla = null; cerrar(); ancla = null; fn(a); }, 0); }

    function menu(a) {
        var d = demod(), m = mod(), mo = modeObj(m);
        var items;
        var aj = ajustable(d);
        var ancho = aj ? Math.round(d.high_cut - d.low_cut) : 0;
        if (!bandpass(m, 1)) items = [{ t: (mo ? mo.name : m) + ': ancho fijo, sin filtro ajustable' }];
        else items = [0, 1, 2].map(function (f) {
            var bp = bandpass(m, f);
            return { t: ['N  estrecho', 'M  normal', 'W  ancho'][f] + '   ' + ((bp.high_cut - bp.low_cut) / 1000).toFixed(1) + ' kHz',
                sel: f === fil && (!aj || Math.abs(ancho - (bp.high_cut - bp.low_cut)) < 5),
                fn: function () { fil = f; guardar(); aplicar(); } };
        });
        var titulo = 'Filtro' + (aj ? '  ·  ' + Math.round(d.low_cut) + ' / ' + Math.round(d.high_cut) : '');
        function mover(dl, dh) {
            return function () {
                var dd = demod();
                if (dd && dd.moveBandpass) dd.moveBandpass(dd.low_cut + dl, dd.high_cut + dh);
                reabrir(menu, a);   // sigue abierto para seguir ajustando
            };
        }
        // anchos fijos del modo (los que no caben en los límites del filtro no salen)
        var lista = aj && ANCHOS[m];
        if (lista) {
            var chips = [];
            lista.forEach(function (w) {
                var n = conAncho(d, m, w);
                if (!cabe(d, n.lo, n.hi)) return;
                chips.push({ t: String(m === 'cw' ? w : w / 1000), sel: Math.abs(ancho - w) < 5,
                    fn: function () { var dd = demod(); if (!dd) return; var nn = conAncho(dd, m, w); if (poner(nn.lo, nn.hi)) { fil = 1; guardar(); } } });
            });
            if (chips.length) {
                items.push({ sub: 'Anchos fijos' + (m === 'cw' ? ' (Hz)' : ' (kHz)') });
                items.push({ chips: chips });
            }
        }
        if (aj) {
            var paso = Math.max(50, Math.round((d.high_cut - d.low_cut) * 0.05 / 50) * 50);
            items.push({ t: '──────────' });
            items.push({ t: '⇔  Ensanchar   (±' + paso + ' Hz)', fn: mover(-paso, paso), seguir: true });
            items.push({ t: '⇒⇐ Estrechar   (±' + paso + ' Hz)', fn: mover(paso, -paso), seguir: true });
            items.push({ t: '←  Desplazar a la izquierda (50 Hz)', fn: mover(-50, -50), seguir: true });
            items.push({ t: '→  Desplazar a la derecha (50 Hz)', fn: mover(50, 50), seguir: true });
        }
        items.push({ t: '──────────' });
        items.push({ t: '↺  Restaurar de fábrica (este modo)', fn: function () {
            try { localStorage.removeItem('bp-' + m); if (typeof LS !== 'undefined' && LS.delete) LS.delete('bp-' + m); } catch (e) {}
            fil = 1; guardar();
            var dd = demod();
            var bpf = bandpass(m, 1); if (dd && bpf && dd.setBandpass) dd.setBandpass(bpf);
        } });
        items.push({ t: '↺  Restaurar todos los modos', fn: function () {   // = Ctrl+Alt+1 / tecla |
            fil = 1; guardar();
            try { UI.resetAllBandpasses(); } catch (e) {}
        } });
        abrir(a, titulo, items);
    }

    // ---- desplegable del corte bajo ----
    function menuBajo(a) {
        var d = demod(), m = mod(), mo = modeObj(m), l = ajustable(d) ? lado(d, m) : null;
        if (!l) {
            var nombre = mo ? mo.name : m;
            abrir(a, 'Corte bajo', [{ t: m === 'cw' ? 'CW: el filtro va centrado en el tono; usa FIL'
                : nombre + ': sin corte bajo (el filtro es simétrico o fijo)' }]);
            return;
        }
        var v = bajo(d, l), items = [], chips = [];
        BAJOS.forEach(function (b) {
            var n = conBajo(d, l, b);
            if (!cabe(d, n.lo, n.hi)) return;
            chips.push({ t: String(b), sel: Math.abs(v - b) < 3, fn: function () {
                var dd = demod(), ll = dd && lado(dd, mod()); if (!ll) return;
                var nn = conBajo(dd, ll, b); if (poner(nn.lo, nn.hi)) { fil = 1; guardar(); }
            } });
        });
        items.push({ sub: 'Corte bajo (Hz)' });
        items.push({ chips: chips });
        function subir(dv) {
            return function () {
                var dd = demod(), ll = dd && lado(dd, mod());
                if (ll) { var nn = conBajo(dd, ll, r50(bajo(dd, ll) + dv)); if (poner(nn.lo, nn.hi)) { fil = 1; guardar(); } }
                reabrir(menuBajo, a);
            };
        }
        items.push({ t: '──────────' });
        items.push({ t: '↑  Subir 50 Hz', fn: subir(50), seguir: true });
        items.push({ t: '↓  Bajar 50 Hz', fn: subir(-50), seguir: true });
        items.push({ t: '↺  Estándar SSB (' + BAJO_STD + ' Hz)', fn: function () {
            var dd = demod(), ll = dd && lado(dd, mod()); if (!ll) return;
            var nn = conBajo(dd, ll, BAJO_STD); if (poner(nn.lo, nn.hi)) { fil = 1; guardar(); }
        } });
        abrir(a, 'Corte bajo  ·  ahora ' + v + ' Hz', items);
    }

    // ---- letrero BAJO (en el sitio de TS) ----
    var $bajo = null;
    function letreroBajo() {
        var $info = $('#openwebrx-panel-receiver #owrx-rig-info');
        if (!$info.length) return;
        if (!$bajo || !$.contains(document.documentElement, $bajo[0])) {
            $bajo = $('<div class="owrx-rig-info-step rigfil-bajo" translate="no">').addClass('notranslate')
                .attr('title', 'Corte bajo del filtro (LSB/USB): clic para cambiarlo');
            var $f = $info.children('.owrx-rig-info-filter').first();
            if ($f.length) $f.after($bajo); else $info.append($bajo);
        }
        var d = demod(), l = ajustable(d) ? lado(d, mod()) : null;
        var txt = 'BAJO ' + (l ? bajo(d, l) : '--');
        if ($bajo.text() !== txt) $bajo.text(txt);
        // el letrero TS sobra siempre (pantalla normal y DUAL): BAJO ocupa su sitio
        $info.children('.owrx-rig-info-step').not('.rigfil-bajo').addClass('rigfil-oculto');
    }

    var lastMod = '', lastAire = null;
    function tick() {
        // sin filtro ajustable (DAB, BCFM…) rig_skin deja el letrero vacío: se pone «FIL --» para poder abrirlo
        var $mf = $('#openwebrx-panel-receiver .owrx-rig-info-filter');
        if ($mf.length && !$.trim($mf.text())) $mf.text('FIL --');
        letreroBajo();
        var m = mod();
        var aire = (m === 'am') && esAerea();
        if (aire !== lastAire) { var antes = lastAire; lastAire = aire; if (antes !== null && m === lastMod) setTimeout(aplicar, 150); }
        if (m !== lastMod) {    // OpenWebRX pone el ancho por defecto al cambiar de modo: se reaplica N o W
            lastMod = m;
            if (fil !== 1 || aire) setTimeout(aplicar, 150);
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
        $('#openwebrx-panel-receiver').on('click.rigfil', '.rigfil-bajo', function (e) {
            e.stopPropagation();
            menuBajo(this);
        });
        // TS (paso de sintonía): la misma lista de pasos que OpenWebRX
        $('#openwebrx-panel-receiver').on('click.rigfil', '.owrx-rig-info-step:not(.rigfil-bajo)', function (e) {
            e.stopPropagation();
            var $lb = $('#openwebrx-tuning-step-listbox');
            var cur = $lb.val();
            abrir(this, 'Paso de sintonía', $lb.find('option').map(function () {
                var v = this.value, t = $(this).text();
                return { t: t, sel: v === cur, fn: function () { $lb.val(v).trigger('change'); } };
            }).get());
        });
        letreroBajo();
        // al cargar solo se aplica N, W o el de banda aérea: con M se queda el filtro que OpenWebRX
        // recuerda para el modo (el que se puso a mano o con un ancho fijo)
        setTimeout(function () { if (fil !== 1 || (mod() === 'am' && esAerea())) aplicar(); }, 1500);
        setInterval(tick, 500);
    })();
})();
