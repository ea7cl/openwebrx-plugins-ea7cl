# Historial de autozoom

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
