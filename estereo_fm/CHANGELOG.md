# estereo_fm (owrx-estereo) · cambios

## 1.2 · 2026-11-13
- Compresor ADPCM propio, sin hilos: el `AdpcmEncoder` de pycsdr a veces se quedaba esperando
  para siempre y paraba toda la cadena de FM (el audio "empezaba y se cortaba").
- La caja ESTÉREO/MONO y L/R va siempre en MODOS (también con los modos en botones); ya no
  flota encima del volumen.
- Reserva de ~0,3 s en la reproducción estéreo (el DAB llega a golpes).
- El script usa Python aislado (`-I`): no le afecta un `http.py` suelto en la carpeta actual.

## 1.1 · 2026-11-13
- Un ADPCM por canal en un mensaje aparte (tipo 5): quita la "fritura" (34-36 dB en vez de 19-21).
- Sin comprimir (PCM) si OpenWebRX tiene `audio_compression: none`.
- Botón ESTÉREO/MONO para escuchar en mono a voluntad.

## 1.0 · 2026-11-13
- FM comercial en estéreo real (piloto de 19 kHz, L−R a 38 kHz; separación 119 dB) y DAB+ en
  estéreo (sin la mezcla a mono). Medidores L/R. Reaplicado automático tras actualizar con apt.
