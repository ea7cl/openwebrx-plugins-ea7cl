/*
 * audio_dsp - Audio DSP Plugin for OpenWebRx+
 * Real-time audio spectrum analyzer + parametric EQ + filters
 * Version 2.4 + EA7CL (NR con red neuronal RNNoise, botón IA)
 */

/* IMPORTANT: do NOT define 'no_css' here — the OWRX+ plugin loader
   skips CSS loading if the property EXISTS (regardless of its value) */
Plugins.audio_dsp._version = 2.4;

Plugins.audio_dsp.init = function () {

  if (!Plugins.isLoaded('utils', 0.1)) {
    console.error('[audio_dsp] Requires "utils >= 0.1".');
    return false;
  }

  var dsp = Plugins.audio_dsp;

  dsp.ctx        = null;
  dsp.analyser   = null;
  dsp.filters    = {};
  dsp.enabled    = false;
  dsp.spectrumOn = false;
  dsp.animFrame  = null;
  dsp.hooked     = false;

  dsp.defaults = {
    hp_freq: 200, hp_on: false,
    lp_freq: 3400, lp_on: false,
    notch_freq: 1000, notch_q: 10, notch_on: false, notch_auto: false,
    peak_freq: 1500, peak_gain: 0, peak_q: 1.5, peak_on: false,
    comp_on: false, comp_threshold: -30, comp_ratio: 6,
    nr_on: false, nr_strength: 50, nr_ai: false,
    auto_preset: false,
    eq_on: false, eq_g: [0,0,0,0,0,0,0,0,0,0],
    nb_on: false, nb_th: 6,
    bin_on: false, bin_w: 50,
    lms_on: false, lms_mode: 0, lms_mu: 30,
    peak_hold: false, waterfall: false
  };
  dsp.eqFreqs = [100, 200, 400, 600, 900, 1300, 1800, 2400, 3200, 4500];
  dsp.settings = Object.assign({}, dsp.defaults);
  dsp._load();   // restore saved settings (localStorage)
  // ===== EA7CL: mejoras (guardar todo + presets automaticos por modo) =====
  // Oyente nuevo (sin ajustes guardados): AUTO PRESET activado de entrada
  dsp._ea7nuevo = !localStorage.getItem('adsp_v2');
  if (dsp._ea7nuevo) dsp.settings.auto_preset = true;
  // Guardar todos los ajustes cada segundo si cambian (el original no guardaba
  // DSP ENGINE, presets, compresor, notch, peak, NR/NB/LMS on-off...)
  setInterval(function () { try { var j = JSON.stringify({ s: dsp.settings, e: dsp.enabled }); if (j !== dsp._ea7ult) { dsp._ea7ult = j; localStorage.setItem('adsp_v2', j); } } catch (e) {} }, 1000);
  // Presets propios por modo (null = sin DSP, sonido tal cual)
  dsp._ea7presets = {
    wfm: null,
    dig: null,
    nfm: { hp_on: true, hp_freq: 300, lp_on: true, lp_freq: 3000, nr_on: true, nr_strength: 30 },
    ssb: { hp_on: true, hp_freq: 250, lp_on: true, lp_freq: 2800, nr_on: true, nr_strength: 40,
           peak_on: true, peak_freq: 1800, peak_gain: 3, peak_q: 1.5,
           comp_on: true, comp_threshold: -30, comp_ratio: 4 },
    am:  { hp_on: true, hp_freq: 100, lp_on: true, lp_freq: 4500, nr_on: true, nr_strength: 30,
           eq_on: true, eq_g: [1, 2, 1, 0, 0, 0, 1, 1, 0, 0] },
    cw:  { hp_on: true, hp_freq: 600, lp_on: true, lp_freq: 1000, nr_on: true, nr_strength: 30,
           peak_on: true, peak_freq: 800, peak_gain: 6, peak_q: 5 }
  };
  dsp._ea7aplicar = function (nombre) {
    var d = this, p = d._ea7presets[nombre], auto = d.settings.auto_preset;
    var ai = !!d.settings.nr_ai;   // la elección IA del oyente se conserva entre modos
    var base = d.defaults;
    d.defaults = Object.assign({}, base, p || {}, { auto_preset: auto, nr_ai: ai });
    try { d._applyPreset('reset'); } finally { d.defaults = base; }
    d.settings.auto_preset = auto;
    d.settings.nr_ai = ai;
    d._syncAI();
    $('#adsp-auto-preset').prop('checked', auto);
    var on = !!p;
    d.enabled = on;
    $('#adsp-master').prop('checked', on);
    $('#adsp-status').text(on ? 'active' : 'bypass');
    $('#audio-dsp-icon').toggleClass('adsp-active', on);
    d._reconnect();
  };
  // Los botones SSB Voice / AM / CW usan tambien los presets nuevos
  $(document).on('click', '#adsp-pre-ssb, #adsp-pre-am, #adsp-pre-cw', function (e) {
    e.stopImmediatePropagation();
    dsp._ea7aplicar(this.id.replace('adsp-pre-', ''));
  });
  // Vigilar el modo: WFM ya no se trata como AM; los digitales no se tocan.
  // v2: los cambios de modo que hace la web sola al entrar o al reconectar
  // (perfil de arranque, perfil_recordado) NO cambian los ajustes del oyente.
  dsp._startModeWatch = function () {
    var d = this;
    if (d._modeTimer) return;
    d._lastMode = null;
    d._ea7quieto = Date.now();
    var mapa = { wfm: 'wfm', nfm: 'nfm', usb: 'ssb', lsb: 'ssb', am: 'am', sam: 'am', cw: 'cw' };
    d._modeTimer = setInterval(function () {
      var pr = Plugins.perfil_recordado;
      if (!d.hooked || (pr && (pr._pendiente || pr._restaurando)) ||
          (typeof ws !== 'undefined' && ws && ws.readyState !== 1)) d._ea7quieto = Date.now();
      if (!d.settings.auto_preset || !d.hooked) return;
      var modo = null, sec = '';
      try {
        var dm = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator();
        if (dm) { modo = dm.get_modulation(); try { sec = dm.get_secondary_demod() || ''; } catch (e2) {} }
      } catch (e) { return; }
      if (!modo) return;
      var silencio = (Date.now() - d._ea7quieto) < 5000;
      var clave = modo + '/' + sec, aplicar = false;
      if (clave !== d._lastMode) {
        var primera = (d._lastMode === null);
        d._lastMode = clave;
        if (!primera && !silencio) aplicar = true;
      }
      if (d._ea7nuevo && !silencio) aplicar = true;   // oyente nuevo: preset del modo en que acaba entrando
      if (!aplicar) return;
      d._ea7nuevo = false;
      d._ea7aplicar(sec ? 'dig' : (mapa[modo] || 'dig'));
    }, 1000);
  };
  // ===== fin EA7CL =====

  // ===== EA7CL: NR con red neuronal (RNNoise) — botón IA junto a LEARN =====
  $(document).on('click', '#adsp-nr-ai', function (e) {
    e.stopPropagation(); e.preventDefault();
    if ($(this).hasClass('adsp-ai-off')) return;          // RNNoise no disponible
    dsp.settings.nr_ai = !dsp.settings.nr_ai;
    if (dsp.settings.nr_ai) dsp.settings.nr_on = true;   // IA implica NR encendido
    dsp._syncAI();
    dsp._sendNRParams();
    dsp._reconnect();
  });
  // ===== fin EA7CL =====

  $(document).on('event:owrx_initialized', function () {
    console.log('[audio_dsp] OWRX initialized, building UI...');
    dsp._buildUI();
    dsp._curX = -1;
    dsp._syncUI();          // apply restored settings to controls
    dsp._waitForAudio();
    dsp._startMeterLoop();  // VU + clip + stage LEDs (independent of spectrum)
    dsp._startWatchdog();   // survive SDR profile changes
    dsp._startModeWatch();  // auto-preset on demodulator change
  });

  console.log('[audio_dsp] Plugin loaded, waiting for OWRX init.');
  return true;
};

// ─── Persistence (localStorage) ───
Plugins.audio_dsp._save = function () {
  var dsp = this;
  clearTimeout(dsp._saveT);
  dsp._saveT = setTimeout(function () {
    try {
      localStorage.setItem('adsp_v2', JSON.stringify({
        s: dsp.settings, e: dsp.enabled
      }));
    } catch (e) {}
  }, 300);
};

Plugins.audio_dsp._load = function () {
  var dsp = this;
  try {
    var raw = localStorage.getItem('adsp_v2');
    if (!raw) return;
    var d = JSON.parse(raw);
    if (d && d.s) Object.assign(dsp.settings, d.s);
    if (d && typeof d.e === 'boolean') dsp.enabled = d.e;
    console.log('[audio_dsp] Settings restored from localStorage.');
  } catch (e) {}
};

// ─── Sync all UI controls from dsp.settings ───
Plugins.audio_dsp._syncUI = function () {
  var dsp = this, s = dsp.settings;
  $('#adsp-master').prop('checked', dsp.enabled);
  $('#adsp-status').text(dsp.enabled ? 'active' : 'bypass');
  $('#audio-dsp-icon').toggleClass('adsp-active', dsp.enabled);
  $('#adsp-nr-on').prop('checked', s.nr_on);
  $('#adsp-nr-strength').val(s.nr_strength);
  $('#adsp-nr-val').text(s.nr_strength + '%');
  dsp._syncAI();   // EA7CL: botón IA
  $('#adsp-hp-on').prop('checked', s.hp_on);
  $('#adsp-hp-freq').val(s.hp_freq);
  $('#adsp-hp-val').text(s.hp_freq + ' Hz');
  $('#adsp-lp-on').prop('checked', s.lp_on);
  $('#adsp-lp-freq').val(s.lp_freq);
  $('#adsp-lp-val').text(s.lp_freq + ' Hz');
  $('#adsp-notch-on').prop('checked', s.notch_on);
  $('#adsp-notch-freq').val(s.notch_freq);
  $('#adsp-notch-q').val(s.notch_q);
  $('#adsp-notch-val').text(s.notch_freq + ' Hz Q:' + s.notch_q);
  $('#adsp-notch-auto').prop('checked', s.notch_auto);
  $('#adsp-peak-on').prop('checked', s.peak_on);
  $('#adsp-peak-freq').val(s.peak_freq);
  $('#adsp-peak-gain').val(s.peak_gain);
  $('#adsp-peak-q').val(s.peak_q);
  $('#adsp-peak-val').text(s.peak_freq + ' Hz ' + (s.peak_gain >= 0 ? '+' : '') + s.peak_gain + 'dB');
  $('#adsp-comp-on').prop('checked', s.comp_on);
  $('#adsp-comp-threshold').val(s.comp_threshold);
  $('#adsp-comp-ratio').val(s.comp_ratio);
  $('#adsp-comp-val').text(s.comp_threshold + 'dB ' + s.comp_ratio + ':1');
  $('#adsp-auto-preset').prop('checked', s.auto_preset);
  $('#adsp-eq-on').prop('checked', s.eq_on);
  for (var i = 0; i < 10; i++) $('#adsp-eq-' + i).val(s.eq_g[i] || 0);
  $('#adsp-nb-on').prop('checked', s.nb_on);
  $('#adsp-nb-th').val(s.nb_th);
  $('#adsp-nb-val').text('x' + s.nb_th);
  $('#adsp-bin-on').prop('checked', s.bin_on);
  $('#adsp-bin-w').val(s.bin_w);
  $('#adsp-bin-val').text(s.bin_w + '%');
  $('#adsp-lms-on').prop('checked', s.lms_on);
  $('#adsp-lms-mu').val(s.lms_mu);
  $('#adsp-lms-mode-notch').toggleClass('adsp-seg-active', s.lms_mode === 0);
  $('#adsp-lms-mode-peak').toggleClass('adsp-seg-active', s.lms_mode === 1);
  $('#audio-dsp-btn-peak').toggleClass('adsp-btn-active', s.peak_hold);
  $('#audio-dsp-btn-wf').toggleClass('adsp-btn-active', s.waterfall);
  $('#audio-dsp-canvas').toggleClass('adsp-tall', s.waterfall);
  dsp._updateStageLEDs();
  if (s.notch_auto) dsp._startAutoNotch();
};

// ─── Push settings into the actual audio nodes ───
Plugins.audio_dsp._syncNodes = function () {
  var dsp = this, s = dsp.settings, f = dsp.filters;
  if (f.hp)    f.hp.frequency.value = s.hp_freq;
  if (f.lp)    f.lp.frequency.value = s.lp_freq;
  if (f.notch) { f.notch.frequency.value = s.notch_freq; f.notch.Q.value = s.notch_q; }
  if (f.peak)  { f.peak.frequency.value = s.peak_freq; f.peak.gain.value = s.peak_gain; f.peak.Q.value = s.peak_q; }
  if (f.comp)  { f.comp.threshold.value = s.comp_threshold; f.comp.ratio.value = s.comp_ratio; }
  if (dsp.eqBands) for (var i = 0; i < 10; i++) dsp.eqBands[i].gain.value = s.eq_g[i] || 0;
  if (dsp.binDelay) dsp.binDelay.delayTime.value = 0.0002 + (s.bin_w / 100) * 0.0013;
  dsp._sendNRParams();
  dsp._sendLMSParams();
};

