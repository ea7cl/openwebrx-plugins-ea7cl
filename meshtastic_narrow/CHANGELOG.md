# Cambios

## 1.1 — 4-nov-2026

- Decodificación en segundo plano, como AIS o VDL2: el mapa y los mensajes se llenan aunque nadie
  escuche. Frecuencia de servicio en el plan de bandas, el modo en los decodificadores de segundo
  plano y el receptor programado para volver solo al perfil de 869 MHz (`meshtastic_narrow_config.py`).
- Instalar encima de una versión anterior la actualiza; cada instalación deja un `restaurar.sh`.

## 1.0 — 4-nov-2026

- Modo *Meshtastic Narrow* (62,5 kHz, SF7-9) en OpenWebRX+ 1.2.128, junto al Meshtastic normal.
- Plugin web para abrir el panel de mensajes Meshtastic con ese modo.
- Memoria del servidor *Meshtastic SFNarrow* en 869,618 MHz.
- Instalador con copia previa y vuelta atrás automática si OpenWebRX no arranca; desinstalador.
