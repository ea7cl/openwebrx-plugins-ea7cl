/*
 * doppler_autostart 0.6 (EA7CL) · arranque automático del Doppler desde SAT
 *
 * Al elegir un satélite en la ventana SAT de rig_skin (rig_skin avisa con el
 * evento «owrxplus:satellite-tuned»), pone en marcha el seguimiento Doppler
 * del plugin doppler (0xAF) con los datos del satélite de CelesTrak.
 *
 * Novedades de la 0.2 frente a la 0.1:
 *  - espera a que el receptor haya llegado a la frecuencia del satélite
 *    antes de arrancar (el Doppler toma como base la frecuencia que hay en
 *    ese momento; si arrancaba antes, se quedaba anclado en la anterior);
 *  - se para solo en cuanto el oyente sintoniza otra cosa (clic en la
 *    cascada, DX, bandas, rueda, cambio de perfil...). Antes seguía
 *    devolviendo el receptor a la frecuencia del satélite cada segundo;
 *  - el botón DOP se enciende (estilo botones_ea7cl) mientras hay
 *    seguimiento, lo arranque este plugin o el botón TRACK;
 *  - mensajes en español en la línea del satélite.
 *
 * Funciona igual en cada receptor del doble receptor: cada uno tiene su
 * propio Doppler.
 */
Plugins.doppler_autostart = Plugins.doppler_autostart || {};
Plugins.doppler_autostart._version = 0.6;
Plugins.doppler_autostart.no_css = true;

// margen para dar por llegada la frecuencia (el Doppler en 70 cm es de ±10 kHz)
Plugins.doppler_autostart.MARGEN_HZ = 100000;
// tiempo máximo esperando a que el receptor llegue al satélite
Plugins.doppler_autostart.ESPERA_MS = 15000;
// un cambio de frecuencia que no hace el Doppler, mayor que esto, lo para
Plugins.doppler_autostart.TOLERANCIA_HZ = 500;

