/*
 * doble_receptor 2.1 (EA7CL) · Doble receptor MAIN / SUB para OpenWebRX+
 *
 * Hecho desde cero. El MAIN es la página normal del receptor. Al pulsar DUAL:
 *  - la parte de arriba (cabecera y letrero del tiempo) sigue una sola vez y a
 *    todo el ancho, como con un solo receptor;
 *  - debajo, la cascada y el panel del MAIN pasan a su mitad;
 *  - en la otra mitad se abre otra vez la página del receptor: el SUB. Es un
 *    oyente completo con su panel rig, su cascada y todos los plugins, así que
 *    tiene por fuerza la misma vista y las mismas funciones que el MAIN.
 *
 * En DUAL, los dos paneles: sin rueda ni teclas repetidas (NR, TS, − +, ◀ ▶),
 * teclas L y R (altavoz izquierdo / derecho), ⇆ / ⇅ (columnas / filas) y
 * DUAL (salir). El SUB guarda sus ajustes aparte.
 */
(function () {
    'use strict';

    var DR = Plugins.doble_receptor = Plugins.doble_receptor || {};
    DR._version = 2.1;
    DR.version = '2.1.19';

    var raizHtml = document.documentElement;

    // ¿somos el SUB (la página de dentro)? Se mira el marco que la contiene
    // (OpenWebRX cambia el nombre de la ventana, no sirve para esto)
    var shell = null;
    try {
        var marco = window.frameElement;
        if (window.parent !== window && marco && marco.id === 'drx-sub' && window.parent.DR_SHELL &&
                window.parent.location.origin === window.location.origin) {
            shell = window.parent.DR_SHELL;
        }
    } catch (e) { shell = null; }
    var ROL = shell ? 'sub' : 'main';
    DR.rol = ROL;

    function enDual() { return ROL === 'sub' || raizHtml.classList.contains('drx-dual'); }
    function disposicion() {
        if (ROL === 'sub') return shell.disposicion();
        return raizHtml.classList.contains('drx-filas') ? 'filas' : 'columnas';
    }

    // ---------------------------------------------------------------
    // 1. Ajustes aparte (desde que carga el archivo, antes que nada).
    //    SUB: lo que es "de receptor" (volumen, NR, perfil recordado,
    //    VFO, filtros, DSP...) con otro nombre; el aspecto es común.
    //    MAIN, solo mientras está en DUAL: posición y ancho del panel,
    //    para no tocar los de la pantalla normal.
    //    Posición y ancho, además, aparte para columnas y para filas.
    // ---------------------------------------------------------------
    (function () {
        var PREF = ROL === 'sub' ? 'drs.' : 'drm.';
        var PROPIAS = ROL === 'sub'
            ? /^(volume|volumeMuted|nr_enabled|nr_threshold|ea7_perfil_recordado|rig_vfo_a|rig_vfo_b|rig_vfo_active|rig_ts_auto|rig_dial_lock|rig_watch|rig_watch_parked|rig_fil_ea7cl|ea7cl_estereo_mono|bp-.*|adsp_.*|rig_pos|rig_wide_user|rig_phone_strip|dr_altavoz)$/
            : /^(rig_pos|rig_wide_user|rig_phone_strip)$/;
        var POR_DISP = /^(rig_pos|rig_wide_user)$/;
        var SP = Storage.prototype;
        var gi = SP.getItem, si = SP.setItem, ri = SP.removeItem;
        var nombre = function (st, k) {
            try {
                if (enDual() && st === window.localStorage && PROPIAS.test(String(k))) {
                    return PREF + (POR_DISP.test(String(k)) ? disposicion() + '.' : '') + k;
                }
            } catch (e) {}
            return k;
        };
        SP.getItem = function (k) {
            var v = gi.call(this, nombre(this, k));
            // panel estrecho en columnas y ancho en filas, mientras el oyente no elija otro
            try {
                if (v === null && k === 'rig_wide_user' && enDual() && this === window.localStorage) {
                    v = disposicion() === 'filas' ? 'true' : 'false';
                }
            } catch (e) {}
            return v;
        };
        SP.setItem = function (k, v) { return si.call(this, nombre(this, k), v); };
        SP.removeItem = function (k) { return ri.call(this, nombre(this, k)); };
    })();

    if (ROL === 'sub') {
        raizHtml.classList.add('drx-marco', 'drx-sub', 'drx-dual');
        raizHtml.setAttribute('translate', 'no');
    }

    function $l() { return $('#openwebrx-sdr-profiles-listbox'); }
    function ls(k, v) {
        try {
            if (v === undefined) return localStorage.getItem(k);
            localStorage.setItem(k, v);
        } catch (e) { return null; }
    }
    function avisarCambioTamano() {
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
        try { if (Plugins.rig_skin && Plugins.rig_skin._fitPanel) Plugins.rig_skin._fitPanel(); } catch (e) {}
    }

    // ---------------------------------------------------------------
    // 2. Teclas con el mismo aspecto que las del panel rig
    // ---------------------------------------------------------------
    function tecla(texto, titulo, clase) {
        var k = document.createElement('div');
        k.className = 'openwebrx-button owrx-rig-key drx-key ' + (clase || '');
        k.title = titulo;
        k.setAttribute('translate', 'no');
        var led = document.createElement('span');
        led.className = 'owrx-rig-key-led';
        k.appendChild(led);
        var t = document.createElement('span');
        t.className = 'drx-key-txt';
        t.textContent = texto;
        k.appendChild(t);
        return k;
    }
    function encendida(k, on) { k.classList.toggle('highlighted', !!on); }

    // ---------------------------------------------------------------
    // 3. Altavoces L y R. Justo antes de la salida de audio de cada
    //    página se pone un reparto; lo que iba a la salida (también el
    //    DSP o el estéreo) pasa por él. L+R = los dos (estéreo si lo es)
    //    · solo L o solo R = todo por ese lado, con el mismo volumen ·
    //    ninguno = sin sonido. Fuera de DUAL el MAIN suena por los dos.
    // ---------------------------------------------------------------
    var audio = null;
    var altavoz = { L: true, R: true };
    (function () {
        var v = ls(ROL === 'sub' ? 'dr_altavoz' : 'dr_altavoz_main');
        if (v === 'L' || v === 'R' || v === '-' || v === 'LR') {
            altavoz.L = v.indexOf('L') >= 0;
            altavoz.R = v.indexOf('R') >= 0;
        }
    })();

    function prepararAudio() {
        if (audio) return true;
        var ae = window.audioEngine;
        if (!ae || !ae.audioContext || !ae.gainNode) return false;
        var ctx = ae.audioContext;
        var AN = AudioNode.prototype;
        var conectar = AN.connect, desconectar = AN.disconnect;
        var entrada = ctx.createGain();
        var directo = ctx.createGain();
        var mono = ctx.createGain();
        mono.channelCount = 1;
        mono.channelCountMode = 'explicit';
        mono.channelInterpretation = 'speakers';
        var aIzq = ctx.createGain(), aDer = ctx.createGain();
        var juntar = ctx.createChannelMerger(2);
        var vol = ctx.createGain();
        conectar.call(entrada, directo);
        conectar.call(directo, vol);
        conectar.call(entrada, mono);
        conectar.call(mono, aIzq);
        conectar.call(mono, aDer);
        conectar.call(aIzq, juntar, 0, 0);
        conectar.call(aDer, juntar, 0, 1);
        conectar.call(juntar, vol);
        conectar.call(vol, ctx.destination);
        audio = DR._audio = { ctx: ctx, directo: directo, izq: aIzq, der: aDer, vol: vol };
        AN.connect = function (dest) {
            if (dest && this !== vol && dest === ctx.destination && this.context === ctx) {
                var a = Array.prototype.slice.call(arguments);
                a[0] = entrada;
                return conectar.apply(this, a);
            }
            return conectar.apply(this, arguments);
        };
        AN.disconnect = function (dest) {
            if (dest && this !== vol && dest === ctx.destination && this.context === ctx) {
                var a = Array.prototype.slice.call(arguments);
                a[0] = entrada;
                return desconectar.apply(this, a);
            }
            return desconectar.apply(this, arguments);
        };
        try { desconectar.call(ae.gainNode, ctx.destination); conectar.call(ae.gainNode, entrada); } catch (e) {}
        aplicarAltavoz();
        return true;
    }

    function aplicarAltavoz() {
        var L = altavoz.L, R = altavoz.R;
        if (enDual()) {
            var v = (L ? 'L' : '') + (R ? 'R' : '');
            ls(ROL === 'sub' ? 'dr_altavoz' : 'dr_altavoz_main', v || '-');
        } else {
            L = R = true;   // pantalla normal: como siempre
        }
        if (audio) {
            var dos = L && R;
            audio.directo.gain.value = dos ? 1 : 0;
            audio.izq.gain.value = L && !dos ? 1 : 0;
            audio.der.gain.value = R && !dos ? 1 : 0;
        }
        $('.drx-key-L').each(function () { encendida(this, altavoz.L); });
        $('.drx-key-R').each(function () { encendida(this, altavoz.R); });
    }

    // ---------------------------------------------------------------
    // 4. Panel compacto y teclas (MAIN en DUAL y SUB)
    // ---------------------------------------------------------------
    // 2.1.17: fuera también RIT (sin las flechas que lo mueven no sirve)
    var QUITAR = { 'NR': 1, 'TS': 1, 'RIT': 1 };

    // RIT oculto: si estaba puesto, se quita (vuelve a la frecuencia de antes)
    function ritFuera() {
        try {
            var r = Plugins.rig_skin && Plugins.rig_skin._rit;
            if (r && r.isOn && r.isOn() && raizHtml.classList.contains('drx-marco')) r.set(false);
        } catch (e) {}
    }

    function marcarQuitadas() {
        var linea = document.getElementById('owrx-rig-knob-line');
        if (!linea) return;
        linea.querySelectorAll('.owrx-rig-key, .owrx-rig-zoom-key').forEach(function (k) {
            if (k.classList.contains('drx-key') || k.classList.contains('drx-quitada')) return;
            if (k.classList.contains('owrx-rig-zoom-key')) { k.classList.add('drx-quitada'); return; }
            var txt = '';
            k.childNodes.forEach(function (n) { if (n.nodeType === 3) txt += n.nodeValue; });
            if (QUITAR[txt.trim()]) k.classList.add('drx-quitada');
        });
    }

    function cambiarDisposicion() {
        if (ROL === 'sub') shell.cambiarDisposicion();
        else DR.cambiarDisposicion();
    }
    function salirDual() {
        if (ROL === 'sub') shell.salir();
        else DR.salir();
    }

    // teclas que solo existen en DUAL: L, R, ⇆/⇅ (y la tecla DUAL, que en el
    // MAIN está siempre y en DUAL sale encendida)
    function teclas() {
        var der = document.getElementById('owrx-rig-keys-right');
        if (!der) return false;
        var otra = document.getElementById('owrx-rig-keys-right2') || der;
        var kX = document.getElementById('drx-key-dual');
        if (!kX) {
            kX = tecla('DUAL', 'Doble receptor: pantalla dividida MAIN / SUB (otra vez: volver al receptor normal)', 'drx-key-salir');
            kX.id = 'drx-key-dual';
            kX.addEventListener('click', function () {
                if (enDual()) salirDual();
                else DR.entrar();
            });
        }
        if (!document.querySelector('.drx-key-L')) {
            var kL = tecla('L', 'Altavoz izquierdo: con o sin sonido de este receptor', 'drx-key-L drx-solo-dual');
            var kR = tecla('R', 'Altavoz derecho: con o sin sonido de este receptor', 'drx-key-R drx-solo-dual');
            kL.addEventListener('click', function () { altavoz.L = !altavoz.L; prepararAudio(); aplicarAltavoz(); });
            kR.addEventListener('click', function () { altavoz.R = !altavoz.R; prepararAudio(); aplicarAltavoz(); });
            var kD = tecla('⇆', 'Disposición: ⇆ un receptor a cada lado · ⇅ uno encima del otro (más ancho de cascada)',
                'drx-key-disp drx-solo-dual');
            kD.addEventListener('click', cambiarDisposicion);
            otra.appendChild(kL);
            otra.appendChild(kR);
            otra.appendChild(kD);
        }
        // DUAL siempre la última
        if (kX.parentNode !== otra || otra.lastElementChild !== kX) otra.appendChild(kX);
        encendida(kX, enDual());
        $('.drx-key-disp .drx-key-txt').text(disposicion() === 'filas' ? '⇅' : '⇆');
        aplicarAltavoz();
        return true;
    }

    // letrero MAIN / SUB en la esquina de la cascada
    function letrero() {
        var el = document.getElementById('drx-letrero');
        if (!enDual()) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('div');
            el.id = 'drx-letrero';
            el.setAttribute('translate', 'no');
            el.textContent = ROL === 'sub' ? 'SUB' : 'MAIN';
            document.body.appendChild(el);
        }
        var fc = document.getElementById('openwebrx-frequency-container');
        if (fc) el.style.top = Math.round(fc.getBoundingClientRect().bottom + 6) + 'px';
    }

    // alto máximo del panel rig: rig_skin encoge el panel para que quepa
    // bajo lo de arriba; se le pone una "barra" invisible más baja y él
    // mismo lo encoge más. Se mide desde el principio de su cascada, así
    // MAIN y SUB quedan del mismo tamaño.
    DR.ALTO_PANEL = { columnas: 0.60, filas: 0.70 };   // 2.1.9: sin la fila de circulitos, mismo tamaño de letra y menos alto (antes 0.62 y 0.80)
    function topeAlto() {
        var t = document.getElementById('drx-tope');
        if (!enDual()) {
            if (t) { t.remove(); avisarCambioTamano(); }
            return;
        }
        if (!t) {
            t = document.createElement('div');
            t.id = 'drx-tope';
            t.className = 'webrx-top-container';   // rig_skin mide esta clase
            t.setAttribute('aria-hidden', 'true');
            document.body.appendChild(t);
        }
        var fc = document.getElementById('openwebrx-frequency-container');
        var arriba = fc ? Math.max(0, Math.round(fc.getBoundingClientRect().top)) : 0;
        var h = arriba + Math.round((window.innerHeight - arriba) * (1 - DR.ALTO_PANEL[disposicion()]));
        if (t.style.height !== h + 'px') {
            t.style.height = h + 'px';
            avisarCambioTamano();
        }
    }

    // un SDR solo puede estar en un perfil a la vez: no dejar elegir otro
    // perfil del SDR que usa el otro receptor (le cambiaría la banda)
    function otraVentana() {
        try {
            if (ROL === 'sub') return window.parent;
            var f = document.getElementById('drx-sub');
            return f ? f.contentWindow : null;
        } catch (e) { return null; }
    }
    function guardaSdr() {
        var otro = null;
        if (enDual()) {
            try { otro = otraVentana().$('#openwebrx-sdr-profiles-listbox').val(); } catch (e) {}
        }
        var sdr = otro ? String(otro).split('|')[0] : null;
        var quien = ROL === 'sub' ? 'MAIN' : 'SUB';
        $l().find('option').each(function () {
            var bloq = !!sdr && String(this.value).split('|')[0] === sdr && this.value !== otro;
            if (bloq !== !!this.disabled) {
                this.disabled = bloq;
                this.title = bloq ? 'No disponible: es el mismo SDR que está usando el ' + quien +
                    ' (le cambiaría la banda). El perfil del ' + quien + ' sí se puede elegir.' : '';
            }
        });
    }

    // SUB: el estilo de rig_skin y de los plugins cambia según el tamaño de la
    // ventana (por ejemplo, el botón ANCHO y la disposición ancha solo existen
    // desde 900 px). El SUB es una ventana más pequeña que la del MAIN: cada
    // regla «@media» se resuelve igual que en la página del MAIN, así los dos
    // paneles tienen las mismas opciones.
    function igualarMedia() {
        if (ROL !== 'sub') return;
        var padre = window.parent, cambios = 0;
        function repasar(reglas) {
            for (var i = 0; i < reglas.length; i++) {
                var r = reglas[i];
                if (r.type !== 4 || !r.media) continue;          // CSSMediaRule
                if (r._drOriginal === undefined) r._drOriginal = r.media.mediaText;
                var orig = r._drOriginal;
                if (!orig || /^(all|not all|print)$/.test(orig)) continue;
                var vale;
                try { vale = padre.matchMedia(orig).matches; } catch (e) { continue; }
                var quiero = vale ? 'all' : 'not all';
                if (r.media.mediaText !== quiero) { r.media.mediaText = quiero; cambios++; }
            }
        }
        for (var s = 0; s < document.styleSheets.length; s++) {
            var hoja = document.styleSheets[s], reglas = null;
            try { reglas = hoja.cssRules; } catch (e) { continue; }   // hojas de otro sitio
            if (reglas) repasar(reglas);
        }
        if (cambios) avisarCambioTamano();
    }

    // botón DSP (audio_dsp) en la línea de la hora UTC y los dB, entre los dos,
    // bajo las lupas: en la pantalla normal, en el MAIN y en el SUB
    function dspEnLinea() {
        var icono = document.getElementById('audio-dsp-icon');
        var linea = document.querySelector('#openwebrx-panel-receiver .fp-display-bottom');
        if (!icono || !linea) return;
        raizHtml.classList.add('drx-dsp-linea');
        if (icono.parentNode !== linea) {
            var reloj = document.getElementById('openwebrx-clock-utc');
            if (reloj && reloj.parentNode === linea) linea.insertBefore(icono, reloj.nextSibling);
            else linea.appendChild(icono);
        }
    }

    // SUB: la ventana de audio_dsp está pensada para la pantalla entera y en la
    // mitad del SUB no cabe (se cortaba por abajo). Se reduce lo justo para que
    // se vea completa dentro de su mitad.
    function dspCabe() {
        if (ROL !== 'sub') return;
        var v = document.getElementById('audio-dsp-window');
        if (!v || !v.offsetWidth) return;
        var z = parseFloat(v.style.zoom) || 1;
        var r = v.getBoundingClientRect();
        var natW = r.width / z, natH = r.height / z;
        if (!natW || !natH) return;
        var W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
        var nuevo = Math.min(1, (H - 30) / natH, (W - 10) / natW);
        nuevo = Math.max(0.4, Math.floor(nuevo * 100) / 100);
        if (Math.abs(nuevo - z) >= 0.01) v.style.zoom = nuevo === 1 ? '' : String(nuevo);
    }

    // ---------------------------------------------------------------
    // SUB: ventana Audio DSP grande y movible por toda la pantalla, como la
    // del MAIN. El MAIN pone en DUAL una capa transparente del tamaño de la
    // pantalla (DR.portal); la ventana DSP del SUB se pasa a esa capa.
    // audio_dsp no se toca: el SUB sigue encontrando su ventana (búsquedas
    // por nombre), recibe sus clics y su arrastre. La capa solo atiende al
    // ratón cuando está encima de la ventana; el resto de la pantalla sigue
    // igual. La ventana del MAIN no se entera de los clics del SUB.
    // ---------------------------------------------------------------
    var portal = null;
    function enCapa() {
        return portal && portal.vent && portal.vent.ownerDocument === portal.doc ? portal.vent : null;
    }
    function lista(x) { return Array.prototype.slice.call(x || []); }

    // que las búsquedas del SUB encuentren también lo que está en la capa
    function puentesBusqueda() {
        if (document._drPuentes) return;
        document._drPuentes = true;
        var D = document;
        var gid = D.getElementById, q1 = D.querySelector, qa = D.querySelectorAll, gcl = D.getElementsByClassName;
        D.getElementById = function (id) {
            var r = gid.call(D, id);
            if (r) return r;
            var v = enCapa();
            if (!v) return null;
            if (v.id === id) return v;
            try { return v.querySelector('#' + CSS.escape(id)); } catch (e) { return null; }
        };
        D.querySelector = function (s) {
            var r = q1.call(D, s);
            if (r) return r;
            var v = enCapa();
            if (!v) return null;
            try { return v.matches(s) ? v : v.querySelector(s); } catch (e) { return null; }
        };
        D.querySelectorAll = function (s) {
            var r = qa.call(D, s), v = enCapa();
            if (!v) return r;
            var mas;
            try { mas = (v.matches(s) ? [v] : []).concat(lista(v.querySelectorAll(s))); } catch (e) { return r; }
            return mas.length ? lista(r).concat(mas) : r;
        };
        D.getElementsByClassName = function (c) {
            var r = gcl.call(D, c), v = enCapa();
            if (!v) return r;
            var mas = lista(v.getElementsByClassName(c));
            var todas = String(c).split(/\s+/).filter(Boolean);
            if (todas.length && todas.every(function (x) { return v.classList.contains(x); })) mas.unshift(v);
            return mas.length ? lista(r).concat(mas) : r;
        };
    }

    function dspGrande() {
        if (ROL !== 'sub') return false;
        puentesBusqueda();
        var vent = document.getElementById('audio-dsp-window');
        if (!vent) return false;
        if (enCapa() === vent) return true;
        var P = null;
        try { P = window.parent.Plugins.doble_receptor.portal(); } catch (e) { P = null; }
        if (!P || !P.contentDocument) return false;
        var pdoc = P.contentDocument, pwin = P.contentWindow;

        // estilos del SUB en la capa (mismo aspecto), con fondo transparente
        pdoc.head.innerHTML = '<meta charset="utf-8">';
        lista(document.querySelectorAll('link[rel~="stylesheet"], style')).forEach(function (n) {
            if (n.ownerDocument === document) pdoc.head.appendChild(pdoc.importNode(n, true));
        });
        var st = pdoc.createElement('style');
        st.textContent = ':root{color-scheme:normal!important}' +
            'html,body{background:transparent!important;margin:0!important;padding:0!important;' +
            'overflow:hidden!important;width:100%!important;height:100%!important;min-height:0!important}' +
            '#audio-dsp-window{max-height:calc(100vh - 20px)!important;zoom:1!important}' +
            '.drx-dsp-sub{display:inline-block;margin:0 8px 0 2px;padding:0 6px;border-radius:3px;' +
            'background:#ffb02e;color:#000;font:bold 10px/15px sans-serif;letter-spacing:1px;vertical-align:middle}';
        pdoc.head.appendChild(st);
        pdoc.body.innerHTML = '';
        pdoc.body.className = document.body.className;
        pdoc.body.setAttribute('translate', 'no');

        // la ventana a la capa, centrada sobre la mitad del SUB mientras no se haya movido
        vent.style.zoom = '';
        pdoc.body.appendChild(vent);
        portal = { iframe: P, doc: pdoc, win: pwin, vent: vent, arrastrando: false };
        try {
            if (/translateX\(-50%\)/.test(vent.style.transform || '')) {
                var fr = window.frameElement.getBoundingClientRect();
                vent.style.left = Math.round(fr.left + fr.width / 2) + 'px';
            }
        } catch (e) {}
        var barra = vent.querySelector('#audio-dsp-titlebar');
        if (barra && !barra.querySelector('.drx-dsp-sub')) {
            var et = pdoc.createElement('span');
            et.className = 'drx-dsp-sub';
            et.textContent = 'SUB';
            barra.insertBefore(et, barra.firstChild);
        }
        puentesEventos(portal);
        return true;
    }

    // los clics, cambios y arrastres de la capa llegan al SUB como si
    // la ventana siguiera en su página
    function puentesEventos(pt) {
        var pdoc = pt.doc;
        ['click', 'dblclick', 'change', 'input', 'mousemove', 'mouseover', 'mouseout', 'mousedown',
         'mouseup', 'contextmenu', 'wheel', 'keydown', 'keyup', 'focusin', 'focusout'].forEach(function (t) {
            pdoc.addEventListener(t, function (e) {
                try { $.event.dispatch.call(document, e); } catch (err) {}
            }, false);
        });
        // arrastre de audio_dsp (usa document.onmousemove / onmouseup del SUB)
        pdoc.addEventListener('mousemove', function (e) {
            if (typeof document.onmousemove === 'function') { try { document.onmousemove(e); } catch (err) {} }
            if (!pt.arrastrando && !sobreVentana(e.clientX, e.clientY)) pt.iframe.style.pointerEvents = 'none';
        }, true);
        pdoc.addEventListener('mousedown', function () { pt.arrastrando = true; }, true);
        pdoc.addEventListener('mouseup', function (e) {
            pt.arrastrando = false;
            if (typeof document.onmouseup === 'function') { try { document.onmouseup(e); } catch (err) {} }
        }, true);
        // tras un clic (por ejemplo, cerrar la ventana) se mira si sigue debajo del ratón
        pdoc.addEventListener('click', function (e) {
            var x = e.clientX, y = e.clientY;
            setTimeout(function () {
                if (!pt.arrastrando && !sobreVentana(x, y)) pt.iframe.style.pointerEvents = 'none';
            }, 0);
        }, false);
        // la capa atiende al ratón solo encima de la ventana
        function mirar(x, y) {
            if (sobreVentana(x, y)) pt.iframe.style.pointerEvents = 'auto';
        }
        try {
            window.parent.document.addEventListener('mousemove', function (e) {
                try { mirar(e.clientX, e.clientY); } catch (err) {}
            }, true);
        } catch (e) {}
        document.addEventListener('mousemove', function (e) {
            try {
                var fr = window.frameElement.getBoundingClientRect();
                mirar(e.clientX + fr.left, e.clientY + fr.top);
            } catch (err) {}
        }, true);
    }
    function sobreVentana(x, y) {
        var v = enCapa();
        if (!v || !v.offsetWidth) return false;
        var r = v.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    // Temblor del panel en DUAL: rig_skin reajusta el panel cada vez que su
    // contenido cambia un poco (S-meter, textos, dibujos del LCD). Con el
    // panel reducido, cada ajuste sale 1-3 px más o menos de ancho y una
    // escala algo distinta, y el panel va y viene entre dos tamaños casi
    // iguales. En DUAL, los cambios muy pequeños de ancho o escala se
    // ignoran (se mantiene el valor anterior); los de verdad pasan igual.
    DR.TOLERANCIA = { width: 6, zoom: 0.015 };
    // Cortacircuitos: si aun así el panel entra en bucle (cambia de tamaño
    // más de 6 veces en 2 s, cada vez rig_skin lo reajusta y eso se come un
    // tercio del navegador), se le fija el ancho y la escala 10 s. Cambiar
    // la ventana o la disposición lo suelta al momento.
    DR._bloqueo = 0;
    DR.soltar = function () { DR._bloqueo = 0; };
    function sinTemblor() {
        var p = document.getElementById('openwebrx-panel-receiver');
        if (!p || p._drSinTemblor) return;
        p._drSinTemblor = true;
        var st = p.style, poner = st.setProperty;
        var ultimo = {};
        st.setProperty = function (prop, valor, prioridad) {
            prioridad = prioridad || '';
            if (enDual() && DR.TOLERANCIA[prop] && valor !== '' && ultimo[prop] &&
                    ultimo[prop].p === prioridad) {
                var antes = parseFloat(ultimo[prop].v), ahora = parseFloat(valor);
                var bloqueado = Date.now() < DR._bloqueo;
                if (!isNaN(antes) && !isNaN(ahora) && antes !== ahora &&
                        (bloqueado || Math.abs(antes - ahora) <= DR.TOLERANCIA[prop])) {
                    valor = ultimo[prop].v;
                }
            }
            if (DR.TOLERANCIA[prop]) ultimo[prop] = valor === '' ? null : { v: valor, p: prioridad };
            return poner.call(st, prop, valor, prioridad);
        };
        // vigilar el bucle
        if (typeof ResizeObserver === 'function') {
            var cambios = [], tamAnt = '';
            new ResizeObserver(function (es) {
                if (!enDual()) return;
                var r = es[es.length - 1].contentRect;
                var tam = Math.round(r.width) + 'x' + Math.round(r.height);
                if (tam === tamAnt) return;
                tamAnt = tam;
                var ahora = Date.now();
                cambios.push(ahora);
                while (cambios.length && ahora - cambios[0] > 2000) cambios.shift();
                if (cambios.length > 6 && ahora >= DR._bloqueo) {
                    DR._bloqueo = ahora + 10000;
                    cambios = [];
                    DR._cortes = (DR._cortes || 0) + 1;
                }
            }).observe(p);
        }
        window.addEventListener('resize', function (e) { if (e.isTrusted) DR.soltar(); });
    }

    function cadaRato() {
        sinTemblor();
        dspEnLinea();
        if (!dspGrande()) dspCabe();
        // ventana cerrada: la capa no atiende al ratón
        if (portal && !portal.arrastrando) {
            var vv = enCapa();
            if (!vv || !vv.offsetWidth) { try { portal.iframe.style.pointerEvents = 'none'; } catch (e) {} }
        }
        igualarMedia();
        if (teclas()) marcarQuitadas();
        ritFuera();
        letrero();
        pintarActivo();
        topeAlto();
        guardaSdr();
        if (!audio) prepararAudio();
        if (ROL === 'main' && enDual()) colocar();
        if (ROL === 'main') columnaFuera(enDual());
    }

    // ---------------------------------------------------------------
    // 5. MAIN: pantalla dividida
    // ---------------------------------------------------------------
    var medidas = null;    // anchura y altura que ve OpenWebRX en DUAL
    var anchoReal = null, altoReal = null;

    // OpenWebRX y rig_skin dibujan la escala, el zoom y el panel con el
    // ancho y alto de la ventana: en DUAL se les da el de la mitad del MAIN
    function falsearVentana(on) {
        if (on && !anchoReal) {
            anchoReal = Object.getOwnPropertyDescriptor(window, 'innerWidth') || null;
            altoReal = Object.getOwnPropertyDescriptor(window, 'innerHeight') || null;
            var leer = function (p, real) {
                return function () {
                    if (medidas && medidas[p]) return medidas[p];
                    return real ? real.get.call(window) : document.documentElement['client' + (p === 'w' ? 'Width' : 'Height')];
                };
            };
            var rw = anchoReal || Object.getOwnPropertyDescriptor(Window.prototype, 'innerWidth');
            var rh = altoReal || Object.getOwnPropertyDescriptor(Window.prototype, 'innerHeight');
            DR._anchoVentana = function () { return rw && rw.get ? rw.get.call(window) : document.documentElement.clientWidth; };
            DR._altoVentana = function () { return rh && rh.get ? rh.get.call(window) : document.documentElement.clientHeight; };
            Object.defineProperty(window, 'innerWidth', { configurable: true, get: leer('w', rw) });
            Object.defineProperty(window, 'innerHeight', { configurable: true, get: leer('h', rh) });
            // ancho de la cascada (openwebrx.js lo toma del body entero)
            if (typeof window.waterfallWidth === 'function' && !DR._wfOriginal) {
                DR._wfOriginal = window.waterfallWidth;
                window.waterfallWidth = function () {
                    return medidas && medidas.w ? medidas.w : DR._wfOriginal();
                };
            }
        } else if (!on && DR._anchoVentana) {
            medidas = null;
            if (DR._wfOriginal) { window.waterfallWidth = DR._wfOriginal; DR._wfOriginal = null; }
            if (anchoReal) Object.defineProperty(window, 'innerWidth', anchoReal); else delete window.innerWidth;
            if (altoReal) Object.defineProperty(window, 'innerHeight', altoReal); else delete window.innerHeight;
            anchoReal = altoReal = null;
            DR._anchoVentana = DR._altoVentana = null;
        }
    }

    // el letrero del tiempo está dentro de la caja de la cascada: en DUAL
    // se pone justo encima, para que siga a todo el ancho
    var meteoSitio = null;
    function moverMeteo(on) {
        var m = document.getElementById('ea7-meteo');
        var wc = document.querySelector('#webrx-page-container > .openwebrx-waterfall-container');
        if (!m || !wc) return;
        if (on && m.parentNode === wc) {
            meteoSitio = { padre: wc, antes: m.nextSibling };
            wc.parentNode.insertBefore(m, wc);
        } else if (!on && meteoSitio && m.parentNode !== meteoSitio.padre) {
            meteoSitio.padre.insertBefore(m, meteoSitio.antes && meteoSitio.antes.parentNode === meteoSitio.padre ? meteoSitio.antes : meteoSitio.padre.firstChild);
            meteoSitio = null;
        }
    }

    function colocar() {
        var wc = document.querySelector('#webrx-page-container > .openwebrx-waterfall-container');
        var f = document.getElementById('drx-sub');
        if (!wc || !f || !DR._anchoVentana) return;
        moverMeteo(true);
        var W = DR._anchoVentana(), H = DR._altoVentana();
        var arriba = Math.round(wc.getBoundingClientRect().top);
        var raya = 3, m;
        if (disposicion() === 'filas') {
            var hm = Math.floor((H - arriba - raya) / 2);
            m = { w: W, h: arriba + hm };
            wc.style.width = '';
            wc.style.height = hm + 'px';
            wc.style.flex = 'none';
            pos(f, 0, arriba + hm + raya, W, H - arriba - hm - raya);
        } else {
            var wm = Math.floor((W - raya) / 2);
            m = { w: wm, h: H };
            wc.style.width = wm + 'px';
            wc.style.height = '';
            wc.style.flex = '';
            pos(f, wm + raya, arriba, W - wm - raya, H - arriba);
        }
        if (!medidas || medidas.w !== m.w || medidas.h !== m.h) {
            medidas = m;
            avisarCambioTamano();
        }
    }
    // 2.1.16: la columna de botones de plugins (DOP, LST, MEM) cuelga por
    // fuera del panel de control, a su izquierda. En DUAL el panel tiene
    // media pantalla: al abrir los pases (SAT) no cabe, rig_skin le pone
    // barra de desplazamiento y eso recorta lo que sobresale: la columna
    // desaparecía. En DUAL se saca la columna del panel y se coloca al
    // lado, en el mismo sitio de siempre
    var columna = null;    // { el, padre, antes } mientras está fuera
    function columnaFuera(on) {
        var c = document.getElementById('openwebrx-panel-plugins');
        var rp = document.getElementById('openwebrx-panel-receiver');
        if (on && !columna && c && rp && c.parentNode === rp) {
            columna = { el: c, padre: rp, antes: c.nextSibling };
            c.classList.add('drx-columna');
            document.body.appendChild(c);
            (function seguir() {
                if (!columna) return;
                ponerColumna();
                requestAnimationFrame(seguir);
            })();
        } else if (!on && columna) {
            var x = columna;
            columna = null;
            x.el.classList.remove('drx-columna');
            x.el.style.left = x.el.style.top = x.el.style.display = '';
            x.padre.insertBefore(x.el, x.antes && x.antes.parentNode === x.padre ? x.antes : null);
        }
    }
    function ponerColumna() {
        var c = columna.el, rp = columna.padre;
        var r = rp.getBoundingClientRect();
        var ver = rp.offsetParent !== null && r.width > 0 && getComputedStyle(rp).display !== 'none';
        var d = ver ? '' : 'none';
        if (c.style.display !== d) c.style.display = d;
        if (!ver) return;
        // igual que el original: a la izquierda del panel (5 px) y a 10 px de su borde de abajo
        var x = Math.round(r.left - c.offsetWidth - 5) + 'px';
        var y = Math.round(r.bottom - 10 - c.offsetHeight) + 'px';
        if (c.style.left !== x) c.style.left = x;
        if (c.style.top !== y) c.style.top = y;
    }

    function pos(el, x, y, w, h) {
        var s = el.style, v = [x + 'px', y + 'px', w + 'px', h + 'px'];
        if (s.left !== v[0]) s.left = v[0];
        if (s.top !== v[1]) s.top = v[1];
        if (s.width !== v[2]) s.width = v[2];
        if (s.height !== v[3]) s.height = v[3];
    }

    DR.entrar = function () {
        DR.soltar();
        if (enDual() || ROL !== 'main') return;
        if (window.parent !== window) return;    // nunca una pantalla dividida dentro de otra
        ls('dr_dual', '1');
        var d = ls('dr_disposicion') === 'filas' ? 'filas' : 'columnas';
        raizHtml.classList.add('drx-dual', 'drx-marco', 'drx-main', 'drx-' + d);
        raizHtml.setAttribute('translate', 'no');
        window.DR_SHELL = {
            version: DR.version,
            disposicion: disposicion,
            activo: function () { return DR.activo; },
            marcar: function (q) { DR.marcar(q); },
            cambiarDisposicion: function () { DR.cambiarDisposicion(); },
            salir: function () { setTimeout(DR.salir, 0); }
        };
        falsearVentana(true);
        moverMeteo(true);
        var f = document.createElement('iframe');
        f.id = 'drx-sub';
        f.name = 'drx-sub';
        f.title = 'SUB';
        f.setAttribute('allow', 'autoplay; fullscreen; clipboard-write');
        // la página del receptor (sin lo que haya tras # o ?)
        f.src = location.href.split('#')[0].split('?')[0];
        document.body.appendChild(f);
        colocar();
        cadaRato();
        setTimeout(avisarCambioTamano, 300);
    };

    // capa transparente a pantalla completa para ventanas del SUB (Audio DSP)
    DR.portal = function () {
        if (ROL !== 'main' || !enDual()) return null;
        var p = document.getElementById('drx-portal');
        if (!p) {
            p = document.createElement('iframe');
            p.id = 'drx-portal';
            p.setAttribute('aria-hidden', 'true');
            p.setAttribute('tabindex', '-1');
            document.body.appendChild(p);
            var d = p.contentDocument;
            d.open();
            d.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
            d.close();
        }
        return p;
    };

    DR.salir = function () {
        DR.soltar();
        if (!enDual() || ROL !== 'main') return;
        ls('dr_dual', '0');
        var capa = document.getElementById('drx-portal');
        if (capa) capa.remove();
        var f = document.getElementById('drx-sub');
        if (f) { try { f.src = 'about:blank'; } catch (e) {} f.remove(); }
        var wc = document.querySelector('#webrx-page-container > .openwebrx-waterfall-container');
        if (wc) { wc.style.width = ''; wc.style.height = ''; wc.style.flex = ''; }
        raizHtml.classList.remove('drx-dual', 'drx-marco', 'drx-main', 'drx-columnas', 'drx-filas');
        moverMeteo(false);
        falsearVentana(false);
        try { delete window.DR_SHELL; } catch (e) { window.DR_SHELL = undefined; }
        DR.activo = 'main';
        cadaRato();
        avisarCambioTamano();
        setTimeout(avisarCambioTamano, 300);
    };

    DR.cambiarDisposicion = function () {
        DR.soltar();
        if (!enDual() || ROL !== 'main') return;
        var d = disposicion() === 'filas' ? 'columnas' : 'filas';
        ls('dr_disposicion', d);
        raizHtml.classList.toggle('drx-filas', d === 'filas');
        raizHtml.classList.toggle('drx-columnas', d !== 'filas');
        colocar();
        cadaRato();
        avisarCambioTamano();
        try { otraVentana().Plugins.doble_receptor._disposicionCambiada(); } catch (e) {}
    };

    // SUB: la disposición la manda el MAIN
    DR._disposicionCambiada = function () {
        DR.soltar();
        cadaRato();
        avisarCambioTamano();
    };

    // lo que está escuchando esta página
    DR.estado = function () {
        var d = {};
        try { d.p = $l().val(); } catch (e) {}
        try { d.f = UI.getFrequency(); } catch (e) {}
        try { d.m = UI.getModulation(); } catch (e) {}
        return d;
    };

    // ---------------------------------------------------------------
    // 6. Receptor marcado (2.1.12-13). Lo que está una sola vez arriba o en
    //    el MAIN (botón QRG, lista de oyentes LST) actúa sobre el receptor
    //    marcado. Se marca al pulsar en su cascada, en su panel o en su
    //    letrero. El marcado lleva el letrero encendido y un borde de su
    //    color en el panel; el otro, el letrero apagado.
    // ---------------------------------------------------------------
    DR.activo = 'main';
    function htmlDe(quien) {
        if (quien === ROL) return raizHtml;
        try { return otraVentana().document.documentElement; } catch (e) { return null; }
    }
    function pintarActivo() {
        var dual = enDual();
        var act = ROL === 'sub' ? shell.activo() : DR.activo;
        ['main', 'sub'].forEach(function (q) {
            var h = htmlDe(q);
            if (h) h.classList.toggle('drx-activo', dual && act === q);
        });
        // la lista de oyentes dice dónde va a sintonizar
        if (ROL === 'main') {
            var pista = document.querySelector('.owrx-listeners__hint');
            if (pista) {
                var t = dual ? 'Pulsa una fila para sintonizarla en el ' + (act === 'sub' ? 'SUB' : 'MAIN') +
                    ' (el receptor marcado; se marca pulsando en su cascada o en su panel).'
                    : 'Pulsa una fila para sintonizar esa frecuencia.';
                if (pista.textContent !== t) pista.textContent = t;
            }
        }
    }
    DR.marcar = function (quien) {
        if (ROL === 'sub') { shell.marcar(quien); return; }
        quien = quien === 'sub' && enDual() ? 'sub' : 'main';
        if (DR.activo === quien) return;
        DR.activo = quien;
        pintarActivo();
    };
    function aviso(texto) {
        var a = document.getElementById('drx-aviso');
        if (!a) {
            a = document.createElement('div');
            a.id = 'drx-aviso';
            a.setAttribute('translate', 'no');
            document.body.appendChild(a);
        }
        a.textContent = texto;
        a.style.display = 'block';
        clearTimeout(aviso.t);
        aviso.t = setTimeout(function () { a.style.display = 'none'; }, 5000);
    }
    // 2.1.14: todo lo que sintoniza con rig_skin (DX, SAT, bandas, teclado
    // de frecuencia...) pasa por Plugins.rig_skin.tuneTo. En DUAL:
    //  - MAIN: si se pulsó en las ventanas DX o SAT con el SUB marcado, se
    //    sintoniza en el SUB;
    //  - los dos: una frecuencia fuera de la banda del receptor obliga a
    //    mover el SDR («setfrequency»). Si el otro receptor usa el mismo SDR
    //    se le movería también su banda (y el ir y venir de los dos acaba con
    //    el bloqueo antirrobot del servidor: 12 horas sin poder entrar). En
    //    ese caso no se hace y sale un aviso.
    var VENTANAS_SINTONIA = '#plugin-window-rig-dx, #plugin-window-rig-sat, #owrx-rig-dx, #owrx-rig-satwin';
    var toqueVentanas = 0, satSub = 0;
    function clicEnVentanas() {
        var ev = window.event;
        if (ev && ev.target && ev.target.closest && ev.target.closest(VENTANAS_SINTONIA)) return true;
        // por si la ventana sintoniza un momento después del clic
        return Date.now() - toqueVentanas < 1500;
    }
    function fueraDeBanda(win, f) {
        try {
            if (typeof win.center_freq !== 'number' || typeof win.bandwidth !== 'number') return false;
            return !(Math.abs(f - win.center_freq) < win.bandwidth / 2 - 10000);
        } catch (e) { return false; }
    }
    function mismoSdr() {
        try {
            var a = $l().val(), b = otraVentana().$('#openwebrx-sdr-profiles-listbox').val();
            return !!a && !!b && String(a).split('|')[0] === String(b).split('|')[0];
        } catch (e) { return false; }
    }
    function sintoniaSegura() {
        if (ROL === 'main') {
            document.addEventListener('pointerdown', function (e) {
                toqueVentanas = e.target && e.target.closest && e.target.closest(VENTANAS_SINTONIA) ? Date.now() : 0;
            }, true);
        }
        // 2.1.15: otros plugins (profile_jump) envuelven también tuneTo y, si
        // lo hacen después, actúan antes (profile_jump cambiaba el perfil del
        // MAIN sin llegar a pasar por aquí). Se mira cada rato y, si el de
        // fuera no es este, se vuelve a envolver: el doble receptor decide
        // siempre primero
        setInterval(envolverTuneTo, 700);
        envolverTuneTo();
    }
    var dentroTuneTo = false;
    function sdrDe(clave) { return String(clave || '').split('|')[0]; }
    // perfil al que saltaría profile_jump para esa frecuencia (o null)
    function saltoDePerfil(f, mode) {
        try {
            var pj = Plugins.profile_jump;
            if (!pj || !pj.profiles || !pj.profiles.length || typeof pj.find !== 'function') return null;
            if (mode && pj.DIALS && pj.DIALS[mode] && typeof pj.snap === 'function') f = pj.snap(f, mode);
            var p = pj.find(f);
            return p && p.key !== $l().val() ? p : null;
        } catch (e) { return null; }
    }
    function envolverTuneTo() {
        var R = Plugins.rig_skin;
        if (!R || typeof R.tuneTo !== 'function' || R.tuneTo._drx) return;
        var orig = R.tuneTo;
        var nuevo = function (f, mode) {
            if (dentroTuneTo || !enDual()) return orig.apply(this, arguments);
            dentroTuneTo = true;
            try { return decidir.call(this, orig, arguments, f, mode); }
            finally { dentroTuneTo = false; }
        };
        nuevo._drx = true;
        // que profile_jump no vuelva a envolver encima
        if (orig._profile_jump) nuevo._profile_jump = true;
        R.tuneTo = nuevo;
    }
    function decidir(orig, args, f, mode) {
                if (ROL === 'main' && DR.activo === 'sub' && clicEnVentanas()) {
                    toqueVentanas = 0;
                    try {
                        var RS = otraVentana().Plugins.rig_skin;
                        if (RS && typeof RS.tuneTo === 'function') {
                            var ev = window.event;
                            if (ev && ev.target && ev.target.closest && ev.target.closest('#plugin-window-rig-sat, #owrx-rig-satwin')) satSub = Date.now();
                            return RS.tuneTo(f, mode);
                        }
                    } catch (e) {}
                    aviso('El SUB todavía no está listo.');
                    return;
                }
                if (f && fueraDeBanda(window, f)) {
                    var yo = ROL === 'sub' ? 'SUB' : 'MAIN', otro = ROL === 'sub' ? 'MAIN' : 'SUB';
                    var otroPerfil = null;
                    try { otroPerfil = otraVentana().$('#openwebrx-sdr-profiles-listbox').val(); } catch (e) {}
                    var salto = saltoDePerfil(f, mode);
                    if (salto) {
                        // profile_jump cambiará de perfil: no a otro perfil del SDR del otro receptor
                        if (otroPerfil && sdrDe(salto.key) === sdrDe(otroPerfil) && salto.key !== otroPerfil) {
                            var op = null;
                            try { op = $l().find('option').filter(function () { return this.value === salto.key; }).text(); } catch (e) {}
                            aviso((f / 1e6).toFixed(4) + ' MHz: el perfil que la tiene' + (op ? ' («' + op + '»)' : '') +
                                ' es del mismo SDR que usa el ' + otro + ' (le cambiaría la banda). No se cambia el ' + yo + '.');
                            return;
                        }
                    } else if (mismoSdr()) {
                        aviso((f / 1e6).toFixed(4) + ' MHz está fuera de la banda del ' + yo + '. Para ir allí habría que mover el SDR, ' +
                            'y es el mismo que usa el ' + otro + ' (le cambiaría la banda). Pon antes en el ' + yo + ' un perfil de esa banda.');
                        return;
                    }
                }
                return orig.apply(this, args);
    }

    function vigilarMarcado() {
        // pulsar en el receptor lo marca
        document.addEventListener('pointerdown', function (e) {
            if (!enDual() || !e.target || !e.target.closest) return;
            if (ROL === 'sub') { DR.marcar('sub'); return; }
            if (e.target.closest('.openwebrx-plugin-stack, #openwebrx-panel-plugins, [id^="plugin-window-"]')) return;
            if (e.target.closest('#webrx-page-container > .openwebrx-waterfall-container, #openwebrx-panel-receiver, #drx-letrero')) {
                DR.marcar('main');
            }
        }, true);
        sintoniaSegura();
        if (ROL !== 'main') return;
        // QRG: abre o cierra el panel del receptor marcado
        document.addEventListener('click', function (e) {
            if (!enDual() || DR.activo !== 'sub' || !e.target || !e.target.closest) return;
            var b = e.target.closest('[data-toggle-panel="openwebrx-panel-receiver"]');
            if (!b) return;
            var w = otraVentana();
            if (!w || typeof w.toggle_panel !== 'function') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            w.toggle_panel('openwebrx-panel-receiver');
        }, true);
        // WATCH (2.1.13): cada ventana WATCH es del receptor que la crea (su
        // cascada pequeña y su sonido salen de ese receptor). Con el SUB
        // marcado, el botón crea la del SUB (sale en la mitad del SUB); con
        // el botón derecho, se esconden o enseñan las del SUB
        ['click', 'contextmenu'].forEach(function (tipo) {
            document.addEventListener(tipo, function (e) {
                if (!enDual() || DR.activo !== 'sub' || !e.target || !e.target.closest) return;
                if (!e.target.closest('#owrx-rig-watch-button')) return;
                var w = otraVentana();
                if (!w || !w.$) return;
                var b = w.document.getElementById('owrx-rig-watch-button');
                if (!b) return;
                e.stopImmediatePropagation();
                e.preventDefault();
                w.$(b).trigger(tipo);
            }, true);
        });
        // DX y SAT (2.1.13): sus ventanas siguen en el MAIN (grandes y
        // movibles), pero lo que se pulsa en ellas sintoniza el receptor
        // marcado. rig_skin sintoniza siempre con Plugins.rig_skin.tuneTo:
        // si la llamada viene de un clic dentro de esas ventanas y el SUB
        // está marcado, se hace en el SUB
        // (el desvío al SUB está en sintoniaSegura(), más abajo)
        // el seguimiento Doppler del satélite elegido va con él al SUB
        var trig = $.fn.trigger;
        $.fn.trigger = function (tipo, datos) {
            if (tipo === 'owrxplus:satellite-tuned' && satSub && Date.now() - satSub < 2000 && this[0] === document) {
                satSub = 0;
                try { var w = otraVentana(); w.$(w.document).trigger(tipo, datos); } catch (e) {}
                return this;
            }
            return trig.apply(this, arguments);
        };
        // LST: la fila pulsada se sintoniza en el receptor marcado, y nunca en
        // un perfil del mismo SDR que usa el otro (le cambiaría la banda)
        var n = 0;
        var iv = setInterval(function () {
            var L = Plugins.listeners;
            if (!L || typeof L._tune !== 'function') { if (++n > 60) clearInterval(iv); return; }
            clearInterval(iv);
            if (L._tuneDR) return;
            var original = L._tune;
            L._tuneDR = true;
            L._tune = function (data) {
                if (!enDual()) return original.apply(this, arguments);
                var aSub = DR.activo === 'sub';
                var w = aSub ? otraVentana() : window;
                var nombre = aSub ? 'SUB' : 'MAIN', otro = aSub ? 'MAIN' : 'SUB';
                try {
                    var sel = w.document.getElementById('openwebrx-sdr-profiles-listbox');
                    var opt = sel && data && Array.prototype.find.call(sel.options, function (o) { return o.value === data.profile_key; });
                    if (opt && opt.disabled) {
                        aviso('No se sintoniza en el ' + nombre + ': ese perfil es del mismo SDR que está usando el ' +
                            otro + ' (le cambiaría la banda).');
                        return;
                    }
                } catch (e) {}
                if (!aSub) return original.apply(this, arguments);
                try {
                    var LS = w.Plugins.listeners;
                    if (LS && typeof LS._tune === 'function') return LS._tune(data);
                } catch (e) {}
                aviso('El SUB todavía no está listo.');
            };
        }, 500);
    }

    // 2.1.19: el SUB es un iframe. Si al mover o agrandar una ventana del
    // MAIN (LST, DX, SAT, MEM...) se suelta el ratón encima del SUB, el MAIN
    // no se entera y la ventana sigue pegada al ratón (se movía o se ponía
    // muy ancha sola hasta el siguiente clic). Mientras el botón está
    // pulsado en el MAIN, el SUB no recibe el ratón: todo llega al MAIN
    function ratonSoloMain() {
        var tapado = false;
        function tapar() {
            if (!enDual()) return;
            var f = document.getElementById('drx-sub');
            if (!f) return;
            f.style.pointerEvents = 'none';
            tapado = true;
        }
        function destapar() {
            if (!tapado) return;
            tapado = false;
            var f = document.getElementById('drx-sub');
            if (f) f.style.pointerEvents = '';
        }
        window.addEventListener('pointerdown', tapar, true);
        window.addEventListener('mousedown', tapar, true);
        ['pointerup', 'pointercancel', 'mouseup', 'blur', 'dragend'].forEach(function (t) {
            window.addEventListener(t, function () { setTimeout(destapar, 0); }, true);
        });
        // por si acaso: con el botón suelto y el ratón moviéndose, se destapa
        window.addEventListener('mousemove', function (e) { if (tapado && !e.buttons) destapar(); }, true);
    }

    DR.init = function () {
        setInterval(cadaRato, 700);
        vigilarMarcado();
        if (ROL === 'main') ratonSoloMain();
        if (ROL === 'main') {
            window.addEventListener('resize', function () { if (enDual()) colocar(); });
            // se recuerda: si se dejó en DUAL, se vuelve a DUAL
            if (ls('dr_dual') === '1') {
                var n = 0;
                var iv = setInterval(function () {
                    if (document.getElementById('owrx-rig-keys-right') || ++n > 20) {
                        clearInterval(iv);
                        DR.entrar();
                    }
                }, 500);
            }
        } else {
            setTimeout(avisarCambioTamano, 2500);
            document.addEventListener('click', function (e) {
                if (e.target && e.target.closest && e.target.closest('#audio-dsp-icon')) {
                    setTimeout(function () { if (!dspGrande()) dspCabe(); }, 0);
                }
            }, true);
            window.addEventListener('resize', function () { setTimeout(function () { if (!enCapa()) dspCabe(); }, 50); });
        }
        return true;
    };
})();