// ─── 4. Watchdog: rebuild if OWRX recreates the AudioContext (profile change) ───
Plugins.audio_dsp._startWatchdog = function () {
  var dsp = this;
  if (dsp._wdTimer) return;
  dsp._wdTimer = setInterval(function () {
    if (!window.audioEngine || !audioEngine.audioContext) return;
    if (dsp.hooked && audioEngine.audioContext !== dsp.ctx) {
      console.warn('[audio_dsp] AudioContext changed (profile switch?) — rebuilding graph.');
      dsp.hooked = false;
      if (dsp._iconAnimFrame) { cancelAnimationFrame(dsp._iconAnimFrame); dsp._iconAnimFrame = null; }
      dsp._waitForAudio();
    } else if (dsp.hooked && dsp._lastGain && audioEngine.gainNode !== dsp._lastGain) {
      console.warn('[audio_dsp] gainNode changed — reconnecting.');
      dsp._lastGain = audioEngine.gainNode;
      dsp._reconnect();
    }
  }, 2000);
};

// ─── 3. Auto-preset on demodulator mode change ───
Plugins.audio_dsp._startModeWatch = function () {
  var dsp = this;
  if (dsp._modeTimer) return;
  dsp._lastMode = null;
  var map = { usb: 'ssb', lsb: 'ssb', cw: 'cw', am: 'am', sam: 'am', nfm: 'am', wfm: 'am' };
  dsp._modeTimer = setInterval(function () {
    if (!dsp.settings.auto_preset) return;
    var mode = null;
    try {
      var demod = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator();
      if (demod) mode = demod.get_modulation();
    } catch (e) { return; }
    if (!mode || mode === dsp._lastMode) return;
    var first = (dsp._lastMode === null);
    dsp._lastMode = mode;
    if (first) return;                       // don't fire on page load
    var preset = map[mode];
    if (preset) {
      console.log('[audio_dsp] Mode ' + mode + ' → preset ' + preset);
      dsp._applyPreset(preset);
    }
  }, 1000);
};

// ─── Wait for audioEngine ───
Plugins.audio_dsp._waitForAudio = function () {
  var dsp = this;
  var attempts = 0;
  var poll = setInterval(function () {
    attempts++;
    if (attempts > 200) { clearInterval(poll); console.warn('[audio_dsp] Timeout.'); return; }
    if (!window.audioEngine || !audioEngine.gainNode || !audioEngine.audioContext) return;
    clearInterval(poll);
    dsp.ctx = audioEngine.audioContext;
    dsp._buildGraph();
    dsp.hooked = true;
    dsp._lastGain = audioEngine.gainNode;
    // Apply restored/pre-selected settings to nodes and chain
    dsp._syncNodes();
    dsp._reconnect();
    // Sync icon state
    $('#audio-dsp-icon').toggleClass('adsp-active', dsp.enabled);
    // Start mini analyser animation on the icon
    dsp._startIconAnim();
    console.log('[audio_dsp] Audio graph hooked! SR=' + dsp.ctx.sampleRate);
  }, 250);
};

