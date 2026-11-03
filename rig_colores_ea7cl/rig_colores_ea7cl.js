/*
 * rig_colores_ea7cl - plugin local de EA7CL para OpenWebRX+
 *
 * Guarda los colores y tamanos de letra personalizados del aspecto rig_skin.
 * Va aparte de rig_skin, asi que las actualizaciones de rig_skin no lo borran.
 * Para cambiar un color, edita el valor (#rrggbb) en la lista de abajo y
 * recarga la pagina con Ctrl+F5.
 */
Plugins.rig_colores_ea7cl = Plugins.rig_colores_ea7cl || {};
Plugins.rig_colores_ea7cl._version = 0.3;
Plugins.rig_colores_ea7cl.no_css = true;

Plugins.rig_colores_ea7cl.CSS = [
	// color principal del tema (antes #171b1f)
	'html body.theme-rig { --theme-color2: #9202ff; }',
	// texto general de los paneles (chat/registro, estado, equipo) y dialogos (antes var(--rig-legend))
	'html body.theme-rig .openwebrx-panel, html body.theme-rig .openwebrx-dialog { color: #30e700; }',
	// frecuencia del VFO activo (antes #ffffff)
	'html .owrx-rig-vfo-box.active .owrx-rig-vfo-freq { color: #00e0ff; }',
	// indicadores FIL (filtro) y TS (paso de sintonia) (antes var(--rig-lcd-dim))
	'html .owrx-rig-info-filter, html .owrx-rig-info-step { color: #ffd500; }',
	// linea extra del panel (antes var(--rig-lcd-dim), 9pt)
	'html body.theme-rig #owrx-rig-extra { color: #52ff00; font-size: 8pt; }',
	// frecuencia bajo el raton (antes var(--rig-lcd-dim), 8pt)
	'html body.theme-rig #owrx-rig-info .webrx-mouse-freq { color: #ff0000; font-size: 15pt; }',
	// iconos/botones de la parte superior (antes #b6bec6)
	'html body.theme-rig .openwebrx-main-buttons { color: #20e301; }'
].join('\n');

Plugins.rig_colores_ea7cl.init = function () {
	var id = 'rig-colores-ea7cl-style';
	var viejo = document.getElementById(id);
	if (viejo) viejo.parentNode.removeChild(viejo);
	var estilo = document.createElement('style');
	estilo.id = id;
	estilo.textContent = this.CSS;
	// al final del <head>, despues de la hoja de rig_skin
	document.head.appendChild(estilo);
	return true;
};
