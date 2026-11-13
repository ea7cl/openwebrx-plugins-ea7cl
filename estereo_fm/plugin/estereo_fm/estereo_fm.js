/*
 * estereo_fm (EA7CL) · FM comercial y DAB en ESTÉREO REAL para OpenWebRX+.
 *
 * El servidor (paquete owrx_estereo) sigue mandando el MONO de siempre por el canal de audio
 * normal (mensaje 4) y, además, el estéreo en un mensaje aparte (tipo 5):
 *     [0x05][marcas][n: 32 bits][n/2 bytes ADPCM del canal L][n/2 bytes ADPCM del canal R]
 * (un ADPCM para cada canal: sin la "fritura" que daba intercalar L,R en uno solo).
 * Este complemento:
 *   · reproduce ese estéreo con un procesador de audio de dos canales (y deja de usar el mono
 *     mientras llega estéreo); si algo falla, se sigue oyendo el mono de siempre;
 *   · botón ESTÉREO / MONO (pulsando se escucha en mono) y medidores de los canales L y R;
 *   · al grabar, guarda la mezcla en mono (como antes).
 * Se instala y se quita con owrx-estereo.sh.
 */
Plugins.estereo_fm = Plugins.estereo_fm || {};
Plugins.estereo_fm._version = 1.2;