// ─── Build Web Audio DSP graph ───
Plugins.audio_dsp._buildGraph = function () {
  var dsp = this;
  var ctx = dsp.ctx;

  dsp.filters.hp = ctx.createBiquadFilter();
  dsp.filters.hp.type = 'highpass';
  dsp.filters.hp.frequency.value = dsp.settings.hp_freq;

  dsp.filters.lp = ctx.createBiquadFilter();
  dsp.filters.lp.type = 'lowpass';
  dsp.filters.lp.frequency.value = dsp.settings.lp_freq;

  dsp.filters.notch = ctx.createBiquadFilter();
  dsp.filters.notch.type = 'notch';
  dsp.filters.notch.frequency.value = dsp.settings.notch_freq;
  dsp.filters.notch.Q.value = dsp.settings.notch_q;

  dsp.filters.peak = ctx.createBiquadFilter();
  dsp.filters.peak.type = 'peaking';
  dsp.filters.peak.frequency.value = dsp.settings.peak_freq;
  dsp.filters.peak.gain.value = dsp.settings.peak_gain;
  dsp.filters.peak.Q.value = dsp.settings.peak_q;

  // Tab switching
  $(document).on('click', '.adsp-tab', function () {
    var page = $(this).data('page');
    $('.adsp-tab').removeClass('adsp-tab-active');
    $(this).addClass('adsp-tab-active');
    $('#adsp-page1').toggle(page === 1);
    $('#adsp-page2').toggle(page === 2);
  });

  // LMS Adaptive Filter
  $(document).on('change', '#adsp-lms-on', function () {
    dsp.settings.lms_on = this.checked;
    if (this.checked && dsp.filters.lms) dsp.filters.lms.port.postMessage({ reset: true });
    dsp._sendLMSParams();
    dsp._reconnect();
  });
  $(document).on('input', '#adsp-lms-mu', function () {
    dsp.settings.lms_mu = parseInt(this.value);
    dsp._sendLMSParams();
    dsp._save();
  });
  $(document).on('click', '#adsp-lms-mode-notch', function (e) {
    e.stopPropagation(); e.preventDefault();
    dsp.settings.lms_mode = 0;
    $('#adsp-lms-mode-notch').addClass('adsp-seg-active');
    $('#adsp-lms-mode-peak').removeClass('adsp-seg-active');
    dsp._sendLMSParams(); dsp._save();
  });
  $(document).on('click', '#adsp-lms-mode-peak', function (e) {
    e.stopPropagation(); e.preventDefault();
    dsp.settings.lms_mode = 1;
    $('#adsp-lms-mode-peak').addClass('adsp-seg-active');
    $('#adsp-lms-mode-notch').removeClass('adsp-seg-active');
    dsp._sendLMSParams(); dsp._save();
  });

  // Graphic EQ
  $(document).on('change', '#adsp-eq-on', function () { dsp.settings.eq_on = this.checked; dsp._reconnect(); });
  $(document).on('input', '.adsp-eq-slider', function () {
    var i = parseInt($(this).data('band'));
    var v = parseInt(this.value);
    dsp.settings.eq_g[i] = v;
    if (dsp.eqBands && dsp.eqBands[i]) dsp.eqBands[i].gain.value = v;
    dsp._save();
  });
  $(document).on('click', '#adsp-eq-flat', function (e) {
    e.stopPropagation(); e.preventDefault();
    for (var i = 0; i < 10; i++) {
      dsp.settings.eq_g[i] = 0;
      if (dsp.eqBands && dsp.eqBands[i]) dsp.eqBands[i].gain.value = 0;
      $('#adsp-eq-' + i).val(0);
    }
    dsp._save();
  });

  // Noise Blanker
  $(document).on('change', '#adsp-nb-on', function () {
    dsp.settings.nb_on = this.checked;
    dsp._sendNRParams();
    dsp._reconnect();
  });
  $(document).on('input', '#adsp-nb-th', function () {
    var v = parseFloat(this.value);
    dsp.settings.nb_th = v;
    $('#adsp-nb-val').text('x' + v);
    dsp._sendNRParams();
    dsp._save();
  });

  // Binaural
  $(document).on('change', '#adsp-bin-on', function () { dsp.settings.bin_on = this.checked; dsp._reconnect(); });
  $(document).on('input', '#adsp-bin-w', function () {
    var v = parseInt(this.value);
    dsp.settings.bin_w = v;
    if (dsp.binDelay) dsp.binDelay.delayTime.value = 0.0002 + (v / 100) * 0.0013;
    $('#adsp-bin-val').text(v + '%');
    dsp._save();
  });

  // 2. Click on spectrum → move the notch there (Shift+click → Peak EQ)
  $(document).on('click', '#audio-dsp-canvas', function (e) {
    if (!dsp.hooked || !dsp.ctx) return;
    var rect = this.getBoundingClientRect();
    var frac = (e.clientX - rect.left) / rect.width;
    var freq = Math.round(frac * dsp.VISTA_HZ);
    freq = Math.max(100, Math.min(5000, freq));
    if (e.shiftKey) {
      dsp.settings.peak_freq = freq;
      dsp.settings.peak_on = true;
      if (dsp.filters.peak) dsp.filters.peak.frequency.value = freq;
      $('#adsp-peak-on').prop('checked', true);
      $('#adsp-peak-freq').val(freq).trigger('input');
    } else {
      dsp.settings.notch_freq = freq;
      dsp.settings.notch_on = true;
      if (dsp.filters.notch) dsp.filters.notch.frequency.value = freq;
      $('#adsp-notch-on').prop('checked', true);
      $('#adsp-notch-freq').val(freq).trigger('input');
    }
    dsp._reconnect();
    dsp._save();
  });

  // Peak-hold toggle
  $(document).on('click', '#audio-dsp-btn-peak', function () {
    dsp.settings.peak_hold = !dsp.settings.peak_hold;
    $(this).toggleClass('adsp-btn-active', dsp.settings.peak_hold);
    if (dsp._peaks) dsp._peaks.fill(0);
    dsp._save();
  });
  // Waterfall toggle
  $(document).on('click', '#audio-dsp-btn-wf', function () {
    dsp.settings.waterfall = !dsp.settings.waterfall;
    $(this).toggleClass('adsp-btn-active', dsp.settings.waterfall);
    $('#audio-dsp-canvas').toggleClass('adsp-tall', dsp.settings.waterfall);
    dsp._resizeCanvas();
    dsp._save();
  });
  // Cursor frequency readout on the spectrum
  $(document).on('mousemove', '#audio-dsp-canvas', function (e) {
    var r = this.getBoundingClientRect();
    dsp._curX = e.clientX - r.left;
  });
  $(document).on('mouseleave', '#audio-dsp-canvas', function () {
    dsp._curX = -1;
  });

  // 8. Double-click on titlebar → recenter window (bottom center)
  $(document).on('dblclick', '#audio-dsp-titlebar', function () {
    var el = document.getElementById('audio-dsp-window');
    el.style.top = 'auto'; el.style.right = 'auto';
    el.style.bottom = '20px'; el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
  });

  // 6. NR learn button
  $(document).on('click', '#adsp-nr-learn', function (e) {
    e.stopPropagation(); e.preventDefault();
    if (dsp.filters.nr) {
      dsp.filters.nr.port.postMessage({ reset: true });
      var $v = $('#adsp-nr-val');
      $v.text('learn...');
      setTimeout(function () { $v.text(dsp.settings.nr_strength + '%'); }, 900);
    }
  });

  // 3. Auto-preset toggle
  $(document).on('change', '#adsp-auto-preset', function (e) {
    e.stopPropagation();
    dsp.settings.auto_preset = this.checked;
    dsp._lastMode = null;   // re-arm
    dsp._save();
  });

  // Noise Reduction
  $(document).on('change', '#adsp-nr-on', function () {
    dsp.settings.nr_on = this.checked;
    if (this.checked && dsp.filters.nr) dsp.filters.nr.port.postMessage({ reset: true }); // re-learn noise
    dsp._reconnect();
  });
  $(document).on('input', '#adsp-nr-strength', function () {
    var v = parseInt(this.value);
    dsp.settings.nr_strength = v;
    $('#adsp-nr-val').text(v + '%');
    dsp._sendNRParams();
    dsp._save();
  });

  // Compressor / AGC
  dsp.filters.comp = ctx.createDynamicsCompressor();
  dsp.filters.comp.threshold.value = dsp.settings.comp_threshold;
  dsp.filters.comp.ratio.value = dsp.settings.comp_ratio;
  dsp.filters.comp.knee.value = 6;
  dsp.filters.comp.attack.value = 0.003;
  dsp.filters.comp.release.value = 0.25;

  // ── Noise Reduction: AudioWorklet with spectral subtraction ──
  dsp.nrReady = false;
  var nrSrc = String.raw`
class ADSPNR extends AudioWorkletProcessor {
  constructor(){
    super();
    var N=512; this.N=N; this.H=N>>1;
    this.win=new Float32Array(N);
    for(var i=0;i<N;i++) this.win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
    this.inBuf=new Float32Array(N); this.inFill=0;
    this.ola=new Float32Array(N);
    this.outFifo=new Float32Array(8192); this.oR=0; this.oW=0;
    this.re=new Float32Array(N); this.im=new Float32Array(N);
    this.noise=new Float32Array(this.H+1); this.noise.fill(1e-4);
    this.gp=new Float32Array(this.H+1); this.gp.fill(1);
    this.prevMag=new Float32Array(this.H+1);   // |X_clean| previous frame
    this.prevGam=new Float32Array(this.H+1); this.prevGam.fill(1); // posteriori SNR prev
    this.emAlpha=0.98;                          // decision-directed smoothing

    this.strength=2.0; this.floor=0.12; this.frames=0;
    this.nrOn=true; this.nbOn=false; this.nbTh=6;
    this.env=1e-3; this.prev=0;
    this.br=new Uint16Array(N);
    var bits=Math.log2(N);
    for(var i=0;i<N;i++){var r=0,x=i;for(var b=0;b<bits;b++){r=(r<<1)|(x&1);x>>=1;}this.br[i]=r;}
    var self=this;
    this.port.onmessage=function(e){var d=e.data;
      if(d.strength!==undefined)self.strength=d.strength;
      if(d.floor!==undefined)self.floor=d.floor;
      if(d.nrOn!==undefined)self.nrOn=d.nrOn;
      if(d.nbOn!==undefined)self.nbOn=d.nbOn;
      if(d.nbTh!==undefined)self.nbTh=d.nbTh;
      if(d.reset){self.noise.fill(1e-4);self.frames=0;self.prevMag.fill(0);self.prevGam.fill(1);self.gp.fill(1);}
    };
  }
  fft(re,im,inv){
    var N=this.N,br=this.br,i,j,t;
    for(i=0;i<N;i++){j=br[i];if(j>i){t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
    for(var len=2;len<=N;len<<=1){
      var ang=(inv?2:-2)*Math.PI/len;
      var wr=Math.cos(ang),wi=Math.sin(ang);
      for(i=0;i<N;i+=len){
        var cr=1,ci=0;
        for(j=0;j<len/2;j++){
          var a=i+j,b=a+len/2;
          var tr=re[b]*cr-im[b]*ci, ti=re[b]*ci+im[b]*cr;
          re[b]=re[a]-tr; im[b]=im[a]-ti;
          re[a]+=tr; im[a]+=ti;
          var ncr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=ncr;
        }
      }
    }
    if(inv){for(i=0;i<N;i++){re[i]/=N;im[i]/=N;}}
  }
  frame(){
    var N=this.N,H=this.H,re=this.re,im=this.im,i,k;
    for(i=0;i<N;i++){re[i]=this.inBuf[i]*this.win[i];im[i]=0;}
    this.fft(re,im,false);
    this.frames++;
    var n=this.noise;
    // Over-subtraction factor derived from the strength slider (>=1 aggressive)
    var beta=this.strength;
    for(k=0;k<=H;k++){
      var pw=re[k]*re[k]+im[k]*im[k];
      var mag=Math.sqrt(pw)+1e-12;
      // Minima tracking of the noise power floor (robust to speech on top)
      var np=n[k];
      if(pw<np){ np=0.8*np+0.2*pw; }
      else { np=np*1.006+1e-9; }
      n[k]=np;
      var noiseP=np*beta+1e-12;

      // gamma = a-posteriori SNR ; xi = a-priori SNR (decision-directed)
      var gamma=pw/noiseP; if(gamma>1e5)gamma=1e5;
      var xi=this.emAlpha*(this.prevMag[k]*this.prevMag[k])/noiseP
             +(1-this.emAlpha)*Math.max(gamma-1,0);
      if(xi<1e-6)xi=1e-6;

      // Ephraim-Malah MMSE-STSA gain
      var v=xi/(1+xi)*gamma;
      // G = (sqrt(pi)/2) * sqrt(v)/gamma * exp(-v/2) * [(1+v)I0(v/2)+v I1(v/2)]
      var g;
      if(v<0.0001){
        g=xi/(1+xi);                 // numeric floor → Wiener limit
      } else {
        var h=v*0.5;
        // Bessel I0,I1 via series (converges fast for the v range here)
        var i0=1, i1=0, term0=1, term1=h*0.5, m=1;
        i1=term1;
        while(m<24){
          term0*=(h*h)/(m*m);
          i0+=term0;
          term1*=(h*h)/(m*(m+1));
          i1+=term1;
          m++;
          if(term0<1e-8*i0)break;
        }
        var expf=Math.exp(-h);
        g=0.8862269255*Math.sqrt(v)/gamma*expf*((1+v)*i0+v*i1);
        if(!isFinite(g)) g=xi/(1+xi);
      }
      if(g>1)g=1;
      if(g<this.floor)g=this.floor;

      // Adaptive: when a-priori SNR is high (voice), force gain toward 1
      // so speech onsets are not attenuated by the estimator lag.
      if(xi>4){ var w=Math.min(1,(xi-4)/16); g=g*(1-w)+1*w; }
      // Gentle temporal smoothing (light, keeps transients)
      g=0.85*g+0.15*this.gp[k]; this.gp[k]=g;

      // Store clean magnitude for next frame's a-priori estimate
      this.prevMag[k]=g*mag;
      this.prevGam[k]=gamma;

      re[k]*=g; im[k]*=g;
      if(k>0&&k<H){re[N-k]*=g; im[N-k]*=g;}
    }
    this.fft(re,im,true);
    for(i=0;i<N;i++)this.ola[i]+=re[i];
    for(i=0;i<H;i++){this.outFifo[this.oW&8191]=this.ola[i];this.oW++;}
    this.ola.copyWithin(0,H); this.ola.fill(0,N-H);
    this.inBuf.copyWithin(0,H); this.inFill=N-H;
  }
  process(inputs,outputs){
    var inp=inputs[0]&&inputs[0][0];
    var out=outputs[0];
    var M=out[0].length,i,ch;
    if(inp){
      for(i=0;i<inp.length;i++){
        var x=inp[i];
        var ax=x<0?-x:x;
        this.env=0.9995*this.env+0.0005*ax;
        if(this.nbOn && this.env>1e-5 && ax>this.nbTh*this.env){
          x=this.prev*0.7;
        } else { this.prev=x; }
        if(this.nrOn){
          this.inBuf[this.inFill++]=x;
          if(this.inFill===this.N)this.frame();
        } else {
          this.outFifo[this.oW&8191]=x; this.oW++;
        }
      }
    }
    for(i=0;i<M;i++){
      var v=0;
      if(this.oW-this.oR>0){v=this.outFifo[this.oR&8191];this.oR++;}
      for(ch=0;ch<out.length;ch++)out[ch][i]=v;
    }
    return true;
  }
}
registerProcessor('adsp-nr-processor',ADSPNR);

class ADSPLMS extends AudioWorkletProcessor {
  constructor(){
    super();
    this.taps=64;
    this.delay=8;                 // decorrelation delay (samples)
    this.w=new Float32Array(this.taps);
    this.hist=new Float32Array(this.taps);
    this.line=new Float32Array(this.delay+1);
    this.lp=0;
    this.mu=0.02;                 // step size (normalized)
    this.mode=0;                  // 0 = notch, 1 = peak
    this.leak=0.9999;
    this.pwr=1e-3;
    var self=this;
    this.port.onmessage=function(e){var d=e.data;
      if(d.mu!==undefined)self.mu=d.mu;
      if(d.mode!==undefined)self.mode=d.mode;
      if(d.taps!==undefined&&d.taps!==self.taps){
        self.taps=d.taps; self.w=new Float32Array(d.taps); self.hist=new Float32Array(d.taps);
      }
      if(d.reset){self.w.fill(0);self.hist.fill(0);}
    };
  }
  process(inputs,outputs){
    var inp=inputs[0]&&inputs[0][0];
    var out=outputs[0];
    var M=out[0].length,i,ch,j;
    if(!inp){ for(i=0;i<M;i++)for(ch=0;ch<out.length;ch++)out[ch][i]=0; return true; }
    var taps=this.taps,w=this.w,hist=this.hist,line=this.line,DL=this.delay;
    for(i=0;i<M;i++){
      var x=inp[i];
      // push x into delay line, get delayed sample as filter input
      line[this.lp]=x; this.lp=(this.lp+1)%(DL+1);
      var xd=line[this.lp];
      // shift history, insert delayed input
      for(j=taps-1;j>0;j--)hist[j]=hist[j-1];
      hist[0]=xd;
      // predict
      var y=0; for(j=0;j<taps;j++)y+=w[j]*hist[j];
      var e=x-y;
      // NLMS update on the error (predict the correlated part)
      this.pwr=0.99*this.pwr+0.01*(xd*xd);
      var step=this.mu/(this.pwr*taps+1e-6);
      for(j=0;j<taps;j++)w[j]=this.leak*w[j]+step*e*hist[j];
      var o=(this.mode===1)?y:e;   // peak keeps prediction, notch keeps error
      for(ch=0;ch<out.length;ch++)out[ch][i]=o;
    }
    return true;
  }
}
registerProcessor('adsp-lms-processor',ADSPLMS);
`;
  try {
    var nrBlob = new Blob([nrSrc], { type: 'application/javascript' });
    var nrUrl = URL.createObjectURL(nrBlob);
    ctx.audioWorklet.addModule(nrUrl).then(function () {
      dsp.filters.nr = new AudioWorkletNode(ctx, 'adsp-nr-processor', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1]
      });
      dsp.nrReady = true;
      dsp._sendNRParams();
      // Load the LMS adaptive filter module (shares the same worklet context)
      ctx.audioWorklet.addModule(nrUrl).then(function () {
        try {
          dsp.filters.lms = new AudioWorkletNode(ctx, 'adsp-lms-processor', {
            numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1]
          });
          dsp.lmsReady = true;
          dsp._sendLMSParams();
          if (dsp.settings.lms_on) dsp._reconnect();
          console.log('[audio_dsp] LMS worklet ready.');
        } catch (e) { console.warn('[audio_dsp] LMS node failed:', e); }
      });
      if (dsp.settings.nr_on || dsp.settings.lms_on) dsp._reconnect();
      console.log('[audio_dsp] NR worklet ready.');
    }).catch(function (e) {
      console.warn('[audio_dsp] NR worklet failed:', e);
      $('#adsp-nr-on').prop('disabled', true).attr('title', 'AudioWorklet not supported');
    });
  } catch (e) {
    console.warn('[audio_dsp] NR unavailable:', e);
  }
  dsp._rnnBuild(ctx);   // EA7CL: NR con red neuronal (RNNoise)

  // ── 10-band graphic EQ (peaking biquads in series) ──
  dsp.eqBands = [];
  for (var bi = 0; bi < 10; bi++) {
    var b = ctx.createBiquadFilter();
    b.type = 'peaking';
    b.frequency.value = dsp.eqFreqs[bi];
    b.Q.value = 1.4;
    b.gain.value = dsp.settings.eq_g[bi] || 0;
    dsp.eqBands.push(b);
  }

  // ── Binaural pseudo-stereo (Haas effect) ──
  dsp.binDelay = ctx.createDelay(0.01);
  dsp.binDelay.delayTime.value = 0.0002 + (dsp.settings.bin_w / 100) * 0.0013;
  dsp.binLP = ctx.createBiquadFilter();
  dsp.binLP.type = 'lowpass';
  dsp.binLP.frequency.value = 4000;
  dsp.binMerger = ctx.createChannelMerger(2);

  // ── Output protection: brickwall limiter + trim (anti-clipping) ──
  // The Web Audio DynamicsCompressor applies automatic makeup gain,
  // which pushes strong signals above 0 dBFS. This stage catches them.
  dsp.limiter = ctx.createDynamicsCompressor();
  dsp.limiter.threshold.value = -3;    // start limiting 3 dB before full scale
  dsp.limiter.knee.value = 0;          // hard knee = true limiter
  dsp.limiter.ratio.value = 20;        // brickwall
  dsp.limiter.attack.value = 0.001;    // 1 ms — catches transients
  dsp.limiter.release.value = 0.06;

  dsp.trim = ctx.createGain();
  dsp.trim.gain.value = 0.85;          // ~ -1.4 dB headroom (compensates limiter makeup)

  dsp.analyser = ctx.createAnalyser();
  dsp.analyser.fftSize = 2048;
  dsp.analyser.smoothingTimeConstant = 0.75;

  // High-resolution analyser for auto-notch carrier detection (pre-DSP tap)
  dsp.anAnalyser = ctx.createAnalyser();
  dsp.anAnalyser.fftSize = 4096;
  dsp.anAnalyser.smoothingTimeConstant = 0.85;
  audioEngine.gainNode.connect(dsp.anAnalyser);

  // Also create a small analyser for the icon mini-bars
  dsp.iconAnalyser = ctx.createAnalyser();
  dsp.iconAnalyser.fftSize = 64;
  dsp.iconAnalyser.smoothingTimeConstant = 0.8;
  // Tap it from gainNode (always connected, pre-DSP)
  audioEngine.gainNode.connect(dsp.iconAnalyser);
};

// ─── Send NR parameters to worklet ───
Plugins.audio_dsp._sendNRParams = function () {
  var dsp = this;
  if (!dsp.filters.nr) return;
  var v = dsp.settings.nr_strength;              // 0..100
  // EA7CL: con IA activa, el NR espectral se queda apagado (solo NB si está puesto)
  if (dsp.filters.rnn) dsp.filters.rnn.port.postMessage({ mix: v / 100 });
  dsp.filters.nr.port.postMessage({
    strength: 1.5 + v * 0.045,                   // 1.5 .. 6.0 over-subtraction (beta)
    floor:    0.30 - v * 0.0026,                 // 0.30 .. 0.04 gain floor
    nrOn: !!dsp.settings.nr_on && !dsp._aiActivo(),
    nbOn: !!dsp.settings.nb_on,
    nbTh: dsp.settings.nb_th
  });
};

// ─── Send LMS parameters ───
Plugins.audio_dsp._sendLMSParams = function () {
  var dsp = this;
  if (!dsp.filters.lms) return;
  var v = dsp.settings.lms_mu;                 // 0..100
  dsp.filters.lms.port.postMessage({
    mu:   0.002 + v * 0.0012,                  // 0.002 .. 0.122 adaptation speed
    mode: dsp.settings.lms_mode
  });
};

