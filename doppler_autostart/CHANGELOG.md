# Historial de doppler_autostart

## v0.6 — 20-nov-2026
- Al elegir un satélite se quita el silenciador (SQ al mínimo) y se mantiene abierto mientras dura el seguimiento. Al parar (STOP, otra frecuencia o cambio de perfil), el SQ vuelve a funcionar con normalidad. Solo afecta a la escucha de satélites.
- Instalado en el servidor `openwebrx`, con copia de la 0.5 en `/var/backups/doppler-autostart/`.

## v0.5 — 20-nov-2026
- La pantalla de pases del panel de control (tecla SAT de abajo) también arranca el Doppler. rig_skin sintonizaba, pero no avisaba al Doppler.
- Instalado en el servidor `openwebrx`, con copia de la 0.1 en `/var/backups/doppler-autostart/`.

## v0.4 — 19-nov-2026
- Elegir un satélite en la lista de DOP lo sintoniza (con la frecuencia y el modo de la lista de SAT de rig_skin) y arranca el seguimiento. Antes solo apuntaba el número y el nombre.
- Con el doble receptor, actúa sobre el receptor marcado.

## v0.3 — 19-nov-2026
- TRACK ya no se queda enganchado: nunca hay dos seguimientos a la vez.
- El nombre y el número (Sat ID) se ven desde el primer momento.
- Con el doble receptor, la ventana DOP enseña y maneja el Doppler del receptor marcado.

## v0.2 — 19-nov-2026
- Arranca cuando el receptor ya ha llegado a la frecuencia del satélite.
- Se para solo al sintonizar otra cosa o al cambiar de perfil.
- Botón DOP encendido mientras hay seguimiento.
- Mensajes en español; nombre de SAT y de CelesTrak.

## v0.1 — 18-nov-2026
- Arranca el plugin doppler al elegir un satélite en la ventana SAT de rig_skin. La hizo ChatGPT, junto con `patch.py` y `reapply.sh`.
