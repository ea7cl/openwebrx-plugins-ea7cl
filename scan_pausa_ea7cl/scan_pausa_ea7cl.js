/*
 * scan_pausa_ea7cl - plugin de receptor para OpenWebRX+ (EA7CL)
 *
 * El SCAN de OpenWebRX se queda en una memoria mientras tenga señal, aunque
 * sea mucho tiempo. Con este plugin se queda como mucho PAUSA milisegundos
 * (5 s) y sigue con la siguiente memoria que tenga señal. Si no hay otra con
 * señal, sigue escuchando la misma y vuelve a mirar pasados otros 5 s.
 * Si la señal se va antes, sigue enseguida, igual que el original.
 *
 * Solo cambia Scanner.prototype.scan (lib/Scanner.js); lo demás (cómo mide
 * cada memoria, el umbral del SQL, arrancar y parar) es el original.
 * El SUB del doble receptor usa la misma pausa si este plugin está cargado.
 */

Plugins.scan_pausa_ea7cl.no_css = true;
Plugins.scan_pausa_ea7cl._version = 0.1;

// tiempo máximo escuchando una memoria con señal, en milisegundos
Plugins.scan_pausa_ea7cl.PAUSA = 5000;

Plugins.scan_pausa_ea7cl.init = function () {
    if (typeof Scanner === 'undefined' || !Scanner.prototype) {
        console.error('scan_pausa_ea7cl: no encuentro el escáner de OpenWebRX (Scanner.js).');
        return false;
    }
    var me = this;

    Scanner.prototype.scan = function () {
        // sin escanear o sin memorias: nada (como el original)
        if (!this.timer || !this.bookmarks || !this.bookmarks.length) return;

        // umbral del deslizador SQL (igual que el original)
        var $slider = $('#openwebrx-panel-receiver .openwebrx-squelch-slider');
        this.threshold = $slider.val() - 13.0;

        var n = this.bookmarks.length;
        var ahora = Date.now();
        var desde = 0;
        var anterior = -1;

        if (this.current >= 0) {
            var conSenal = this.bookmarks[this.current].level > this.threshold;
            // con señal y sin agotar la pausa: seguir escuchando
            if (conSenal && ahora - (this._tParada || 0) < me.PAUSA) return;
            // pausa agotada o señal perdida: buscar desde la siguiente memoria
            anterior = this.current;
            desde = (this.current + 1) % n;
            this.current = -1;
        }

        var cur = desde;
        for (var j = 0; j < n; ++j) {
            var b = this.bookmarks[cur];
            if (b.level > this.threshold) {
                // la única con señal es la que ya se escucha: quedarse sin volver
                // a sintonizar (no se toca el filtro) y mirar otra vez en 5 s
                if (cur === anterior) {
                    this.current = cur;
                    this._tParada = ahora;
                    return;
                }
                if (UI.tuneBookmark(b)) {
                    this.current = cur;
                    this._tParada = ahora;
                    return;
                }
            }
            cur = (cur + 1) % n;
        }
    };

    return true;
};