// ─── Reconnect audio chain ───
Plugins.audio_dsp._reconnect = function () {
  var dsp = this;
  dsp._save();
  var ctx = dsp.ctx;
  if (!ctx || !audioEngine || !audioEngine.gainNode) return;

  try { audioEngine.gainNode.disconnect(); } catch(e) {}
  Object.values(dsp.filters).forEach(function(f) { try { f.disconnect(); } catch(e) {} });
  try { dsp.analyser.disconnect(); } catch(e) {}
  if (dsp.limiter) { try { dsp.limiter.disconnect(); } catch(e) {} }
  if (dsp.trim)    { try { dsp.trim.disconnect(); } catch(e) {} }
  if (dsp.filters.lms) { try { dsp.filters.lms.disconnect(); } catch(e) {} }
  if (dsp.eqBands) dsp.eqBands.forEach(function(b){ try { b.disconnect(); } catch(e) {} });
  if (dsp.binDelay)  { try { dsp.binDelay.disconnect(); } catch(e) {} }
  if (dsp.binLP)     { try { dsp.binLP.disconnect(); } catch(e) {} }
  if (dsp.binMerger) { try { dsp.binMerger.disconnect(); } catch(e) {} }

  // Always keep icon + auto-notch analysers connected
  try { audioEngine.gainNode.connect(dsp.iconAnalyser); } catch(e) {}
  try { audioEngine.gainNode.connect(dsp.anAnalyser); } catch(e) {}

  if (!dsp.enabled) {
    audioEngine.gainNode.connect(ctx.destination);
    if (dsp.spectrumOn && dsp.analyser) audioEngine.gainNode.connect(dsp.analyser);
    return;
  }

  var chain = [];
  // EA7CL: NB primero (quita impulsos), luego NR: espectral o red neuronal (IA)
  var aiOn = dsp._aiActivo();
  if (((dsp.settings.nr_on && !aiOn) || dsp.settings.nb_on) && dsp.nrReady && dsp.filters.nr) chain.push(dsp.filters.nr);
  if (aiOn) chain.push(dsp.filters.rnn);
  if (dsp.settings.lms_on && dsp.lmsReady && dsp.filters.lms) chain.push(dsp.filters.lms); // adaptive filter
  if (dsp.settings.hp_on)    chain.push(dsp.filters.hp);
  if (dsp.settings.lp_on)    chain.push(dsp.filters.lp);
  if (dsp.settings.notch_on) chain.push(dsp.filters.notch);
  if (dsp.settings.peak_on)  chain.push(dsp.filters.peak);
  if (dsp.settings.eq_on && dsp.eqBands) {
    for (var ei = 0; ei < dsp.eqBands.length; ei++) chain.push(dsp.eqBands[ei]);
  }
  if (dsp.settings.comp_on)  chain.push(dsp.filters.comp);  // AGC always last

  if (chain.length === 0) {
    audioEngine.gainNode.connect(ctx.destination);
    if (dsp.spectrumOn && dsp.analyser) audioEngine.gainNode.connect(dsp.analyser);
    return;
  }

  audioEngine.gainNode.connect(chain[0]);
  for (var i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
  var last = chain[chain.length - 1];
  // Safety stage: last filter → limiter → trim → output
  last.connect(dsp.limiter);
  dsp.limiter.connect(dsp.trim);
  // Output: binaural pseudo-stereo (Haas) or straight mono
  if (dsp.settings.bin_on && dsp.binMerger) {
    dsp.trim.connect(dsp.binMerger, 0, 0);            // Left: direct
    dsp.trim.connect(dsp.binDelay);                   // Right: delayed + soft LP
    dsp.binDelay.connect(dsp.binLP);
    dsp.binLP.connect(dsp.binMerger, 0, 1);
    dsp.binMerger.connect(ctx.destination);
  } else {
    dsp.trim.connect(ctx.destination);
  }
  // Spectrum shows exactly what reaches the speakers (post-limiter)
  if (dsp.spectrumOn && dsp.analyser) dsp.trim.connect(dsp.analyser);
};

// ─── Animated icon: mini spectrum bars on the DSP button ───
Plugins.audio_dsp._startIconAnim = function () {
  var dsp = this;
  var canvas = document.getElementById('audio-dsp-icon-canvas');
  if (!canvas || !dsp.iconAnalyser) return;
  var c = canvas.getContext('2d');
  // HiDPI: render at devicePixelRatio for crisp bars
  var dpr = window.devicePixelRatio || 1;
  var IW = 56, IH = 24;
  canvas.width = Math.round(IW * dpr);
  canvas.height = Math.round(IH * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  var data = new Uint8Array(dsp.iconAnalyser.frequencyBinCount);

  function drawIcon() {
    dsp._iconAnimFrame = requestAnimationFrame(drawIcon);
    dsp.iconAnalyser.getByteFrequencyData(data);

    var w = IW, h = IH;
    c.clearRect(0, 0, w, h);

    // Draw 7 bars from low freq bins
    var numBars = 7;
    var barW = Math.floor(w / numBars) - 1;
    var gap = 1;
    for (var i = 0; i < numBars; i++) {
      var val = data[i + 1] / 255.0;
      var barH = Math.max(2, val * h);
      var x = i * (barW + gap);

      // Navy blue → azure tones: low=deep navy, high=bright azure
      var hue = 225 - val * 25;         // 225 (navy blue) → 200 (azure)
      var sat = 75 + val * 25;          // 75% → 100%
      var lum = dsp.enabled
        ? 22 + val * 43                 // active: 22% (deep) → 65% (bright)
        : 16 + val * 20;               // bypass: dimmer
      c.fillStyle = 'hsl(' + hue + ', ' + sat + '%, ' + lum + '%)';

      // Bars shifted 1px down
      var yOff = 1;
      c.fillRect(x, h - barH + yOff, barW, barH - yOff);
      if (val > 0.3) {
        c.fillStyle = 'rgba(' + Math.floor(60 + val * 80) + ',' + Math.floor(150 + val * 80) + ',255,' + (val * 0.4) + ')';
        c.fillRect(x, h - barH + yOff, barW, 2);
      }
    }
  }
  drawIcon();
};

// ─── Spectrum drawing (main window) ───
// EA7CL 22-11: ancho del analizador (Hz). Una sola escala, 0 a VISTA_HZ,
// para espectro, marcas, rayas de filtros, cursor y clic.
Plugins.audio_dsp.VISTA_HZ = 6000;

Plugins.audio_dsp._startSpectrum = function () {
  var dsp = this;
  if (!dsp.analyser) { console.warn('[audio_dsp] No analyser.'); return; }
  if (dsp.animFrame) return;
  dsp.spectrumOn = true;
  dsp._reconnect();

  var canvas = document.getElementById('audio-dsp-canvas');
  if (!canvas) return;
  var cCtx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var CW = canvas.clientWidth || 410;
  var CH = canvas.clientHeight || 78;
  canvas.width = Math.round(CW * dpr);
  canvas.height = Math.round(CH * dpr);
  cCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var bufLen = dsp.analyser.frequencyBinCount;
  var dataArr = new Uint8Array(bufLen);

  // Peak-hold buffer (values decay slowly)
  dsp._peaks = new Float32Array(bufLen);

  // Offscreen waterfall canvas
  dsp._wfCanvas = document.createElement('canvas');
  dsp._wfCtx = dsp._wfCanvas.getContext('2d');

  var MAXHZ = dsp.VISTA_HZ;

  function draw() {
    dsp.animFrame = requestAnimationFrame(draw);
    dsp.analyser.getByteFrequencyData(dataArr);

    var sr = dsp.ctx.sampleRate;
    var wf = dsp.settings.waterfall;
    var w = CW, h = CH;
    // When waterfall on, split canvas: top half spectrum, bottom half waterfall
    var specH = wf ? Math.floor(h * 0.52) : h;
    var wfH = h - specH;

    cCtx.fillStyle = '#0a0e14';
    cCtx.fillRect(0, 0, w, specH);

    var maxBin = Math.min(bufLen, Math.floor(MAXHZ / (sr / 2) * bufLen));
    var barW = w / maxBin;

    // Freq grid
    var freqs = [500, 1000, 2000, 3000, 4000, 5000];
    cCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    cCtx.fillStyle = 'rgba(255,255,255,0.35)';
    cCtx.font = '9px monospace';
    cCtx.textAlign = 'center';
    for (var fi = 0; fi < freqs.length; fi++) {
      var xf = (freqs[fi] / MAXHZ) * w;
      if (xf > w) break;
      cCtx.beginPath(); cCtx.moveTo(xf, 0); cCtx.lineTo(xf, specH); cCtx.stroke();
      cCtx.fillText(freqs[fi] >= 1000 ? (freqs[fi]/1000)+'k' : freqs[fi], xf, specH - 2);
    }
    // dB grid
    cCtx.textAlign = 'left';
    for (var db = -60; db <= 0; db += 20) {
      var ydb = specH - ((db + 80) / 80) * specH;
      cCtx.beginPath(); cCtx.moveTo(0, ydb); cCtx.lineTo(w, ydb); cCtx.stroke();
      cCtx.fillText(db + 'dB', 2, ydb - 2);
    }

    // Spectrum fill
    var grad = cCtx.createLinearGradient(0, specH, 0, 0);
    grad.addColorStop(0, 'rgba(0,180,255,0.05)');
    grad.addColorStop(0.5, 'rgba(0,180,255,0.2)');
    grad.addColorStop(1, 'rgba(0,255,180,0.4)');
    cCtx.beginPath();
    cCtx.moveTo(0, specH);
    for (var i = 0; i < maxBin; i++) cCtx.lineTo(i * barW, specH - (dataArr[i] / 255.0) * specH);
    cCtx.lineTo(maxBin * barW, specH);
    cCtx.closePath();
    cCtx.fillStyle = grad;
    cCtx.fill();

    // Spectrum line
    cCtx.beginPath();
    cCtx.strokeStyle = '#00d4ff';
    cCtx.lineWidth = 1.5;
    for (var i = 0; i < maxBin; i++) {
      var y = specH - (dataArr[i] / 255.0) * specH;
      if (i === 0) cCtx.moveTo(0, y); else cCtx.lineTo(i * barW, y);
    }
    cCtx.stroke();

    // Peak-hold line
    if (dsp.settings.peak_hold) {
      cCtx.beginPath();
      cCtx.strokeStyle = 'rgba(255, 210, 80, 0.85)';
      cCtx.lineWidth = 1;
      for (var i = 0; i < maxBin; i++) {
        var v = dataArr[i];
        if (v > dsp._peaks[i]) dsp._peaks[i] = v;
        else dsp._peaks[i] *= 0.992;               // slow decay
        var yp = specH - (dsp._peaks[i] / 255.0) * specH;
        if (i === 0) cCtx.moveTo(0, yp); else cCtx.lineTo(i * barW, yp);
      }
      cCtx.stroke();
    }

    dsp._drawFilterMarkers(cCtx, w, specH, sr);

    // Cursor frequency readout
    if (dsp._curX >= 0 && dsp._curX <= w) {
      var cf = Math.round((dsp._curX / w) * MAXHZ);
      cCtx.strokeStyle = 'rgba(255,255,255,0.4)';
      cCtx.setLineDash([2,2]);
      cCtx.beginPath(); cCtx.moveTo(dsp._curX, 0); cCtx.lineTo(dsp._curX, specH); cCtx.stroke();
      cCtx.setLineDash([]);
      cCtx.fillStyle = 'rgba(10,14,20,0.85)';
      var tw = 52;
      var tx = Math.min(w - tw, Math.max(0, dsp._curX + 4));
      cCtx.fillRect(tx, 2, tw, 13);
      cCtx.fillStyle = '#7fe0ff';
      cCtx.font = 'bold 10px monospace';
      cCtx.textAlign = 'left';
      cCtx.fillText(cf + ' Hz', tx + 3, 12);
    }

    // ── Waterfall ──
    if (wf && wfH > 4) {
      var wpx = Math.max(64, Math.round(w));
      if (dsp._wfCanvas.width !== wpx) { dsp._wfCanvas.width = wpx; dsp._wfCanvas.height = 128; }
      var wc = dsp._wfCtx;
      // scroll down by 1px
      wc.drawImage(dsp._wfCanvas, 0, 1);
      // draw newest row on top
      var img = wc.createImageData(wpx, 1);
      for (var x = 0; x < wpx; x++) {
        var bin = Math.floor((x / wpx) * maxBin);
        var val = dataArr[bin] / 255.0;
        // colormap: black→blue→cyan→yellow→red
        var r, g, b;
        if (val < 0.25) { r=0; g=0; b=Math.floor(val*4*180); }
        else if (val < 0.5) { r=0; g=Math.floor((val-0.25)*4*200); b=180; }
        else if (val < 0.75) { r=Math.floor((val-0.5)*4*255); g=200; b=Math.floor(180-(val-0.5)*4*180); }
        else { r=255; g=Math.floor(200-(val-0.75)*4*200); b=0; }
        var o = x*4; img.data[o]=r; img.data[o+1]=g; img.data[o+2]=b; img.data[o+3]=255;
      }
      wc.putImageData(img, 0, 0);
      // blit onto visible canvas (bottom strip)
      cCtx.imageSmoothingEnabled = false;
      cCtx.drawImage(dsp._wfCanvas, 0, 0, wpx, 128, 0, specH, w, wfH);
      // separator line
      cCtx.strokeStyle = 'rgba(0,150,200,0.4)';
      cCtx.lineWidth = 1;
      cCtx.beginPath(); cCtx.moveTo(0, specH); cCtx.lineTo(w, specH); cCtx.stroke();
    }
  }
  draw();
};

Plugins.audio_dsp._stopSpectrum = function () {
  this.spectrumOn = false;
  if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null; }
  this._reconnect();
};

// ─── Resize spectrum canvas to its current CSS size (waterfall on/off) ───
Plugins.audio_dsp._resizeCanvas = function () {
  var dsp = this;
  var canvas = document.getElementById('audio-dsp-canvas');
  if (!canvas || !dsp.animFrame) return;
  // Force the draw loop to re-read dimensions by cancelling and restarting
  cancelAnimationFrame(dsp.animFrame);
  dsp.animFrame = null;
  dsp._startSpectrum();
};

// ─── Independent meter loop: VU + clip LED run even with spectrum closed ───
Plugins.audio_dsp._startMeterLoop = function () {
  var dsp = this;
  if (dsp._meterTimer) return;
  dsp._needlePos = 0;      // current needle angle fraction 0..1
  dsp._needleVel = 0;      // angular velocity (spring-damper)
  dsp._meterTimer = setInterval(function () {
    var red = (dsp.enabled && dsp.settings.comp_on && dsp.filters.comp)
      ? dsp.filters.comp.reduction : 0;                 // 0..-24 dB
    dsp._drawVU(red);
    var led = document.getElementById('adsp-clip-led');
    if (led && dsp.limiter) {
      if (dsp.enabled && dsp.limiter.reduction < -1.5) {
        led.classList.add('lit');
        clearTimeout(dsp._clipT);
        dsp._clipT = setTimeout(function () { led.classList.remove('lit'); }, 350);
      }
    }
    // Titlebar stage LEDs
    dsp._updateStageLEDs();
  }, 100);
};

// ─── Analog VU meter (vintage needle) ───
Plugins.audio_dsp._drawVU = function (redDb) {
  var dsp = this;
  var canvas = document.getElementById('adsp-vu-canvas');
  if (!canvas) return;
  if (!dsp._vuInit) {
    var dpr = window.devicePixelRatio || 1;
    dsp._vuW = canvas.clientWidth || 300;
    dsp._vuH = canvas.clientHeight || 96;
    canvas.width = Math.round(dsp._vuW * dpr);
    canvas.height = Math.round(dsp._vuH * dpr);
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    dsp._vuInit = true;
  }
  var c = canvas.getContext('2d');
  var W = dsp._vuW, H = dsp._vuH;

  // Target: map gain reduction 0..-20 dB → needle 0..1 (left→right)
  var target = Math.min(1, Math.max(0, (-redDb) / 20));
  // Spring-damper physics (ballistic needle like a real VU)
  var k = 0.35, damp = 0.55;
  dsp._needleVel += (target - dsp._needlePos) * k;
  dsp._needleVel *= damp;
  dsp._needlePos += dsp._needleVel;
  if (dsp._needlePos < 0) { dsp._needlePos = 0; dsp._needleVel *= -0.3; }
  if (dsp._needlePos > 1.05) { dsp._needlePos = 1.05; dsp._needleVel *= -0.3; }
  var p = dsp._needlePos;

  // ── Panel background (warm cream, backlit) ──
  var bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f0e6c8');
  bg.addColorStop(0.5, '#e8dab0');
  bg.addColorStop(1, '#d8c698');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  // inner bezel
  c.strokeStyle = 'rgba(80,60,30,0.5)';
  c.lineWidth = 1;
  c.strokeRect(1.5, 1.5, W - 3, H - 3);

  // Geometry: pivot below the panel, arc across the top
  var cx = W / 2;
  var cy = H * 1.28;               // pivot well below → shallow realistic arc
  var radius = H * 1.15;
  var a0 = -Math.PI / 2 - 0.62;    // left end angle
  var a1 = -Math.PI / 2 + 0.62;    // right end angle

  // ── Scale arc + ticks ──
  function ang(f) { return a0 + (a1 - a0) * f; }
  function ptX(f, r) { return cx + Math.cos(ang(f)) * r; }
  function ptY(f, r) { return cy + Math.sin(ang(f)) * r; }

  // Arc baseline
  c.beginPath();
  c.arc(cx, cy, radius, ang(0), ang(1));
  c.strokeStyle = '#3a2f1a';
  c.lineWidth = 1.5;
  c.stroke();

  // Ticks + labels: -20,-10,-7,-5,-3,0 (VU-style, cramped right)
  var marks = [
    { f: 0.00, t: '-20' },
    { f: 0.25, t: '-10' },
    { f: 0.45, t: '-7' },
    { f: 0.62, t: '-5' },
    { f: 0.80, t: '-3' },
    { f: 1.00, t: '0' }
  ];
  c.textAlign = 'center';
  c.font = '8px "roboto-mono", monospace';
  for (var i = 0; i < marks.length; i++) {
    var f = marks[i].f;
    var red0 = f >= 0.8;
    c.beginPath();
    c.moveTo(ptX(f, radius), ptY(f, radius));
    c.lineTo(ptX(f, radius - 7), ptY(f, radius - 7));
    c.strokeStyle = red0 ? '#b01810' : '#3a2f1a';
    c.lineWidth = red0 ? 2 : 1.3;
    c.stroke();
    c.fillStyle = red0 ? '#b01810' : '#3a2f1a';
    c.fillText(marks[i].t, ptX(f, radius - 15), ptY(f, radius - 15) + 3);
  }
  // minor ticks
  for (var m = 0; m < 1; m += 0.05) {
    c.beginPath();
    c.moveTo(ptX(m, radius), ptY(m, radius));
    c.lineTo(ptX(m, radius - 4), ptY(m, radius - 4));
    c.strokeStyle = m >= 0.8 ? 'rgba(176,24,16,0.7)' : 'rgba(58,47,26,0.6)';
    c.lineWidth = 0.8;
    c.stroke();
  }

  // Red zone arc near the top
  c.beginPath();
  c.arc(cx, cy, radius - 1, ang(0.8), ang(1));
  c.strokeStyle = 'rgba(200,30,20,0.85)';
  c.lineWidth = 2.5;
  c.stroke();

  // "VU" label + dB caption
  c.fillStyle = 'rgba(60,45,20,0.7)';
  c.font = 'bold 9px "roboto-mono", monospace';
  c.textAlign = 'center';
  c.fillText('VU · gain reduction', cx, H - 6);

  // ── Needle ──
  var na = ang(p);
  var nLen = radius - 3;
  var tipX = cx + Math.cos(na) * nLen;
  var tipY = cy + Math.sin(na) * nLen;
  // shadow
  c.beginPath();
  c.moveTo(cx + 1, cy + 1);
  c.lineTo(tipX + 1, tipY + 1);
  c.strokeStyle = 'rgba(0,0,0,0.2)';
  c.lineWidth = 2.5;
  c.stroke();
  // needle (red, tapering look via two strokes)
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(tipX, tipY);
  c.strokeStyle = '#c81808';
  c.lineWidth = 2;
  c.stroke();
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo((cx + tipX) / 2, (cy + tipY) / 2);
  c.strokeStyle = '#8a1005';
  c.lineWidth = 3;
  c.stroke();

  // Hub
  c.beginPath();
  c.arc(cx, cy, 5, 0, 2 * Math.PI);
  var hub = c.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 5);
  hub.addColorStop(0, '#666');
  hub.addColorStop(1, '#111');
  c.fillStyle = hub;
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 0.5;
  c.stroke();

  // Glass highlight
  var gl = c.createLinearGradient(0, 0, 0, H * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.18)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl;
  c.fillRect(0, 0, W, H * 0.5);
};

