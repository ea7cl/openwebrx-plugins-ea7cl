/*
 * rig_zoom - plugin local de EA7CL para OpenWebRX+
 *
 * Reduce (o amplia) a escala el panel del equipo de rig_skin: todo se ve
 * igual, pero ocupa menos pantalla. No modifica rig_skin.
 *
 * ESCALA: 1 = tamano original, 0.85 = 85 %, 0.75 = 75 %...
 * Para cambiarla basta con editar el numero de la linea siguiente.
 */
Plugins.rig_zoom = Plugins.rig_zoom || {};
Plugins.rig_zoom._version = 0.1;
Plugins.rig_zoom.no_css = true;
Plugins.rig_zoom.ESCALA = 0.75;

Plugins.rig_zoom.init = function () {
	var escala = Number(this.ESCALA);
	if (!(escala >= 0.5 && escala <= 0.5)) escala = 1;
	var estilo = document.getElementById('ea7cl-rig-zoom-style');
	if (!estilo) {
		estilo = document.createElement('style');
		estilo.id = 'ea7cl-rig-zoom-style';
		document.head.appendChild(estilo);
	}
	estilo.textContent = 'body.theme-rig #openwebrx-panel-receiver{zoom:' + escala + '}';
	return true;
};