Plugins.doppler_autostart.init = function () {
    var self = Plugins.doppler_autostart;
    var cache = {}, pedido = 0;
    var deDoppler = false;      // la siguiente sintonía la hace el Doppler

    function D() { return Plugins.doppler; }
    function siguiendo() { return !!(D() && D().intervalId != null); }
    function estado(t) { $('#satellite-name').text(t); }
    function frecuencia() {
        try {
            var d = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator();
            return d.get_offset_frequency() + center_freq;
        } catch (e) { return null; }
    }
    // 0.6: al ir a escuchar un satélite se quita el silenciador (squelch
    // al mínimo = abierto), como si el oyente bajara la barra SQ del todo
    function abrirSilenciador() {
        try {
            var $s = $('#openwebrx-panel-receiver .openwebrx-squelch-slider');
            if (!$s.length) return;
            var min = String($s.attr('min') || -150);
            if (String($s.val()) !== min) $s.val(min).trigger('change');
        } catch (e) {}
    }
    function parar(motivo) {
        if (siguiendo() && typeof D().stop_tracker === 'function') D().stop_tracker(motivo);
    }

    function esperarDoppler(fn, n) {
        n = n || 0;
        if (D() && typeof D().start_tracker === 'function' && D().launchButton) return fn();
        if (n >= 40) { console.warn('[doppler_autostart] El plugin doppler no está disponible.'); return; }
        setTimeout(function () { esperarDoppler(fn, n + 1); }, 500);
    }

    // frecuencias del satélite (la principal y las demás de rig_skin)
    function frecuenciasDe(sat) {
        return [sat].concat(sat.also || []).map(function (x) { return x && x.f; })
            .filter(function (f) { return typeof f === 'number' && f > 0; });
    }

    // el receptor ya está en el satélite y quieto
    function llegado(sat, cb, mio) {
        var hasta = Date.now() + self.ESPERA_MS, ultima = null, quieta = 0;
        var fs = frecuenciasDe(sat);
        (function mirar() {
            if (mio !== pedido) return;          // se eligió otro satélite
            var f = frecuencia();
            var cerca = f !== null && (!fs.length || fs.some(function (x) { return Math.abs(x - f) < self.MARGEN_HZ; }));
            quieta = (ultima !== null && f === ultima) ? quieta + 1 : 0;
            ultima = f;
            if (cerca && quieta >= 3) return cb();
            if (Date.now() > hasta) {
                estado('Sin Doppler: el receptor no llegó a ' + (fs[0] ? (fs[0] / 1e6).toFixed(3) + ' MHz' : 'la frecuencia'));
                return;
            }
            setTimeout(mirar, 300);
        })();
    }

    function datos(id) {
        if (cache[id]) return Promise.resolve(cache[id]);
        return fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=' + encodeURIComponent(id) + '&FORMAT=JSON',
            { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('CelesTrak HTTP ' + r.status);
                return r.json();
            })
            .then(function (d) {
                if (!Array.isArray(d) || !d[0] || !d[0].OBJECT_NAME) throw new Error('sin datos del satélite ' + id);
                cache[id] = d[0];
                return d[0];
            });
    }

    function arrancar(sat) {
        if (!sat || !sat.id) return;
        var id = String(sat.id), mio = ++pedido;
        parar('Cambiando de satélite');
        // 0.3: nombre y número a la vista desde el primer momento; con el
        // número en «Sat ID», TRACK vuelve a arrancar este satélite
        $('#satellite-input').val(id);
        if (D()) { D().lastSatId = id; D().selectedSatelliteName = sat.name || ''; }
        estado((sat.name || 'Satélite') + ': esperando a que llegue el receptor...');
        abrirSilenciador();
        esperarDoppler(function () {
            Promise.all([datos(id), new Promise(function (ok) { llegado(sat, ok, mio); })])
                .then(function (r) {
                    if (mio !== pedido) return;
                    // otra vez al llegar: el cambio de modo o de perfil puede volver a ponerlo
                    abrirSilenciador();
                    parar();
                    D().start_tracker(r[0]);
                    // el nombre de la ventana SAT y, entre paréntesis, el de CelesTrak
                    if (siguiendo() && sat.name && sat.name !== r[0].OBJECT_NAME) {
                        D().selectedSatelliteName = sat.name + ' (' + r[0].OBJECT_NAME + ')';
                        estado(D().selectedSatelliteName);
                    }
                    console.log('[doppler_autostart] Seguimiento Doppler:', sat.name, id);
                })
                .catch(function (e) {
                    if (mio !== pedido) return;
                    estado('Sin Doppler: no hay datos de CelesTrak');
                    console.error('[doppler_autostart]', e);
                });
        });
    }

    // se para en cuanto la sintonía la cambia otro que no sea el Doppler
    esperarDoppler(function () {
        var dop = D();
        if (!dop._ea7_envuelto) {
            dop._ea7_envuelto = true;
            // 0.3: nunca dos seguimientos a la vez. El plugin doppler no para
            // el anterior al arrancar otro (doble clic en TRACK, o TRACK
            // mientras arranca solo): STOP paraba uno y el otro seguía
            // tirando de la frecuencia sin poder quitarlo
            var st = dop.start_tracker;
            dop.start_tracker = function () {
                if (dop.intervalId != null) { clearInterval(dop.intervalId); dop.intervalId = undefined; }
                return st.apply(this, arguments);
            };
            // TRACK / STOP pulsado a mano: anula un arranque automático pendiente
            $(document).on('click.doppler_autostart', '#satellite-track', function () { pedido++; });
            // 0.4: elegir un satélite en la lista de DOP lo sintoniza en el
            // receptor marcado (con la frecuencia de la lista de SAT de
            // rig_skin) y arranca el seguimiento, igual que desde SAT. El
            // plugin doppler por sí solo solo apunta el número y el nombre
            var ss = dop.selectSatellite;
            dop.selectSatellite = function (id, grp) {
                // SUB marcado: lo hace el SUB (su doppler_autostart sintoniza y sigue)
                var sub = subMarcado();
                if (sub) {
                    try { sub.Plugins.doppler.selectSatellite(id, grp); } catch (e) { console.error('[doppler_autostart]', e); }
                    setTimeout(espejoSub, 50);
                    return;
                }
                var w = window;
                var sat = satDeLista(w, id);
                var r = ss.apply(this, arguments);
                if (sat && sat.f) {
                    try {
                        w.Plugins.rig_skin.tuneTo(sat.f, sat.mode);
                        w.$(w.document).trigger('owrxplus:satellite-tuned', [sat]);
                    } catch (e) { console.error('[doppler_autostart]', e); }
                } else {
                    try {
                        var dw = w.Plugins.doppler;
                        w.$('#satellite-name').text((dw.selectedSatelliteName || ('Satélite ' + id)) +
                            ': no está en la lista de SAT; sintoniza a mano y pulsa TRACK');
                    } catch (e) {}
                }
                setTimeout(espejoSub, 50);
                return r;
            };
            var gd = dop.getDoppler;
            dop.getDoppler = function () {
                deDoppler = true;      // el Doppler sintoniza justo después
                return gd.apply(this, arguments);
            };
        }
        if (typeof Demodulator === 'function' && !Demodulator.prototype._ea7_dop) {
            var so = Demodulator.prototype.set_offset_frequency;
            Demodulator.prototype._ea7_dop = true;
            Demodulator.prototype.set_offset_frequency = function (off) {
                var suyo = deDoppler;
                deDoppler = false;
                if (!suyo && siguiendo()) {
                    var antes = this.get_offset_frequency();
                    if (typeof off === 'number' && Math.abs(off - antes) > self.TOLERANCIA_HZ) {
                        pedido++;
                        parar('Doppler parado: has cambiado de frecuencia');
                    }
                }
                return so.apply(this, arguments);
            };
        }
        // botón DOP encendido mientras hay seguimiento. Con el doble receptor
        // la columna de botones solo está en el MAIN: su DOP se enciende
        // también si el Doppler va en el SUB
        function dopplerSub() {
            try {
                var f = document.getElementById('drx-sub');
                var ds = f && f.contentWindow.Plugins.doppler;
                return ds && ds.intervalId != null ? ds : null;
            } catch (e) { return null; }
        }
        setInterval(function () {
            var b = D().launchButton;
            if (!b) return;
            var sub = dopplerSub();
            var on = siguiendo() || !!sub;
            var t = 'Doppler';
            if (siguiendo()) t += (sub ? ' MAIN' : '') + ': siguiendo ' + (D().selectedSatelliteName || 'satélite');
            if (sub) t += (siguiendo() ? ' · ' : '') + ' SUB: siguiendo ' + (sub.selectedSatelliteName || 'satélite');
            if ((b.getAttribute('data-on') === '1') !== on) {
                if (on) b.setAttribute('data-on', '1'); else b.removeAttribute('data-on');
            }
            if (b.title !== t) b.title = t;
            espejoSub();
        }, 500);
    });

    // 0.4: la lista de satélites de rig_skin (la de la ventana SAT), con
    // el número NORAD, la frecuencia y el modo de cada uno
    var lista = null;
    function satDeLista(w, id) {
        if (!lista) {
            try {
                var s = String(w.Plugins.rig_skin.createSatScreen);
                var i = s.indexOf('var SATS = ['), j = s.indexOf('];', i);
                if (i >= 0 && j > i) lista = (new Function('return ' + s.slice(i + 11, j + 1)))();
            } catch (e) { console.warn('[doppler_autostart] Sin la lista de SAT:', e); }
        }
        var n = Number(id);
        return (lista || []).filter(function (x) { return Number(x.id) === n; })[0] || null;
    }

    // 0.3, doble receptor: la ventana del Doppler solo está en el MAIN. Con
    // el SUB marcado enseña el Doppler del SUB («SUB: ...») y TRACK / STOP
    // actúan sobre el SUB; con el MAIN marcado, el del MAIN
    function subMarcado() {
        try {
            var DR = Plugins.doble_receptor;
            var f = document.getElementById('drx-sub');
            return DR && DR.rol === 'main' && DR.activo === 'sub' && f ? f.contentWindow : null;
        } catch (e) { return null; }
    }
    var espejando = false;
    function espejoSub() {
        var w = subMarcado();
        var $n = $('#satellite-name'), $t = $('#satellite-track'), $i = $('#satellite-input');
        if (w && w.Plugins && w.Plugins.doppler && w.$) {
            espejando = true;
            var ds = w.Plugins.doppler, va = ds.intervalId != null;
            var nombre = 'SUB: ' + (w.$('#satellite-name').text() || D().defaultStatus);
            if ($n.text() !== nombre) $n.text(nombre);
            $t.toggleClass('highlighted', va).text(va ? 'STOP' : 'TRACK');
            var id = w.$('#satellite-input').val() || '';
            if (!$i.is(':focus') && $i.val() !== id) $i.val(id);
        } else if (espejando) {
            // vuelta al MAIN: su propio estado
            espejando = false;
            var vm = siguiendo();
            $t.toggleClass('highlighted', vm).text(vm ? 'STOP' : 'TRACK');
            $n.text(D().selectedSatelliteName || D().defaultStatus);
            $i.val(D().lastSatId || '');
        }
    }
    document.addEventListener('click', function (e) {
        var w = subMarcado();
        if (!w || !e.target || !e.target.closest || !e.target.closest('#satellite-track')) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        try {
            var ds = w.Plugins.doppler;
            if (ds.intervalId == null) w.$('#satellite-input').val($('#satellite-input').val());
            w.$('#satellite-track').trigger('click');
        } catch (er) {}
        setTimeout(espejoSub, 50);
    }, true);

    // 0.6: mientras se sigue un satélite, el silenciador siempre abierto
    // (con el Doppler y el desvanecimiento, el squelch cortaría la señal).
    // Al parar el seguimiento, el oyente puede volver a usar SQ
    setInterval(function () { if (siguiendo()) abrirSilenciador(); }, 500);

    // cambio de perfil: el Doppler ya no vale
    $(document).on('event:profile_changed.doppler_autostart', function () {
        pedido++;
        parar('Doppler parado: cambio de perfil');
    });

    $(document).on('owrxplus:satellite-tuned.doppler_autostart', function (e, sat) {
        arrancar(sat);
    });

    // 0.5: la pantalla de pases del panel (tecla SAT del panel de control)
    // sintoniza al pulsar la frecuencia de un satélite, pero no avisa al
    // Doppler (el enganche de la 0.1 solo está en la ventana SAT de arriba).
    // Se avisa desde aquí, después de que rig_skin haya sintonizado
    document.addEventListener('click', function (e) {
        var f = e.target && e.target.closest && e.target.closest('#owrx-rig-sats .sfreq');
        if (!f) return;
        var fila = f.closest('.owrx-rig-sat-row');
        var nombre = fila ? $(fila).find('.sname').first().text().trim() : '';
        var sat = null;
        satDeLista(window, 0);    // carga la lista si aún no está
        (lista || []).some(function (x) { if (x.name === nombre) { sat = x; return true; } return false; });
        if (!sat) return;
        setTimeout(function () { $(document).trigger('owrxplus:satellite-tuned', [sat]); }, 0);
    }, true);
    console.log('[doppler_autostart] 0.6 cargado.');
    return true;
};