// ─── Update the active-stage LED strip in the titlebar ───
Plugins.audio_dsp._updateStageLEDs = function () {
  var dsp = this, s = dsp.settings, on = dsp.enabled;
  var stages = {
    nr:    on && (s.nr_on || s.nb_on),
    lms:   on && s.lms_on,
    filt:  on && (s.hp_on || s.lp_on || s.notch_on || s.peak_on),
    eq:    on && s.eq_on,
    comp:  on && s.comp_on,
    fx:    on && s.bin_on
  };
  for (var k in stages) {
    var el = document.getElementById('adsp-led-' + k);
    if (el) el.classList.toggle('on', stages[k]);
  }
};

Plugins.audio_dsp._drawFilterMarkers = function (cCtx, w, h, sr) {
  var dsp = this;
  if (!dsp.enabled) return;
  var maxFreq = dsp.VISTA_HZ;
  var markers = [];
  if (dsp.settings.hp_on)    markers.push({ freq: dsp.settings.hp_freq, color: '#ff6b6b', label: 'HP' });
  if (dsp.settings.lp_on)    markers.push({ freq: dsp.settings.lp_freq, color: '#ffd93d', label: 'LP' });
  if (dsp.settings.notch_on) markers.push({ freq: dsp.settings.notch_freq, color: '#ff4ecb', label: 'N' });
  if (dsp.settings.peak_on)  markers.push({ freq: dsp.settings.peak_freq, color: '#6bff6b', label: 'PK' });

  cCtx.font = 'bold 10px monospace';
  cCtx.textAlign = 'center';
  for (var m = 0; m < markers.length; m++) {
    var mk = markers[m];
    var x = (mk.freq / maxFreq) * w;
    if (x < 0 || x > w) continue;
    cCtx.strokeStyle = mk.color;
    cCtx.lineWidth = 1.5;
    cCtx.setLineDash([4, 3]);
    cCtx.beginPath(); cCtx.moveTo(x, 0); cCtx.lineTo(x, h); cCtx.stroke();
    cCtx.setLineDash([]);
    cCtx.fillStyle = mk.color;
    cCtx.fillText(mk.label + ' ' + mk.freq, x, 12);
  }
};

