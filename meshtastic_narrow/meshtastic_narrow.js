/*
 * meshtastic_narrow - plugin local de EA7CL para OpenWebRX+
 *
 * Acompaña al modo "Meshtastic Narrow" (62,5 kHz, SF7-9) que añade el instalador
 * en el servidor. OpenWebRX solo abre el panel de mensajes Meshtastic cuando el
 * modo se llama exactamente "meshtastic"; este plugin lo abre también con
 * "meshtastic-narrow". Los mensajes ya llegan a ese panel solos (van marcados
 * como Meshtastic) y los nodos con posición salen en el mapa como siempre.
 */
Plugins.meshtastic_narrow = Plugins.meshtastic_narrow || {};
Plugins.meshtastic_narrow._version = 1.0;
Plugins.meshtastic_narrow.no_css = true;

// modo del servidor y panel que le corresponde
Plugins.meshtastic_narrow.MODO = 'meshtastic-narrow';
Plugins.meshtastic_narrow.PANEL = 'openwebrx-panel-meshtastic-message';

Plugins.meshtastic_narrow.init = function () {
    var yo = Plugins.meshtastic_narrow;
    if (typeof DemodulatorPanel === 'undefined' || typeof toggle_panel !== 'function') {
        console.error('meshtastic_narrow: falta DemodulatorPanel o toggle_panel');
        return false;
    }
    var P = DemodulatorPanel.prototype;
    if (P.updatePanels._ea7_mn) return true; // ya puesto
    var original = P.updatePanels;
    P.updatePanels = function () {
        var r = original.apply(this, arguments);
        try {
            if (this.getDemodulator().get_secondary_demod() === yo.MODO) toggle_panel(yo.PANEL, true);
        } catch (e) { }
        return r;
    };
    P.updatePanels._ea7_mn = true;
    return true;
};
