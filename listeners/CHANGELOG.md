# Cambios — listeners (LST) versión EA7CL

## v1.3 — 25-oct-2026
- Frecuencias siempre en MHz con precisión de 10 Hz (432.27525 MHz, 10489.54000 MHz, 7.17700 MHz).
  Los dos últimos dígitos (centenas y decenas de Hz) van más pequeños y en un azul más apagado.

## v1.2 — 24-oct-2026
- Frecuencias con dos decimales (430.95 MHz, 7177.00 kHz) en vez de cuatro, más pequeños y en un
  azul más apagado que la parte entera. Solo se dejan más decimales
  cuando hacen falta para no perder la frecuencia (145.6125 MHz).

## v1.1 — 24-oct-2026
- La ventana ya no muestra primero una frecuencia equivocada al cambiar de sintonía:
  solo se publica cuando la frecuencia lleva 1,5 s quieta (`ESPERA_ESTABLE_MS`).

## v1.0 — oct-2026 (lo que había en el servidor, guardado tal cual)
- Interfaz en español (Oyentes, Receptor, Perfil, Sintonizar aquí…).
- País y localidad aproximada de cada oyente, con su bandera; «?» si no se conoce el país.
- Cada modo con su color, como en el DX cluster.
- Botón con el número de oyentes en verde; ventana con ancho mínimo y siempre dentro de la pantalla.

## Original
- Plugin de 0xAF (LZ2SLL), licencia MIT, `_version = 0.1`.