// ─── Build UI ───
Plugins.audio_dsp._buildUI = function () {
  var dsp = this;

  // ══════════════════════════════════════════════
  //  Icon button — placed under the S-meter line
  // ══════════════════════════════════════════════
  var iconHtml =
    '<div id="audio-dsp-icon" title="Audio DSP — click to open">' +
      '<canvas id="audio-dsp-icon-canvas" width="56" height="24"></canvas>' +
      '<span id="audio-dsp-icon-label">DSP</span>' +
      '<span id="audio-dsp-icon-led" title="DSP status"></span>' +
    '</div>';

  // Try to insert after the S-meter panel-line
  var $smeterLine = $('#openwebrx-smeter').closest('.openwebrx-panel-line');
  if ($smeterLine.length) {
    $smeterLine.after(iconHtml);
    console.log('[audio_dsp] Icon placed after S-meter line.');
  } else {
    // Fallback: after smeter-db
    var $smdb = $('#openwebrx-smeter-db');
    if ($smdb.length) {
      $smdb.after(iconHtml);
      console.log('[audio_dsp] Icon placed after smeter-db.');
    } else {
      // Last fallback: floating
      $('body').append('<div style="position:fixed;bottom:10px;right:10px;z-index:9999">' + iconHtml + '</div>');
      console.warn('[audio_dsp] S-meter not found, floating icon.');
    }
  }

  // ══════════════════════════════════════════════
  //  Floating window
  // ══════════════════════════════════════════════
  var html =
    '<div id="audio-dsp-window" style="display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:10000;">' +
      '<div id="audio-dsp-titlebar">' +
        '<span class="adsp-title-text">&#9835; Audio DSP</span>' +
        '<span class="adsp-led-strip">' +
          '<span class="adsp-led-mini" id="adsp-led-nr" title="Noise Reduction / Blanker"></span>' +
          '<span class="adsp-led-mini" id="adsp-led-lms" title="Adaptive filter"></span>' +
          '<span class="adsp-led-mini" id="adsp-led-filt" title="HP/LP/Notch/Peak"></span>' +
          '<span class="adsp-led-mini" id="adsp-led-eq" title="Graphic EQ"></span>' +
          '<span class="adsp-led-mini" id="adsp-led-comp" title="Compressor"></span>' +
          '<span class="adsp-led-mini" id="adsp-led-fx" title="Binaural FX"></span>' +
        '</span>' +
        '<div id="audio-dsp-titlebar-btns">' +
          '<button id="audio-dsp-btn-peak" title="Peak hold (freeze maxima)">&#9651;</button>' +
          '<button id="audio-dsp-btn-wf" title="Audio waterfall">&#9776;</button>' +
          '<button id="audio-dsp-btn-spectrum" title="Toggle spectrum on/off">&#9633;</button>' +
          '<button id="audio-dsp-btn-close" title="Close">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div id="audio-dsp-body">' +
        '<canvas id="audio-dsp-canvas" width="410" height="78"></canvas>' +

        /* ── Master ON ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-master" /> <b title="Master on/off for the whole DSP chain. When off, audio passes through untouched.">&#9889; DSP ENGINE</b>' +
            '<label class="adsp-auto-label" title="Automatically apply the matching preset when the demodulator mode changes">' +
              '<input type="checkbox" id="adsp-auto-preset" /> AUTO PRESET' +
            '</label>' +
            '<span class="adsp-val" id="adsp-status">bypass</span>' +
          '</label>' +
        '</div>' +

        /* ── Tabs ── */
        '<div class="adsp-tabs">' +
          '<button type="button" class="adsp-tab adsp-tab-active" data-page="1">FILTERS</button>' +
          '<button type="button" class="adsp-tab" data-page="2">EQ + FX</button>' +
        '</div>' +

        '<div id="adsp-page1">' +

        /* ── Noise Reduction ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-nr-on" />' +
            '<span class="adsp-filter-icon">&#10057;</span>' +
            '<span class="adsp-filter-name" title="Ephraim-Malah spectral NR: removes steady hiss/background while preserving voice. Press LEARN during a pause.">Noise Reduction</span>' +
            '<button type="button" class="adsp-mini-btn" id="adsp-nr-ai" title="Reducción de ruido con red neuronal (RNNoise). Limpia mucho la voz en SSB, AM y FM. No usar en CW ni en modos digitales: los quita como si fueran ruido. El deslizador Level marca cuánto ruido se quita.">IA</button>' +
            '<button type="button" class="adsp-mini-btn" id="adsp-nr-learn" title="Re-learn noise profile: press during a pause with noise only">LEARN</button>' +
            '<span class="adsp-ai-vad" id="adsp-nr-vad" title="Voz detectada por la red neuronal"></span>' +
            '<span class="adsp-val" id="adsp-nr-val">50%</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Level</span>' +
            '<input type="range" id="adsp-nr-strength" min="0" max="100" value="50" step="1" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        /* ── Highpass ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-hp-on" />' +
            '<span class="adsp-filter-icon">&#9650;</span>' +
            '<span class="adsp-filter-name" title="Cuts low frequencies below the cutoff. Removes rumble, hum and mains noise.">Highpass</span>' +
            '<span class="adsp-val" id="adsp-hp-val">200 Hz</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Freq</span>' +
            '<input type="range" id="adsp-hp-freq" min="50" max="1000" value="200" step="10" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        /* ── Lowpass ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-lp-on" />' +
            '<span class="adsp-filter-icon">&#9660;</span>' +
            '<span class="adsp-filter-name" title="Cuts high frequencies above the cutoff. Removes hiss and high-pitched noise.">Lowpass</span>' +
            '<span class="adsp-val" id="adsp-lp-val">3400 Hz</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Freq</span>' +
            '<input type="range" id="adsp-lp-freq" min="1000" max="8000" value="3400" step="50" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        /* ── Notch ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-notch-on" />' +
            '<span class="adsp-filter-icon">&#10006;</span>' +
            '<span class="adsp-filter-name" title="Removes one narrow frequency. Use AUTO to auto-track a heterodyne/carrier. Or click on the spectrum.">Notch Filter</span>' +
            '<label class="adsp-auto-label" title="Auto-detect carrier and move notch onto it">' +
              '<input type="checkbox" id="adsp-notch-auto" /> AUTO' +
            '</label>' +
            '<span class="adsp-val" id="adsp-notch-val">1000 Hz Q:10</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Freq</span>' +
            '<input type="range" id="adsp-notch-freq" min="100" max="5000" value="1000" step="10" class="adsp-slider" />' +
          '</div>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Q</span>' +
            '<input type="range" id="adsp-notch-q" min="1" max="50" value="10" step="1" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        /* ── Peaking EQ ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-peak-on" />' +
            '<span class="adsp-filter-icon">&#9839;</span>' +
            '<span class="adsp-filter-name" title="Boosts or cuts a band. Positive gain emphasises voice presence. Shift+click the spectrum to place it.">Peaking EQ</span>' +
            '<span class="adsp-val" id="adsp-peak-val">1500 Hz +0dB</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Freq</span>' +
            '<input type="range" id="adsp-peak-freq" min="100" max="5000" value="1500" step="10" class="adsp-slider" />' +
          '</div>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Gain</span>' +
            '<input type="range" id="adsp-peak-gain" min="-20" max="20" value="0" step="1" class="adsp-slider" />' +
          '</div>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Q</span>' +
            '<input type="range" id="adsp-peak-q" min="0.5" max="10" value="1.5" step="0.1" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        /* ── Compressor / AGC ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-comp-on" />' +
            '<span class="adsp-filter-icon">&#8779;</span>' +
            '<span class="adsp-filter-name" title="Levels loud and soft passages. Thr = where it starts, Ratio = how hard. Watch the GR meter.">Compressor / AGC</span>' +
            '<span class="adsp-val" id="adsp-comp-val">-30dB 6:1</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Thr</span>' +
            '<input type="range" id="adsp-comp-threshold" min="-60" max="0" value="-30" step="1" class="adsp-slider" />' +
          '</div>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Ratio</span>' +
            '<input type="range" id="adsp-comp-ratio" min="1" max="20" value="6" step="0.5" class="adsp-slider" />' +
          '</div>' +
          '<div class="adsp-vu-analog">' +
            '<canvas id="adsp-vu-canvas" width="300" height="96"></canvas>' +
            '<span class="adsp-clip-led" id="adsp-clip-led" title="Limiter engaging — reduce EQ gain if always lit"></span>' +
          '</div>' +
        '</div>' +

        '</div>' +   /* end page1 */

        /* ══ PAGE 2: EQ + FX ══ */
        '<div id="adsp-page2" style="display:none">' +

        /* ── LMS Adaptive Filter ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-lms-on" />' +
            '<span class="adsp-filter-icon">&#8734;</span>' +
            '<span class="adsp-filter-name" title="LMS adaptive DSP. NOTCH removes ALL carriers/tones at once. PEAK extracts a weak tone (CW) from noise. Speed sets adaptation rate.">Adaptive Filter</span>' +
            '<span class="adsp-seg">' +
              '<button type="button" class="adsp-seg-btn adsp-seg-active" id="adsp-lms-mode-notch" title="Remove all carriers/tones (auto-notch)">NOTCH</button>' +
              '<button type="button" class="adsp-seg-btn" id="adsp-lms-mode-peak" title="Extract tone from noise (auto-peak)">PEAK</button>' +
            '</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Speed</span>' +
            '<input type="range" id="adsp-lms-mu" min="0" max="100" value="30" step="1" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        /* ── 10-band Graphic EQ ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-eq-on" />' +
            '<span class="adsp-filter-icon">&#9636;</span>' +
            '<span class="adsp-filter-name" title="10-band tone shaping, 100 Hz to 4.5 kHz, +/-12 dB each. FLAT resets all bands.">Graphic EQ &#8212; 10 band</span>' +
            '<button type="button" class="adsp-mini-btn" id="adsp-eq-flat" title="Reset all bands to 0 dB">FLAT</button>' +
          '</label>' +
          '<div class="adsp-eq-grid">' +
            [100,200,400,600,900,1300,1800,2400,3200,4500].map(function(f, i) {
              return '<div class="adsp-eq-band">' +
                '<input type="range" id="adsp-eq-' + i + '" class="adsp-eq-slider" data-band="' + i + '" min="-12" max="12" value="0" step="1" />' +
                '<span class="adsp-eq-lbl">' + (f >= 1000 ? (f/1000) + 'k' : f) + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' +

        /* ── Noise Blanker ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-nb-on" />' +
            '<span class="adsp-filter-icon">&#9889;</span>' +
            '<span class="adsp-filter-name" title="Removes short impulse noise (ignition, static crashes, power-line clicks). Lower threshold = more aggressive.">Noise Blanker</span>' +
            '<span class="adsp-val" id="adsp-nb-val">x6</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Thresh</span>' +
            '<input type="range" id="adsp-nb-th" min="2" max="12" value="6" step="0.5" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        /* ── Binaural Pseudo-Stereo ── */
        '<div class="adsp-section">' +
          '<label class="adsp-row">' +
            '<input type="checkbox" id="adsp-bin-on" />' +
            '<span class="adsp-filter-icon">&#9678;</span>' +
            '<span class="adsp-filter-name" title="Pseudo-stereo for headphones: adds spaciousness and reduces listening fatigue. Width sets the effect.">Binaural Stereo</span>' +
            '<span class="adsp-val" id="adsp-bin-val">50%</span>' +
          '</label>' +
          '<div class="adsp-slider-group">' +
            '<span class="adsp-slider-label">Width</span>' +
            '<input type="range" id="adsp-bin-w" min="0" max="100" value="50" step="1" class="adsp-slider" />' +
          '</div>' +
        '</div>' +

        '</div>' +   /* end page2 */

        /* ── Presets ── */
        '<div class="adsp-presets">' +
          '<button class="adsp-btn" id="adsp-pre-ssb">&#9741; SSB Voice</button>' +
          '<button class="adsp-btn" id="adsp-pre-am">&#9832; AM Broadcast</button>' +
          '<button class="adsp-btn" id="adsp-pre-cw">&#9899; CW/Narrow</button>' +
          '<button class="adsp-btn" id="adsp-pre-reset">&#8634; Reset</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  $('body').append(html);

  // ══════════════════════════════════════════════
  //  Events (all delegated)
  // ══════════════════════════════════════════════

  // Icon click → open/close window
  $(document).on('click', '#audio-dsp-icon', function (e) {
    e.stopPropagation();
    var $win = $('#audio-dsp-window');
    if ($win.is(':visible')) {
      $win.hide();
      dsp._stopSpectrum();
    } else {
      $win.show();
      if (dsp.hooked) dsp._startSpectrum();
    }
  });

  $(document).on('click', '#audio-dsp-btn-close', function () {
    $('#audio-dsp-window').hide();
    dsp._stopSpectrum();
  });

  $(document).on('click', '#audio-dsp-btn-spectrum', function () {
    if (dsp.spectrumOn) dsp._stopSpectrum(); else if (dsp.hooked) dsp._startSpectrum();
  });

  $(document).on('change', '#adsp-master', function () {
    dsp.enabled = this.checked;
    $('#adsp-status').text(dsp.enabled ? 'active' : 'bypass');
    $('#audio-dsp-icon').toggleClass('adsp-active', dsp.enabled);
    dsp._reconnect();
  });

  $(document).on('change', '#adsp-hp-on', function () { dsp.settings.hp_on = this.checked; dsp._reconnect(); });
  $(document).on('input', '#adsp-hp-freq', function () {
    var v = parseInt(this.value); dsp.settings.hp_freq = v;
    if (dsp.filters.hp) dsp.filters.hp.frequency.value = v;
    $('#adsp-hp-val').text(v + ' Hz');
    dsp._save();
  });

  $(document).on('change', '#adsp-lp-on', function () { dsp.settings.lp_on = this.checked; dsp._reconnect(); });
  $(document).on('input', '#adsp-lp-freq', function () {
    var v = parseInt(this.value); dsp.settings.lp_freq = v;
    if (dsp.filters.lp) dsp.filters.lp.frequency.value = v;
    $('#adsp-lp-val').text(v + ' Hz');
    dsp._save();
  });

  $(document).on('change', '#adsp-notch-on', function () { dsp.settings.notch_on = this.checked; dsp._reconnect(); });
  $(document).on('input', '#adsp-notch-freq', function () {
    var v = parseInt(this.value); dsp.settings.notch_freq = v;
    if (dsp.filters.notch) dsp.filters.notch.frequency.value = v;
    $('#adsp-notch-val').text(v + ' Hz Q:' + dsp.settings.notch_q);
  });
  $(document).on('input', '#adsp-notch-q', function () {
    var v = parseFloat(this.value); dsp.settings.notch_q = v;
    if (dsp.filters.notch) dsp.filters.notch.Q.value = v;
    $('#adsp-notch-val').text(dsp.settings.notch_freq + ' Hz Q:' + v);
  });

  $(document).on('change', '#adsp-peak-on', function () { dsp.settings.peak_on = this.checked; dsp._reconnect(); });
  $(document).on('input', '#adsp-peak-freq', function () {
    var v = parseInt(this.value); dsp.settings.peak_freq = v;
    if (dsp.filters.peak) dsp.filters.peak.frequency.value = v;
    $('#adsp-peak-val').text(v + ' Hz ' + (dsp.settings.peak_gain >= 0 ? '+' : '') + dsp.settings.peak_gain + 'dB');
  });
  $(document).on('input', '#adsp-peak-gain', function () {
    var v = parseFloat(this.value); dsp.settings.peak_gain = v;
    if (dsp.filters.peak) dsp.filters.peak.gain.value = v;
    $('#adsp-peak-val').text(dsp.settings.peak_freq + ' Hz ' + (v >= 0 ? '+' : '') + v + 'dB');
  });
  $(document).on('input', '#adsp-peak-q', function () {
    var v = parseFloat(this.value); dsp.settings.peak_q = v;
    if (dsp.filters.peak) dsp.filters.peak.Q.value = v;
  });

  // 2. Click on spectrum → move the notch there (Shift+click → Peak EQ)
  $(document).on('click', '#audio-dsp-canvas', function (e) {
    if (!dsp.hooked || !dsp.ctx) return;
    var rect = this.getBoundingClientRect();
    var frac = (e.clientX - rect.left) / rect.width;
    var freq = Math.round(frac * dsp.VISTA_HZ);
    freq = Math.max(100, Math.min(5000, freq));
    if (e.shiftKey) {
      dsp.settings.peak_freq = freq;
      dsp.settings.peak_on = true;
      if (dsp.filters.peak) dsp.filters.peak.frequency.value = freq;
      $('#adsp-peak-on').prop('checked', true);
      $('#adsp-peak-freq').val(freq).trigger('input');
    } else {
      dsp.settings.notch_freq = freq;
      dsp.settings.notch_on = true;
      if (dsp.filters.notch) dsp.filters.notch.frequency.value = freq;
      $('#adsp-notch-on').prop('checked', true);
      $('#adsp-notch-freq').val(freq).trigger('input');
    }
    dsp._reconnect();
    dsp._save();
  });

  // 8. Double-click on titlebar → recenter window (bottom center)
  $(document).on('dblclick', '#audio-dsp-titlebar', function () {
    var el = document.getElementById('audio-dsp-window');
    el.style.top = 'auto'; el.style.right = 'auto';
    el.style.bottom = '20px'; el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
  });

  // 6. NR learn button
  $(document).on('click', '#adsp-nr-learn', function (e) {
    e.stopPropagation(); e.preventDefault();
    if (dsp.filters.nr) {
      dsp.filters.nr.port.postMessage({ reset: true });
      var $v = $('#adsp-nr-val');
      $v.text('learn...');
      setTimeout(function () { $v.text(dsp.settings.nr_strength + '%'); }, 900);
    }
  });

  // 3. Auto-preset toggle
  $(document).on('change', '#adsp-auto-preset', function (e) {
    e.stopPropagation();
    dsp.settings.auto_preset = this.checked;
    dsp._lastMode = null;   // re-arm
    dsp._save();
  });

  // Noise Reduction
  $(document).on('change', '#adsp-nr-on', function () {
    dsp.settings.nr_on = this.checked;
    if (this.checked && dsp.filters.nr) dsp.filters.nr.port.postMessage({ reset: true }); // re-learn noise
    dsp._reconnect();
  });
  $(document).on('input', '#adsp-nr-strength', function () {
    var v = parseInt(this.value);
    dsp.settings.nr_strength = v;
    $('#adsp-nr-val').text(v + '%');
    dsp._sendNRParams();
    dsp._save();
  });

  // Compressor / AGC
  $(document).on('change', '#adsp-comp-on', function () { dsp.settings.comp_on = this.checked; dsp._reconnect(); });
  $(document).on('input', '#adsp-comp-threshold', function () {
    var v = parseInt(this.value); dsp.settings.comp_threshold = v;
    if (dsp.filters.comp) dsp.filters.comp.threshold.value = v;
    $('#adsp-comp-val').text(v + 'dB ' + dsp.settings.comp_ratio + ':1');
  });
  $(document).on('input', '#adsp-comp-ratio', function () {
    var v = parseFloat(this.value); dsp.settings.comp_ratio = v;
    if (dsp.filters.comp) dsp.filters.comp.ratio.value = v;
    $('#adsp-comp-val').text(dsp.settings.comp_threshold + 'dB ' + v + ':1');
  });

  // Auto-notch
  $(document).on('change', '#adsp-notch-auto', function (e) {
    e.stopPropagation();
    dsp.settings.notch_auto = this.checked;
    if (this.checked) dsp._startAutoNotch(); else dsp._stopAutoNotch();
  });

  $(document).on('click', '#adsp-pre-ssb',   function () { dsp._applyPreset('ssb'); });
  $(document).on('click', '#adsp-pre-am',    function () { dsp._applyPreset('am'); });
  $(document).on('click', '#adsp-pre-cw',    function () { dsp._applyPreset('cw'); });
  $(document).on('click', '#adsp-pre-reset', function () { dsp._applyPreset('reset'); });

  dsp._makeDraggable();
};

