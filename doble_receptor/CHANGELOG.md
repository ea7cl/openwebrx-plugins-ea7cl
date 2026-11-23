# Historial de doble_receptor

## v2.1.19 — 23-nov-2026
- Las ventanas del MAIN (LST, DX, SAT, MEM...) ya no se quedan pegadas al ratón. El SUB es una página dentro de un marco: si al mover o agrandar una ventana se soltaba el botón encima del SUB, el MAIN no se enteraba, y la ventana seguía moviéndose o creciendo sola (LST se ponía muy ancha) hasta el siguiente clic. Ahora, mientras el botón está pulsado en el MAIN, el SUB no recibe el ratón. Instalada en el servidor el 23-11-2026.

## v2.1.18 — 20-nov-2026
- Flechas ◀ ▶ de la cascada (Tune down / Tune up) también en el MAIN. La caja de la escala del MAIN se recortaba con `overflow: hidden` y las tapaba. Ahora se recorta solo a los lados (`overflow-x: clip`), así que con zoom la cinta sigue sin meterse en el SUB. Instalada en el servidor el 20-11-2026.

## v2.1.17 — 20-nov-2026
- Primera versión en el repositorio, instalada en el servidor `openwebrx` en modo enlace.
- Instalador con tres modos (`enlace`, `todos` y `apagado`) que solo cambian la línea de `init.js`. `deshacer` vuelve byte a byte desde cualquiera de ellos.
- El instalador funciona desde este repositorio (`scripts/`) y desde una carpeta suelta con los archivos al lado.
- Dos instalaciones en el mismo segundo ya no escriben una copia de seguridad encima de la otra.
- Historia de la 2.1: hecha desde cero el 16-11-2026, con el SUB como página completa dentro de un marco. Hasta la 2.1.17 se añadieron el receptor marcado, la guarda antirrobot, la ventana Audio DSP del SUB a pantalla completa, el panel más estrecho y la quita del RIT en DUAL.
