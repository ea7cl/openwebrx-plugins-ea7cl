"""owrx-estereo (EA7CL) · FM comercial y DAB en estéreo real para OpenWebRX+.

Lo instala y lo quita el script owrx-estereo.sh. No cambia nada de la configuración de
OpenWebRX: solo añade este paquete, un complemento de la página (plugins/receiver/estereo_fm)
y unas líneas de enganche en tres archivos de OpenWebRX (con copia de seguridad).

  · FM (WFM): se decodifica el múltiplex de la emisora (piloto de 19 kHz y L−R a 38 kHz), como
    una radio estéreo. Si no hay piloto, sale mono.
  · DAB: el estéreo que ya da dablin se envía tal cual (OpenWebRX lo mezclaba a mono).
Por el canal de audio de siempre va el MONO normal de OpenWebRX (una página sin el complemento lo
oye como antes). El estéreo va en un mensaje aparte (tipo 5) con L y R juntos y un ADPCM para cada
canal (emisor.py). El servidor avisa a la página de cuántos canales hay
({"type": "ea7cl_estereo", "canales": 1|2}) al cambiar de modo y cada 2 s.
"""

VERSION = "2.0"