// ─── Auto-notch: detect persistent narrow carrier, move notch onto it ───
Plugins.audio_dsp._startAutoNotch = function () {
  var dsp = this;
  if (dsp._anTimer || !dsp.anAnalyser) return;
  var bufLen = dsp.anAnalyser.frequencyBinCount;
  var data = new Uint8Array(bufLen);
  var lastFreq = 0, stableCount = 0;

  dsp._anTimer = setInterval(function () {
    if (!dsp.settings.notch_auto || !dsp.hooked) return;
    dsp.anAnalyser.getByteFrequencyData(data);

    var sr = dsp.ctx.sampleRate;
    var binHz = (sr / 2) / bufLen;
    var loBin = Math.max(1, Math.floor(150 / binHz));
    var hiBin = Math.min(bufLen - 1, Math.ceil(5000 / binHz));

    // Mean level in the audio band
    var sum = 0, n = 0;
    for (var i = loBin; i <= hiBin; i++) { sum += data[i]; n++; }
    var mean = sum / n;

    // Strongest bin
    var maxVal = 0, maxBin = -1;
    for (var i = loBin; i <= hiBin; i++) {
      if (data[i] > maxVal) { maxVal = data[i]; maxBin = i; }
    }

    // Narrowness check: neighbors +/-4 bins must be much lower (carrier, not voice)
    var isNarrow = false;
    if (maxBin > loBin + 4 && maxBin < hiBin - 4) {
      var side = (data[maxBin - 4] + data[maxBin + 4]) / 2;
      isNarrow = (maxVal - side) > 40;
    }

    // Peak must clearly stand out from the mean
    if (maxBin < 0 || maxVal < mean + 55 || !isNarrow) { stableCount = 0; return; }

    var freq = Math.round(maxBin * binHz);

    // Require stability: same carrier (within 60 Hz) for 3 consecutive checks
    if (Math.abs(freq - lastFreq) < 60) { stableCount++; } else { stableCount = 1; }
    lastFreq = freq;
    if (stableCount < 3) return;

    // Lock the notch onto it
    if (Math.abs(freq - dsp.settings.notch_freq) > 25 || !dsp.settings.notch_on) {
      dsp.settings.notch_freq = freq;
      dsp.settings.notch_q = 30;
      if (dsp.filters.notch) {
        dsp.filters.notch.frequency.value = freq;
        dsp.filters.notch.Q.value = 30;
      }
      if (!dsp.settings.notch_on) {
        dsp.settings.notch_on = true;
        $('#adsp-notch-on').prop('checked', true);
        dsp._reconnect();
      }
      $('#adsp-notch-freq').val(freq);
      $('#adsp-notch-q').val(30);
      $('#adsp-notch-val').text(freq + ' Hz AUTO');
      console.log('[audio_dsp] Auto-notch locked on ' + freq + ' Hz');
    }
  }, 400);
};

Plugins.audio_dsp._stopAutoNotch = function () {
  var dsp = this;
  if (dsp._anTimer) { clearInterval(dsp._anTimer); dsp._anTimer = null; }
  $('#adsp-notch-val').text(dsp.settings.notch_freq + ' Hz Q:' + dsp.settings.notch_q);
};

// ─── Presets ───
Plugins.audio_dsp._applyPreset = function (name) {
  var dsp = this;
  var presets = {
    ssb:   { hp_on: true, hp_freq: 300, lp_on: true, lp_freq: 3000, notch_on: false, peak_on: true, peak_freq: 1800, peak_gain: 3, peak_q: 1.5, comp_on: true, comp_threshold: -30, comp_ratio: 6,
             eq_on: false, eq_g: [0,0,0,0,0,0,0,0,0,0], nb_on: false, bin_on: false, lms_on: false },
    am:    { hp_on: true, hp_freq: 100, lp_on: true, lp_freq: 5000, notch_on: false, peak_on: false, peak_gain: 0, comp_on: false,
             eq_on: true, eq_g: [2,3,2,0,-1,0,1,2,1,0], nb_on: false, bin_on: false, lms_on: false },
    cw:    { hp_on: true, hp_freq: 600, lp_on: true, lp_freq: 1000, notch_on: false, peak_on: true, peak_freq: 800, peak_gain: 6, peak_q: 5, comp_on: false,
             eq_on: false, eq_g: [0,0,0,0,0,0,0,0,0,0], nb_on: false, bin_on: false, lms_on: true },
    reset: Object.assign({}, dsp.defaults)
  };
  var p = presets[name]; if (!p) return;
  Object.assign(dsp.settings, p);

  var isOn = (name !== 'reset');
  dsp.enabled = isOn;
  $('#adsp-master').prop('checked', isOn);
  $('#adsp-status').text(isOn ? 'active' : 'bypass');
  $('#audio-dsp-icon').toggleClass('adsp-active', isOn);

  $('#adsp-hp-on').prop('checked', !!p.hp_on);
  $('#adsp-hp-freq').val(dsp.settings.hp_freq).trigger('input');
  $('#adsp-lp-on').prop('checked', !!p.lp_on);
  $('#adsp-lp-freq').val(dsp.settings.lp_freq).trigger('input');
  $('#adsp-notch-on').prop('checked', !!p.notch_on);
  $('#adsp-notch-freq').val(dsp.settings.notch_freq).trigger('input');
  $('#adsp-peak-on').prop('checked', !!p.peak_on);
  $('#adsp-peak-freq').val(dsp.settings.peak_freq).trigger('input');
  $('#adsp-peak-gain').val(dsp.settings.peak_gain).trigger('input');
  if (p.peak_q) { dsp.settings.peak_q = p.peak_q; $('#adsp-peak-q').val(p.peak_q); }
  $('#adsp-nr-on').prop('checked', !!dsp.settings.nr_on);
  $('#adsp-nr-strength').val(dsp.settings.nr_strength).trigger('input');
  $('#adsp-comp-on').prop('checked', !!p.comp_on);
  $('#adsp-comp-threshold').val(dsp.settings.comp_threshold).trigger('input');
  $('#adsp-comp-ratio').val(dsp.settings.comp_ratio).trigger('input');
  // Reset disattiva anche l'auto-notch
  if (name === 'reset' && dsp.settings.notch_auto) {
    dsp.settings.notch_auto = false;
    $('#adsp-notch-auto').prop('checked', false);
    dsp._stopAutoNotch();
  }

  if (dsp.filters.hp) dsp.filters.hp.frequency.value = dsp.settings.hp_freq;
  if (dsp.filters.lp) dsp.filters.lp.frequency.value = dsp.settings.lp_freq;
  if (dsp.filters.notch) { dsp.filters.notch.frequency.value = dsp.settings.notch_freq; dsp.filters.notch.Q.value = dsp.settings.notch_q; }
  if (dsp.filters.peak) { dsp.filters.peak.frequency.value = dsp.settings.peak_freq; dsp.filters.peak.gain.value = dsp.settings.peak_gain; dsp.filters.peak.Q.value = dsp.settings.peak_q; }
  if (dsp.filters.comp) { dsp.filters.comp.threshold.value = dsp.settings.comp_threshold; dsp.filters.comp.ratio.value = dsp.settings.comp_ratio; }

  // Sync EQ + FX controls and nodes (presets now cover the whole chain)
  $('#adsp-eq-on').prop('checked', !!dsp.settings.eq_on);
  for (var _i = 0; _i < 10; _i++) $('#adsp-eq-' + _i).val((dsp.settings.eq_g && dsp.settings.eq_g[_i]) || 0);
  $('#adsp-nb-on').prop('checked', !!dsp.settings.nb_on);
  $('#adsp-bin-on').prop('checked', !!dsp.settings.bin_on);
  $('#adsp-lms-on').prop('checked', !!dsp.settings.lms_on);
  dsp._syncNodes();
  dsp._updateStageLEDs();

  dsp._reconnect();
};

// ─── Draggable ───
Plugins.audio_dsp._makeDraggable = function () {
  var el = document.getElementById('audio-dsp-window');
  var handle = document.getElementById('audio-dsp-titlebar');
  if (!el || !handle) return;
  var dx = 0, dy = 0, mx = 0, my = 0;
  handle.addEventListener('mousedown', function (e) {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    mx = e.clientX; my = e.clientY;
    // Neutralize centering transform on first drag
    if (el.style.transform) {
      var r = el.getBoundingClientRect();
      el.style.transform = 'none';
      el.style.left = r.left + 'px';
      el.style.top = r.top + 'px';
      el.style.bottom = 'auto';
    }
    document.onmousemove = function (e) {
      dx = mx - e.clientX; dy = my - e.clientY;
      mx = e.clientX; my = e.clientY;
      el.style.top = (el.offsetTop - dy) + 'px';
      el.style.left = (el.offsetLeft - dx) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };
    document.onmouseup = function () { document.onmousemove = null; document.onmouseup = null; };
  });
};

