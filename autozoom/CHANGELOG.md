# Historial de autozoom

## v1.5 — 24-oct-2026
- Botón más visible: el porcentaje va dentro del botón («AZ 25%») en vez de un circulito que tapaba la Z.
- Desactivado: gris sobre fondo oscuro con borde. Activado: blanco sobre verde intenso.

## v1.4 — 24-oct-2026
- El zoom ya no depende de las bandas ni de la cinta: la frecuencia queda en el centro y el
  porcentaje se aplica sobre el perfil (5 % = 1/2, 10 % = 1/4, 25 % normal = 1/8, 50 % = 1/16).
- Funciona igual en todos los perfiles, también en los que solo cogen un trozo de banda o
  no tienen banda en la cinta (p. ej. 137,5–140 MHz).

## v1.3 — 24-oct-2026
- Un clic en el waterfall, la escala o un marcador visible sintoniza a la primera, sin abrir
  antes el rango completo; el zoom se recentra a los 3 s.
- Solo la rueda del ratón abre el rango completo.

## v1.2 — 24-oct-2026
- Escala nueva: 5 % = la banda entera; 10, 25 y 50 % = el doble de zoom cada vez,
  con la frecuencia en el centro aunque la vista se salga de la banda.
- Arreglo: en perfiles donde la banda cabe entera (p. ej. 🟡 80m), todas las opciones daban la misma vista.
- La simulación compara las cuatro opciones e incluye los perfiles de 80 m.

## v1.1 — 24-oct-2026
- El porcentaje del menú ahora indica **cuánto zoom**: 5 % (mínimo) … 50 % (máximo).
  Normal = 25 %, que da la misma vista que el normal de la v1.0.
- La preferencia se guarda como `autozoom_zoom` (la antigua `autozoom_pct` significaba lo contrario).

## v1.0 — 24-oct-2026 (versión base)
- Botón AZ junto a LST: clic activa/desactiva; **desactivado por defecto**; cada navegador lo recuerda.
- Clic derecho en AZ: menú de % del perfil a la vista (5, 10 normal, 25, 50).
- Espera de 3 s.
- Menos zoom por defecto: 10 % del perfil (antes ~200–250 kHz fijos).
- AZ arriba de la columna para no tapar LST ni quedar bajo la barra CPU.

## Versiones previas (23-oct-2026, sin botón, siempre activas)
- Arreglo: perfiles donde la banda ocupa casi todo el perfil (128–138 MHz) no hacían zoom;
  ajuste cerca del límite de banda con el ancho real del nivel de zoom.
- Re-zoom: tras tocar el waterfall, vuelve el zoom aunque no se elija frecuencia.
- Zoom de ancho fijo (200 kHz) cuando la banda es más ancha que el perfil.
- Primera versión: zoom a la banda 5 s después de sintonizar; bandas de la cinta del servidor.
