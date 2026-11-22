# Historial de rig_fil_ea7cl

## v0.1 — 16-nov-2026
- Letreros FIL y TS del panel rig como botones con desplegable; restaurar filtro de fábrica; el segundo clic cierra.
- FIL y TS más juntos y cifra roja más pequeña.
- Instalado en el servidor `openwebrx`, con instalador y desinstalador.

## v0.2 — 20-nov-2026
- Ya no se apaga con el doble receptor 2.x, que no trae desplegable propio: FIL y TS funcionan en la pantalla normal, en el MAIN y en el SUB.

## v0.3 — 21-nov-2026
- Banda aérea (118-137 MHz) en AM: ancho normal ±4 kHz (canales de 8,33 kHz).

## v0.4 — 22-nov-2026
- FIL con **anchos fijos** por modo, como la tecla FIL/WIDTH de un transceptor: USB/LSB 1,8-4 kHz
  (se queda quieto el corte bajo), CW 100-1200 Hz (centrado), AM/SAM 3-12 kHz, NFM 6-20 kHz.
  Se guardan por modo, igual que al arrastrar el filtro.
- Letrero **BAJO** (corte bajo del filtro, solo en LSB/USB) en el sitio de TS: 50…1000 Hz en pasos de 50,
  subir/bajar 50 Hz y «Estándar SSB (300 Hz)». Al cambiarlo, el filtro conserva el ancho.
- El letrero **TS** ya no sale (el panel ya tiene la tecla TS), ni en la pantalla normal ni en el doble receptor.
- Al cargar la página ya no se pisa el filtro que OpenWebRX recuerda para el modo.
- El desplegable se abre hacia arriba si por debajo no cabe (panel abajo en el doble receptor).
- Instalado en el servidor `openwebrx` el 22-nov-2026, idéntico al de este repositorio (SHA-256).