// ═══════════════════════════════════════════════════════════════════
//  EA7CL: NR con red neuronal (RNNoise, Jitsi rnnoise-wasm 0.2.1)
//  - rnnoise.wasm se carga de la carpeta del complemento (112 KB)
//  - trabaja a 48 kHz en tramas de 480; si el audio va a otra frecuencia
//    (44,1 / 96 kHz) se re-muestrea dentro del procesador
//  - v2 "plantilla": la salida de la IA decide, por frecuencias y suavizado,
//    cuánto del sonido original pasa (sin golpes de ruido, voz natural)
//  - Level (nr_strength): cuánto baja el ruido como máximo:
//    0 % = -6 dB, 50 % = -18 dB, 100 % = -30 dB
//  - Solo en modos de voz: en CW y digitales se queda en el NR normal
// ═══════════════════════════════════════════════════════════════════
Plugins.audio_dsp._rnnWasmUrl = 'static/plugins/receiver/audio_dsp/rnnoise.wasm';

// ¿Está la IA trabajando ahora mismo? (pedida, cargada y en modo de voz)
Plugins.audio_dsp._aiActivo = function () {
  var dsp = this;
  if (!dsp.settings.nr_on || !dsp.settings.nr_ai || !dsp.rnnReady || !dsp.filters.rnn) return false;
  return dsp._modoVoz();
};

Plugins.audio_dsp._modoVoz = function () {
  try {
    var dm = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator();
    if (!dm) return true;
    var sec = ''; try { sec = dm.get_secondary_demod() || ''; } catch (e) {}
    if (sec) return false;                                   // decodificador digital
    var m = dm.get_modulation();
    // CW, digitales y emisoras de música (WFM, DAB, DRM) se quedan sin IA
    return ['cw', 'wfm', 'bcfm', 'dab', 'drm', 'bpsk31', 'bpsk63', 'rtty', 'packet', 'ft8'].indexOf(m) < 0;
  } catch (e) { return true; }
};

Plugins.audio_dsp._syncAI = function () {
  var dsp = this, s = dsp.settings;
  var $b = $('#adsp-nr-ai');
  $b.toggleClass('adsp-ai-on', !!s.nr_ai);
  $b.toggleClass('adsp-ai-off', !!dsp._rnnFallo);
  if (dsp._rnnFallo) $b.attr('title', 'Red neuronal no disponible en este navegador');
  $('#adsp-nr-learn').toggleClass('adsp-ai-hide', !!s.nr_ai);   // LEARN no hace falta con IA
  $('#adsp-nr-vad').toggleClass('on', !!s.nr_ai && !!s.nr_on);
  $('#adsp-nr-on').prop('checked', !!s.nr_on);
};

// Vigila el modo: al pasar a CW/digital (o volver a voz) recompone la cadena
Plugins.audio_dsp._rnnModeWatch = function () {
  var dsp = this;
  if (dsp._rnnModeT) return;
  dsp._rnnUltimo = null;
  dsp._rnnModeT = setInterval(function () {
    if (!dsp.hooked || !dsp.settings.nr_ai) { dsp._rnnUltimo = null; return; }
    var a = dsp._aiActivo();
    if (a !== dsp._rnnUltimo) {
      var cambia = dsp._rnnUltimo !== null;
      dsp._rnnUltimo = a;
      if (cambia) { dsp._sendNRParams(); dsp._reconnect(); }
    }
  }, 1000);
};

Plugins.audio_dsp._rnnBuild = function (ctx) {
  var dsp = this;
  dsp.rnnReady = false;
  dsp.filters.rnn = null;
  if (!window.WebAssembly || !ctx.audioWorklet) { dsp._rnnFallo = true; dsp._syncAI(); return; }
  // El módulo wasm se compila una sola vez y se reutiliza si cambia el AudioContext
  if (!dsp._rnnModP) {
    dsp._rnnModP = fetch(dsp._rnnWasmUrl).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (b) { return WebAssembly.compile(b); });
    dsp._rnnModP.catch(function () { dsp._rnnModP = null; });   // reintentar en el próximo contexto
  }
  var src = String.raw`
class EA7RNN extends AudioWorkletProcessor {
  constructor(opt){
    super();
    var o=opt.processorOptions||{};
    var self=this, mem=null;
    var inst=new WebAssembly.Instance(o.module,{a:{
      a:function(){return 0;},
      b:function(d,s,n){var u=new Uint8Array(mem.buffer);u.copyWithin(d,s,s+n);}
    }});
    var x=inst.exports; mem=x.c;
    x.d();                                  // constructores
    this.x=x; this.st=x.f(0);               // rnnoise_create(NULL)
    this.pIn=x.g(480*4); this.pOut=x.g(480*4);
    this.mem=mem;
    this.sr=sampleRate;
    // re-muestreo (Catmull-Rom): entrada sr->48k y salida 48k->sr
    this.stA=this.sr/48000; this.tA=0; this.hA=new Float32Array(4);
    this.stB=48000/this.sr; this.tB=0; this.hB=new Float32Array(4);
    this.fr=new Float32Array(480); this.nf=0;
    // sonido original retrasado 480 muestras (retardo propio de RNNoise), alineado con la IA
    this.dry=new Float32Array(480); this.dw=0;
    this.out=new Float32Array(16384); this.oR=0; this.oW=0; this.prim=false;
    this.mix=(o.mix!==undefined)?o.mix:0.5; this.vadAcc=0; this.vadN=0;
    // v2 "plantilla": la IA no se oye directamente; su salida dice, frecuencia a
    // frecuencia, cuánto del sonido original dejar pasar. Esa plantilla se suaviza
    // (sube rápido, baja despacio) para que no haya golpes de ruido.
    var N=1024; this.N=N; this.H=256;
    this.win=new Float32Array(N);
    for(var i=0;i<N;i++) this.win[i]=Math.sqrt(0.5-0.5*Math.cos(2*Math.PI*i/N));
    this.bD=new Float32Array(N); this.bW=new Float32Array(N); this.nh=0;
    this.rD=new Float32Array(N); this.iD=new Float32Array(N);
    this.rW=new Float32Array(N); this.iW=new Float32Array(N);
    this.ola=new Float32Array(N);
    this.M=new Float32Array(N/2+1); this.G=new Float32Array(N/2+1); this.G.fill(1);
    this.br=new Uint16Array(N);
    for(i=0;i<N;i++){var r=0,v=i;for(var b=0;b<10;b++){r=(r<<1)|(v&1);v>>=1;}this.br[i]=r;}
    this.port.onmessage=function(e){var d=e.data;
      if(d.mix!==undefined)self.mix=d.mix;
    };
  }
  cr(h,t){ // Catmull-Rom entre h[1] y h[2]
    var a=h[0],b=h[1],c=h[2],d=h[3];
    return b+0.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
  }
  fft(re,im,inv){
    var N=this.N,br=this.br,i,j,t;
    for(i=0;i<N;i++){j=br[i];if(j>i){t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
    for(var len=2;len<=N;len<<=1){
      var ang=(inv?2:-2)*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang), h=len>>1;
      for(i=0;i<N;i+=len){
        var cr=1,ci=0;
        for(j=0;j<h;j++){
          var a=i+j,b=a+h;
          var tr=re[b]*cr-im[b]*ci, ti=re[b]*ci+im[b]*cr;
          re[b]=re[a]-tr; im[b]=im[a]-ti; re[a]+=tr; im[a]+=ti;
          var nc=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=nc;
        }
      }
    }
    if(inv){for(i=0;i<N;i++){re[i]/=N;im[i]/=N;}}
  }
  hop(){
    var N=this.N,H=this.H,K=N>>1,w=this.win,i,k;
    var rD=this.rD,iD=this.iD,rW=this.rW,iW=this.iW,M=this.M,G=this.G;
    for(i=0;i<N;i++){rD[i]=this.bD[i]*w[i];iD[i]=0;rW[i]=this.bW[i]*w[i];iW[i]=0;}
    this.fft(rD,iD,false); this.fft(rW,iW,false);
    for(k=0;k<=K;k++){
      var md=Math.sqrt(rD[k]*rD[k]+iD[k]*iD[k]), mw=Math.sqrt(rW[k]*rW[k]+iW[k]*iW[k]);
      var m=mw/(md+1e-9); M[k]=m>1?1:m;
    }
    // suelo: Level 0% -> -6 dB, 50% -> -18 dB, 100% -> -30 dB
    var suelo=Math.pow(10,(-6-this.mix*24)/20);
    for(k=0;k<=K;k++){
      var s=0,n=0;
      for(var q=k-2;q<=k+2;q++){ if(q>=0&&q<=K){s+=M[q];n++;} }   // suavizado en frecuencia
      s/=n;
      var g=G[k], a=s>g?0.3:0.9;                                 // sube rápido, baja despacio
      g=a*g+(1-a)*s; G[k]=g;
      var gg=g>suelo?g:suelo;
      rD[k]*=gg; iD[k]*=gg;
      if(k>0&&k<K){rD[N-k]*=gg; iD[N-k]*=gg;}
    }
    this.fft(rD,iD,true);
    var ola=this.ola, hB=this.hB;
    for(i=0;i<N;i++) ola[i]+=rD[i]*w[i]*0.5;                    // sqrt-Hann x2, solape 75% -> x0.5
    for(i=0;i<H;i++){
      hB[0]=hB[1]; hB[1]=hB[2]; hB[2]=hB[3]; hB[3]=ola[i];
      while(this.tB<1){ this.out[this.oW&16383]=this.cr(hB,this.tB); this.oW++; this.tB+=this.stB; }
      this.tB-=1;
    }
    ola.copyWithin(0,H); ola.fill(0,N-H);
    this.bD.copyWithin(0,H); this.bW.copyWithin(0,H);
  }
  frame(){
    var x=this.x, f32=new Float32Array(this.mem.buffer), i;
    var pi=this.pIn>>2, po=this.pOut>>2, fr=this.fr;
    for(i=0;i<480;i++) f32[pi+i]=fr[i]*32768;
    var vad=x.j(this.st,this.pOut,this.pIn);
    this.vadAcc+=vad; this.vadN++;
    if(this.vadN>=20){ this.port.postMessage({vad:this.vadAcc/this.vadN}); this.vadAcc=0; this.vadN=0; }
    f32=new Float32Array(this.mem.buffer);
    var dry=this.dry, N=this.N, H=this.H;
    for(i=0;i<480;i++){
      var dw=this.dw; var dv=dry[dw]; dry[dw]=fr[i]; this.dw=(dw+1)%480;
      var p=N-H+this.nh;
      this.bD[p]=dv; this.bW[p]=f32[po+i]/32768;
      if(++this.nh===H){ this.nh=0; this.hop(); }
    }
  }
  process(inputs,outputs){
    var inp=inputs[0]&&inputs[0][0];
    var out=outputs[0], M=out[0].length, i, ch;
    if(inp){
      var hA=this.hA;
      for(i=0;i<inp.length;i++){
        hA[0]=hA[1]; hA[1]=hA[2]; hA[2]=hA[3]; hA[3]=inp[i];
        while(this.tA<1){
          this.fr[this.nf++]=this.cr(hA,this.tA);
          if(this.nf===480){ this.frame(); this.nf=0; }
          this.tA+=this.stA;
        }
        this.tA-=1;
      }
    }
    var lvl=this.oW-this.oR;
    if(lvl>8192){ this.oR=this.oW-1024; lvl=1024; }      // no acumular retraso
    // colchón de una trama (~10 ms) para no cortar entre tramas
    var need=Math.ceil(480*this.sr/48000)+M;
    if(!this.prim && lvl>=need) this.prim=true;
    if(this.prim && lvl<M) this.prim=false;
    for(i=0;i<M;i++){
      var v=0;
      if(this.prim){ v=this.out[this.oR&16383]; this.oR++; }
      for(ch=0;ch<out.length;ch++) out[ch][i]=v;
    }
    return true;
  }
}
registerProcessor('ea7-rnnoise',EA7RNN);
`;
  var url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
  Promise.all([dsp._rnnModP, ctx.audioWorklet.addModule(url)]).then(function (r) {
    if (ctx !== dsp.ctx) return;                          // el contexto cambió mientras tanto
    var node = new AudioWorkletNode(ctx, 'ea7-rnnoise', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      processorOptions: { module: r[0], mix: dsp.settings.nr_strength / 100 }
    });
    node.port.onmessage = function (e) {
      if (e.data.vad === undefined) return;
      var $v = $('#adsp-nr-vad');
      if (!$v.children().length) $v.append('<i></i>');
      $v.children().css('width', Math.round(e.data.vad * 100) + '%');
      dsp._rnnVad = e.data.vad;
    };
    node.onprocessorerror = function () {
      console.warn('[audio_dsp] RNNoise: error en el procesador, vuelvo al NR normal.');
      dsp._rnnFallo = true; dsp.rnnReady = false; dsp._syncAI(); dsp._sendNRParams(); dsp._reconnect();
    };
    dsp.filters.rnn = node;
    dsp.rnnReady = true;
    dsp._rnnFallo = false;
    dsp._syncAI();
    dsp._sendNRParams();
    dsp._rnnModeWatch();
    if (dsp.settings.nr_ai) dsp._reconnect();
    console.log('[audio_dsp] RNNoise listo (SR=' + ctx.sampleRate + ').');
  }).catch(function (e) {
    console.warn('[audio_dsp] RNNoise no disponible:', e);
    dsp._rnnFallo = true;
    dsp._syncAI();
  });
};
