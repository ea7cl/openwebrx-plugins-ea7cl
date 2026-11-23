# Cambios — listeners (LST) versión EA7CL

## v1.6 — 23-nov-2026
- La ventana mide la pantalla real para quedarse dentro de ella. Con el doble receptor (DUAL), el MAIN cree que la pantalla es solo su mitad, y la ventana saltaba sola a esa mitad si se ponía encima del SUB.
- Instalada en el servidor `openwebrx` el 23-11-2026 (copia de la v1.5 en `/home/ea7cl/listeners.bak-2026-11-23-1655`).

## v1.5 — 1-nov-2026
- Los nombres de perfil y de receptor salen siempre en español, aunque algún oyente tenga el
  traductor del navegador. Antes, si el primer oyente de un perfil lo tenía activo, la cabecera de
  ese perfil salía traducida para todos. Ahora los nombres de este receptor se toman de la propia
  página y no de lo que envía cada oyente. Además, el desplegable de perfiles y el título se marcan
  para que el traductor no los cambie.
- Al pulsar una fila de otro perfil se queda en la frecuencia y el modo de la fila. Antes podía
  quedarse en la frecuencia por defecto del perfil: OpenWebRX+ la vuelve a poner con cada
  configuración que manda el servidor, a veces dos veces y con retraso. Ahora se espera a que el
  perfil esté cargado y se vigila durante 15 s (`ESPERA_SINTONIA_MS`), corrigiéndola si se mueve.
- Mientras tanto no se publica nada, para que los demás no vean ni carguen la frecuencia de paso.
- Recoge el reintento de sintonía del 30-oct, que estaba instalado pero no guardado aquí.

## v1.4 — 25-oct-2026
- Los dos últimos dígitos de la frecuencia se distinguen mejor: más pequeños (72 %) y en gris
  en vez de azul apagado, que apenas se notaba.

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
