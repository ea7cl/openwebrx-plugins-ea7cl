// Receiver plugins initialization.
// everything after '//' is a comment.

// uncomment the next line to enable plugin debugging in browser console.
// Plugins._enable_debug = true;

// base URL for receiver plugins
const rp_url = 'https://0xaf.github.io/openwebrxplus-plugins/receiver';

// First load the utils, needed for some plugins
Plugins.load('utils').then(async function () {
// await Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/utils/utils.js');
// load the rest of your plugins here


  // you can load a local plugins if you have one
  //Plugins.load('example');


//await Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/notify/notify.js');
//Plugins.load('notify');
//await Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/connect_notify/connect_notify.js');
//Plugins.load('connect_notify');


// Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/colorful_spectrum/colorful_spectrum.js');
Plugins.load('colorful_spectrum');

// Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/mouse_freq/mouse_freq.js');
//Plugins.load('mouse_freq');

// Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/screenshot/screenshot.js');
Plugins.load('screenshot');

Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/toggle_scannable/toggle_scannable.js');
Plugins.load('scan_recordado');   // EA7CL: recordar las marcas de scan de cada oyente
// Plugins.load('toggle_scannable');

// --- S-METER CONFIGURATION (init.js) ---
// Paste this into your init.js before Plugins.load('smeter')
// Paste this into your init.js before Plugins.load('smeter')
//window.smeter_config_global = {
//    calibration_offset_hf: 419,  // Calibration for HF (<30MHz) in dB
//    calibration_offset_vhf: 19, // Calibration for VHF/UHF (>30MHz) in dB
//    linearity_hf: 6.222222222222222,         // Linearity correction factor for HF
//    linearity_vhf: 2.142857142857143,        // Linearity correction factor for VHF
//    s0_offset_hf: -450,           // S0 offset for HF
//    s0_offset_vhf: -24,          // S0 offset for VHF
//    hide_original: true,      // Set to true to hide the original S-meter
//    show_text: true,           // Set to false to hide the text below the S-meter
//    show_dbm: false,           // Show dBm value next to bar
//    use_iaru_vhf: true,        // Set to true to use IARU VHF standard (S9 = -93dBm)
//    smeter_delay: 550          // Delay in ms to sync with audio
//};
// load remote
// Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/smeter/smeter.js');
// or local
// Plugins.load('smeter');

//Plugins.load('hora_local');

//Plugins.load('audio_filter');

//Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/compact_analog_modes/compact_analog_modes.js');
Plugins.load('compact_analog_modes');

window.rig_skin_config = {
    smeter: {
        offset_hf: 7,    // dB offset below 30 MHz
        offset_vhf: -50,   // dB offset above 30 MHz
        iaru_vhf: true     // S9 = -93 dBm above 30 MHz (IARU standard)
    }
};
//Plugins.load('https://aganet.github.io/openwebrxplus-rig-skin/receiver/rig_skin/rig_skin.js');
Plugins.load('rig_skin');
// Plugins.load('rig_zoom');
Plugins.load('rig_skin_es');
Plugins.load('perfil_recordado');
Plugins.load('rig_colores_ea7cl');
Plugins.load('rig_volumen_ea7cl');
Plugins.load('rig_fil_ea7cl');   // EA7CL: FIL y TS con desplegable
Plugins.load('rig_dx_spotter');
Plugins.load('profile_jump');


Plugins.load('smeter_led');

Plugins.load('audio_dsp');

Plugins.load('status_polish');

Plugins.load('controls_polish');

Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/doppler/doppler.js');
Plugins.load('doppler_autostart');


//Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/listeners/listeners.js');
//Plugins.listeners.setup({

    await Plugins.load('listeners');
    await Plugins.listeners.setup({
        supabaseUrl: 'https://rqqmkiaoykaohxegyheq.supabase.co',
        supabaseKey: 'sb_publishable_Asl5b4Sj7-XDrikwWJQT0Q_uEfIvTg-',
        receiverId: 'ea7cl-openwebrx',
        network: 'ea7cl-openwebrx'

    });
});


//NEXT_PUBLIC_SUPABASE_URL=https://rqqmkiaoykaohxegyheq.supabase.co
//NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Asl5b4Sj7-XDrikwWJQT0Q_uEfIvTg-


Plugins.load('anti_iframe');
Plugins.load('banderas_emoji');
Plugins.load('mi_ip');   // EA7CL: tarjeta con la IP del oyente en la cabecera (sustituye a wieistmeineip.de)
Plugins.load('contador');   // EA7CL: contador de visitas propio (sustituye a Flag Counter)
Plugins.load('smeter_bandas');
Plugins.load('meteo_letrero');
// EA7CL: tema Rig al entrar por primera vez (una sola vez por navegador; luego cada uno elige)
try { if (!localStorage.getItem('ea7_tema_rig')) { localStorage.setItem('ea7_tema_rig', '1'); localStorage.setItem('ui_theme', 'rig'); if (window.UI && UI.setTheme) UI.setTheme('rig'); } } catch (e) {}

//Plugins.load('autozoom');
Plugins.load('botones_ea7cl');
Plugins.load('meshtastic_narrow');   // EA7CL: panel de mensajes para el modo Meshtastic Narrow
Plugins.load('estereo_fm');   // EA7CL: FM y DAB en estéreo (owrx-estereo)
Plugins.load('scan_pausa_ea7cl');   // EA7CL: SCAN con pausa de 5 s

(function () { var m = null; try { m = window.frameElement; } catch (e) {} if (/[?&]dual(=|&|$)/.test(location.search) || (m && m.id === 'drx-sub')) Plugins.load('doble_receptor'); })();   // EA7CL: doble receptor MAIN/SUB, solo con ?dual
