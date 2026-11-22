/*
 * arreglo_modo_digital 0.1 (EA7CL)
 * Al cambiar a un perfil cuya modulación inicial es digital (FT8, ADS-B, AIS...),
 * OpenWebRX+ a veces pide ese modo digital como modo base (p. ej. FT8 sobre "ft8")
 * y el servidor lo rechaza ("unsupported demodulator"). Aquí se descarta un modo base
 * que no corresponde a ese modo digital y se usa el correcto (USB, NFM...).
 */
(function () {
    'use strict';
    var VERSION = '0.1';
    if (window.Plugins) { Plugins.arreglo_modo_digital = Plugins.arreglo_modo_digital || {}; Plugins.arreglo_modo_digital._version = VERSION; }
    var intentos = 0;
    (function instalar() {
        if (typeof DemodulatorPanel === 'undefined' || !DemodulatorPanel.prototype.setMode) {
            if (++intentos < 100) setTimeout(instalar, 200);
            return;
        }
        var orig = DemodulatorPanel.prototype.setMode;
        if (orig._ea7cl) return;
        var nuevo = function (req, und) {
            try {
                var mode = Modes.findByModulation(req);
                if (mode && mode.type === 'digimode' && und && mode.underlying.indexOf(und) < 0) und = undefined;
            } catch (e) {}
            return orig.call(this, req, und);
        };
        nuevo._ea7cl = true;
        DemodulatorPanel.prototype.setMode = nuevo;
    })();
})();
