# estereo_fm (owrx-estereo) · cambios
## 2.2 · 2026-11-25
- La caja ESTÉREO/MONO con la barra L/R se ve siempre en BCFM, DAB y DRM; si no llega audio dice
  **SIN AUDIO** (antes solo aparecía con audio y parecía que faltaba).
- Arreglo de un fallo de OpenWebRX 1.2.130 al detectar Dream 2.2 (deja de leer su ayuda antes de
  ver `--status-socket`): el panel de estado DRM (IO/Time/Frame/FAC/SDC/MSC) no se coloreaba.
- Instalado en la Pi y en el Ubuntu.

## 2.1 · 2026-11-25
- **DRM en estéreo** (modo nativo, 1.2.130+): `drm.py` deja de mezclar a mono el estéreo de Dream.
- Arregla también el fallo de la 1.2.131 en DRM (salida de Dream declarada como un canal).
- Barra L/R y botón ESTÉREO/MONO también en modo DRM. Prueba sin emisora: `prueba_drm.py`.
- Copia de seguridad archivo a archivo (también de `drm.py` en instalaciones que ya tenían la 2.0).

## 2.0 · 2026-11-13
- Modo nativo para OpenWebRX+ 1.2.130 o posterior (el script lo elige solo):
  - FM estéreo con el modo **BCFM** que ya trae OpenWebRX (en WFM sigue en mono).
  - DAB+ estéreo: `dablin.py` deja de mezclar a mono y sale por el estéreo de OpenWebRX (HdStereo).
  - Página: botón ESTÉREO/MONO y medidores L/R encima del estéreo de OpenWebRX.
  - Solo se tocan `dablin.py` e `init.js` (nada de `analog.py` ni `dsp.py`).
- En 1.2.128 sigue funcionando como la 1.2.1.
- Probado en la Pi (1.2.130: BCFM y DAB estéreo con L/R y botón) e instalado en el Ubuntu.

## 1.2.1 · 2026-11-13
- Solo se aplica en versiones probadas (ahora 1.2.128). En la 1.2.130 cambió la cadena de FM
  (y trae su propio modo BCFM estéreo): el enganche la rompería. `aplicar --forzar` para pruebas.
  Tras una actualización con apt a una versión no probada, no se reaplica (lo anota en el registro).
- Segunda protección: si `analog.py` tiene la FM nueva (BaseWFm/BCFm), no se cambia nada.

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