(function () {
    const E = Plugins.estereo_fm;
    E.avisado = null;         // canales que dice el servidor para el modo actual (1 o 2)
    Object.defineProperty(E, 'canales', { get: function () { return E.avisado || 1; } });
    E.diferencia = 0;         // cuánto se diferencian L y R (para el indicador)
    E.forzarMono = false;     // el oyente ha pulsado el letrero para escuchar en mono
    try { E.forzarMono = localStorage.getItem('ea7cl_estereo_mono') === '1'; } catch (e) { /* nada */ }
    E.ultimo = 0;             // cuándo llegó el último paquete estéreo

    // ---------------------------------------------------------------- mensajes del servidor
    function envolverSocket() {
        if (typeof ws === 'undefined' || !ws || ws._ea7cl_estereo) return;
        const original = ws.onmessage;
        if (!original) return;
        ws.onmessage = function (evt) {
            const d = evt.data;
            if (typeof d === 'string') {
                if (d.indexOf('ea7cl_estereo') >= 0) {
                    try {
                        const j = JSON.parse(d);
                        if (j.type === 'ea7cl_estereo') {
                            const c = j.canales === 2 ? 2 : 1;
                            if (c !== E.avisado) { E.avisado = c; pintar(); }
                            return;
                        }
                    } catch (e) { /* no era nuestro */ }
                }
            } else if (d instanceof ArrayBuffer && d.byteLength > 6 && new Uint8Array(d, 0, 1)[0] === 5) {
                try { recibirEstereo(d); } catch (e) { console.warn('[estereo_fm]', e); }
                return;
            }
            return original.apply(this, arguments);
        };
        ws._ea7cl_estereo = true;
    }

    // ---------------------------------------------------------------- audio
    function estereoActivo(eng) {
        return E.canales === 2 && (eng._ea7cl_estereo === true || eng._ea7cl_estereo === 'sp')
            && Date.now() - E.ultimo < 600;
    }

    // mientras llega estéreo, el mono de siempre (mensaje 4) no se reproduce (sería doble)
    const pushHdOriginal = AudioEngine.prototype.pushHdAudio;
    AudioEngine.prototype.pushHdAudio = function (data) {
        if (estereoActivo(this)) { this.audioBytes.add(data.byteLength); this.lastHd = true; return; }
        return pushHdOriginal.call(this, data);
    };

    function recibirEstereo(buf) {
        const eng = (typeof audioEngine !== 'undefined') ? audioEngine : null;
        if (!eng || !eng.audioNode) return;
        const marcas = new Uint8Array(buf, 1, 1)[0];
        const n = new DataView(buf).getUint32(2, true);
        const pcm = (marcas & 2) !== 0;                     // sin comprimir (OpenWebRX sin ADPCM)
        const bytes = pcm ? 2 * n : n >> 1;
        if (buf.byteLength < 6 + 2 * bytes) return;
        if ((marcas & 1) || !eng._ea7cl_dl) {              // flujo nuevo: descompresores desde cero
            eng._ea7cl_dl = new ImaAdpcmCodec(); eng._ea7cl_dr = new ImaAdpcmCodec();
            eng._ea7cl_l = null; eng._ea7cl_r = null;
        }
        eng.audioBytes.add(buf.byteLength);
        const li = pcm ? new Int16Array(buf.slice(6, 6 + bytes)) : eng._ea7cl_dl.decode(new Uint8Array(buf, 6, bytes));
        const ri = pcm ? new Int16Array(buf.slice(6 + bytes, 6 + 2 * bytes)) : eng._ea7cl_dr.decode(new Uint8Array(buf, 6 + bytes, bytes));
        const k = Math.min(li.length, ri.length);
        const mezcla = new Int16Array(k);
        let dif = 0, tot = 0, picoL = 0, picoR = 0;
        for (let i = 0; i < k; i++) {
            const l = li[i], r = ri[i];
            mezcla[i] = (l + r) >> 1;
            const al = Math.abs(l), ar = Math.abs(r);
            dif += Math.abs(l - r); tot += al + ar;
            if (al > picoL) picoL = al;
            if (ar > picoR) picoR = ar;
        }
        // medidores L / R: suben enseguida y bajan despacio, como un VU
        E.picoL = Math.max(picoL / 32768, (E.picoL || 0) * 0.85);
        E.picoR = Math.max(picoR / 32768, (E.picoR || 0) * 0.85);
        E.diferencia = 0.8 * E.diferencia + 0.2 * (tot > 0 ? dif / tot : 0);
        E.ultimo = Date.now();
        if (eng._ea7cl_estereo !== true && eng._ea7cl_estereo !== 'sp') return;   // aún suena el mono
        eng.lastHd = true;
        if (eng.recording) eng.hdRecorder.record(mezcla);
        if (!eng._ea7cl_l) {
            eng._ea7cl_l = new Interpolator(eng.hdResamplingFactor);
            eng._ea7cl_r = new Interpolator(eng.hdResamplingFactor);
        }
        // MONO elegido con el botón: los dos canales con la mezcla (los medidores marcan iguales)
        const fl = eng._ea7cl_l.process(E.forzarMono ? mezcla : li.subarray(0, k));
        const fr = E.forzarMono ? fl : eng._ea7cl_r.process(ri.subarray(0, k));
        if (E.forzarMono) { E.picoL = E.picoR = Math.max(E.picoL || 0, E.picoR || 0); }
        if (eng._ea7cl_estereo === true) {
            eng.audioNode.port.postMessage({ l: fl, r: fr });
        } else if (eng._ea7cl_colaN + fl.length <= eng.maxBufferSize) {   // procesador antiguo (http)
            eng._ea7cl_colaL.push(fl); eng._ea7cl_colaR.push(fr); eng._ea7cl_colaN += fl.length;
        }
    }

    // ---- procesador antiguo (ScriptProcessorNode) de dos canales: lo usan los navegadores cuando la
    // página va por http (AudioWorklet solo funciona con https o localhost)
    function nodoAntiguo(eng) {
        const sr = eng.audioContext.sampleRate;
        const bs = sr < 88200 ? 4096 : sr < 176400 ? 8192 : 16384;
        const sp = eng.audioContext.createScriptProcessor(bs, 0, 2);
        eng._ea7cl_colaL = []; eng._ea7cl_colaR = []; eng._ea7cl_colaN = 0;
        eng._ea7cl_llenando = true;
        const reserva = Math.round(0.3 * sr);
        sp.onaudioprocess = function (e) {
            const oL = e.outputBuffer.getChannelData(0), oR = e.outputBuffer.getChannelData(1);
            let t = 0;
            // reserva: tras quedarse sin audio, espera a tener ~0,3 s antes de seguir (el DAB llega
            // a golpes; así no hay un microcorte en cada golpe)
            if (eng._ea7cl_llenando && eng._ea7cl_colaN >= reserva) eng._ea7cl_llenando = false;
            if (eng._ea7cl_colaL.length && !eng._ea7cl_llenando) {   // estéreo
                while (t < bs && eng._ea7cl_colaL.length) {
                    const l = eng._ea7cl_colaL[0], r = eng._ea7cl_colaR[0];
                    const k = Math.min(bs - t, l.length);
                    oL.set(l.subarray(0, k), t); oR.set(r.subarray(0, k), t);
                    if (k < l.length) { eng._ea7cl_colaL[0] = l.subarray(k); eng._ea7cl_colaR[0] = r.subarray(k); }
                    else { eng._ea7cl_colaL.shift(); eng._ea7cl_colaR.shift(); }
                    t += k; eng._ea7cl_colaN -= k;
                }
                if (t < bs) eng._ea7cl_llenando = true;          // se ha vaciado: volver a reservar
            } else if (eng._ea7cl_colaL.length) {
                // reservando: silencio un momento
            } else {                                            // mono (los demás modos): a los dos canales
                while (t < bs && eng.audioBuffers.length) {
                    const b = eng.audioBuffers[0];
                    const k = Math.min(bs - t, b.length);
                    oL.set(b.subarray(0, k), t); oR.set(b.subarray(0, k), t);
                    if (k < b.length) eng.audioBuffers[0] = b.subarray(k); else eng.audioBuffers.shift();
                    t += k;
                }
            }
            if (t < bs) { oL.fill(0, t); oR.fill(0, t); }
            eng.audioSamples.add(t);
        };
        return sp;
    }

    // procesador de dos canales (sustituye al de uno; el mono va a los dos canales igual)
    function crearNodo(eng) {
        return eng.audioContext.audioWorklet.addModule('static/plugins/receiver/estereo_fm/procesador.js?v=1.2').then(function () {
            const nodo = new AudioWorkletNode(eng.audioContext, 'ea7cl-estereo-processor', {
                numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
                processorOptions: { maxBufferSize: eng.maxBufferSize }
            });
            nodo.port.addEventListener('message', function (m) {
                const json = JSON.parse(m.data);
                if (typeof json.buffersize !== 'undefined') eng.audioReporter({ buffersize: json.buffersize });
                if (typeof json.samplesProcessed !== 'undefined') eng.audioSamples.add(json.samplesProcessed);
            });
            nodo.port.start();
            return nodo;
        });
    }

    function cambiarNodo(eng) {
        if (eng._ea7cl_estereo || !eng.audioContext || !eng.gainNode || !eng.audioNode) return;
        if (!eng.audioContext.audioWorklet || !eng.audioNode.port) {
            // sin AudioWorklet (página por http): procesador antiguo de dos canales
            const viejo = eng.audioNode, sp = nodoAntiguo(eng);
            sp.connect(eng.gainNode);
            eng.audioNode = sp;
            try { viejo.onaudioprocess = null; viejo.disconnect(); } catch (e) { /* nada */ }
            eng._ea7cl_estereo = 'sp';
            console.log('[estereo_fm] audio de dos canales listo (procesador antiguo)');
            return;
        }
        eng._ea7cl_estereo = 'montando';
        crearNodo(eng).then(function (nodo) {
            const viejo = eng.audioNode;
            nodo.connect(eng.gainNode);
            eng.audioNode = nodo;
            if (viejo) { try { viejo.disconnect(); } catch (e) { /* nada */ } }
            eng._ea7cl_estereo = true;
            console.log('[estereo_fm] audio de dos canales listo');
        }).catch(function (e) {
            eng._ea7cl_estereo = false;
            console.warn('[estereo_fm] no se pudo montar el audio estéreo:', e);
        });
    }

    // ---------------------------------------------------------------- indicador ESTÉREO / MONO + medidores L / R
    // Va en la sección MODOS, en la misma fila y a la derecha del selector de modo (ahí hay hueco y
    // no tapa nada). Si esa zona no existe (otra carátula), arriba a la derecha del panel.
    let caja = null, marca = null, barras = {};
    function crearCaja() {
        caja = document.createElement('div');
        caja.className = 'ea7cl-estereo-caja';
        marca = document.createElement('button');
        marca.type = 'button';
        marca.className = 'ea7cl-estereo';
        marca.addEventListener('click', function () {
            E.forzarMono = !E.forzarMono;
            try { localStorage.setItem('ea7cl_estereo_mono', E.forzarMono ? '1' : '0'); } catch (e) { /* nada */ }
            pintar();
        });
        caja.appendChild(marca);
        const vus = document.createElement('div'); vus.className = 'ea7cl-vus';
        ['L', 'R'].forEach(function (c) {
            const fila = document.createElement('div'); fila.className = 'ea7cl-vu';
            const et = document.createElement('b'); et.textContent = c;
            const pista = document.createElement('span'); pista.className = 'ea7cl-vu-pista';
            const barra = document.createElement('i'); pista.appendChild(barra);
            const db = document.createElement('small');
            fila.append(et, pista, db); vus.appendChild(fila);
            barras[c] = { barra: barra, db: db };
        });
        caja.appendChild(vus);
    }
    function montarCaja() {
        if (!caja) crearCaja();
        // Siempre junto al selector de MODOS. Si aún no existe (la carátula se monta después),
        // se espera y se vuelve a intentar en el siguiente repaso; nunca flotando encima de nada.
        // con la carátula: desplegable de modos (va a su derecha); sin ella: rejilla de botones
        // de modos (va en una línea debajo)
        let sel = document.querySelector('#openwebrx-panel-receiver .openwebrx-modes .openwebrx-modes-select');
        caja.classList.toggle('en-rejilla', !sel);
        if (!sel) sel = document.querySelector('#openwebrx-panel-receiver .openwebrx-modes .openwebrx-modes-grid');
        if (!sel || !sel.parentNode) {
            if (caja.isConnected) caja.remove();
            return false;
        }
        if (caja.previousSibling !== sel || caja.parentNode !== sel.parentNode) {
            caja.classList.remove('flotante');
            sel.parentNode.insertBefore(caja, sel.nextSibling);
        }
        return true;
    }
    function pintarVu() {
        if (!caja || caja.style.display === 'none') return;
        [['L', E.picoL || 0], ['R', E.picoR || 0]].forEach(function (p) {
            const dB = p[1] > 0 ? 20 * Math.log10(p[1]) : -99;
            const pct = Math.max(0, Math.min(100, (dB + 40) / 40 * 100));     // de −40 a 0 dB
            barras[p[0]].barra.style.width = pct.toFixed(1) + '%';
            barras[p[0]].barra.classList.toggle('alto', dB > -3);
            barras[p[0]].db.textContent = dB > -60 ? Math.round(dB) + ' dB' : '—';
        });
        E.picoL = (E.picoL || 0) * 0.93; E.picoR = (E.picoR || 0) * 0.93;
    }
    function pintar() {
        const modo = (typeof UI !== 'undefined' && UI.getModulation) ? UI.getModulation() : '';
        const aplica = E.canales === 2 && (modo === 'wfm' || modo === 'dab');
        if (!montarCaja()) return;
        if (!aplica) { caja.style.display = 'none'; return; }
        caja.style.display = '';
        const vivo = Date.now() - E.ultimo < 1500;
        const est = vivo && E.diferencia > 0.02;
        marca.classList.toggle('on', est && !E.forzarMono);
        marca.classList.toggle('forzado', !!E.forzarMono);
        if (E.forzarMono) {
            marca.textContent = 'MONO';
            marca.title = 'Escuchando en mono porque lo has elegido. Pulsa para volver a estéreo.';
        } else {
            marca.textContent = est ? 'ESTÉREO' : 'MONO';
            marca.title = (est ? 'Se recibe en estéreo (izquierda y derecha distintas).'
                : 'La emisora llega en mono (sin piloto estéreo o señal floja).') + ' Pulsa para escuchar en mono.';
        }
    }

    E.init = function () {
        setInterval(function () {
            envolverSocket();
            if (typeof audioEngine !== 'undefined' && audioEngine && audioEngine.started) cambiarNodo(audioEngine);
            pintar();
        }, 400);
        setInterval(pintarVu, 80);
        return true;
    };
})();
