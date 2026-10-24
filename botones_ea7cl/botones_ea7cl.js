/*
 * botones_ea7cl - plugin de receptor para OpenWebRX+ (EA7CL)
 *
 * Da el mismo aspecto, estilo LED de equipo de radio, a todos los botones de la
 * columna de plugins (AZ, DOP, LST y los que se añadan):
 * - todos del mismo ancho, con relieve suave y un piloto a la izquierda;
 * - apagado: piloto gris; encendido (AZ activado, o la ventana del plugin
 *   abierta): fondo verde, letras blancas y piloto verde brillante;
 * - se iluminan al pasar el ratón por encima.
 * El número de oyentes de LST va dentro del botón ("LST 6") en vez de en un
 * circulito que tapaba la T; sale verde si LST está conectado y rojo si hay error.
 *
 * No modifica los otros plugins: solo añade estilos, así que sigue funcionando
 * aunque esos plugins se actualicen.
 */

Plugins.botones_ea7cl.no_css = true;

Plugins.botones_ea7cl.init = function () {
    // "body" delante para ganar a los estilos del tema y de cada plugin
    var B = 'body #openwebrx-panel-plugins .openwebrx-plugin-button';
    var ON = B + '.botones-ea7cl-on,' + B + '[data-on="1"]';

    $('<style id="botones-ea7cl-style"></style>').text(
        B + '{position:relative;box-sizing:border-box;width:82px;margin:1px 0;padding:2px 6px 2px 18px !important;' +
            'white-space:nowrap;text-align:center;line-height:16px;height:auto;font-weight:bold !important;' +
            'letter-spacing:.6px;color:#c5ccd2 !important;text-shadow:0 1px 1px rgba(0,0,0,.8);' +
            'background:linear-gradient(#3a434c,#22282e) !important;border:1px solid #5d6873 !important;' +
            'border-radius:9px !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 1px 2px rgba(0,0,0,.6) !important;' +
            'transition:filter .15s,box-shadow .15s}' +
        B + ':hover{filter:brightness(1.25);border-color:#8fa0ae !important}' +
        // piloto LED
        B + '::before{content:"";position:absolute;left:6px;top:50%;width:7px;height:7px;margin-top:-3.5px;' +
            'border-radius:50%;background:#4a535b;box-shadow:inset 0 1px 1px rgba(0,0,0,.7)}' +
        // encendido
        ON + '{color:#fff !important;background:linear-gradient(#24804a,#145a30) !important;border-color:#6ff08f !important;' +
            'box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 8px rgba(111,240,143,.55) !important}' +
        ON.replace(/,/g, '::before,') + '::before{background:#8dff9f;box-shadow:0 0 6px 2px rgba(111,240,143,.9)}' +
        // LST: el número dentro del botón, sin circulito
        'body #plugin-button-listeners::after{content:attr(data-count) !important;position:static !important;' +
            'display:inline !important;margin-left:4px;padding:0 !important;border:0 !important;' +
            'background:none !important;min-width:0 !important;height:auto !important;' +
            'font:normal .85em sans-serif !important;color:inherit !important}' +
        'body #plugin-button-listeners[data-status="live"]::after{color:#6ff08f !important}' +
        'body #plugin-button-listeners.botones-ea7cl-on[data-status="live"]::after{color:#fff !important}' +
        'body #plugin-button-listeners[data-status="error"]::after{color:#ff6b6b !important}'
    ).appendTo('head');

    // marcar como encendido el botón cuya ventana está abierta
    setInterval(function () {
        $('#openwebrx-panel-plugins .openwebrx-plugin-button').each(function () {
            var w = document.getElementById(this.id.replace(/^plugin-button-/, 'plugin-window-'));
            $(this).toggleClass('botones-ea7cl-on', !!(w && w.offsetParent !== null));
        });
    }, 500);

    return true;
};
