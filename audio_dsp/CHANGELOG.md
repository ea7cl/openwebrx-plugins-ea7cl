# Historial de audio_dsp

## v2.4 + IA v2 + arreglo de escala (EA7CL) — 22-nov-2026
- Arreglo de un fallo del plugin: el espectro se pintaba de 0 a 6 kHz, pero las marcas del eje
  (500 … 5k), las rayas HP/LP/N/PK y el clic para poner el notch usaban de 0 a la mitad de la
  frecuencia de muestreo (~24 kHz). Salían unas 4 veces más a la izquierda y el clic ponía el notch
  en otra frecuencia. Ahora todo usa una sola escala: `Plugins.audio_dsp.VISTA_HZ = 6000`.
- No cambia el sonido. Probado en la Pi e instalado en el servidor el 22-11-2026.

## v2.4 + IA v2 (EA7CL) — 16-nov-2026
- Botón **IA** en Noise Reduction: red neuronal RNNoise (Jitsi rnnoise-wasm 0.2.1) en el navegador.
- La IA se usa como "plantilla" suavizada aplicada al sonido original: en 7,136 MHz con Level 50 %,
  −15,8 dB de ruido en las pausas y sin golpes de ruido (la primera versión, mezclando, daba −9,9 dB).
- En CW, WFM, DAB, DRM y digitales vuelve sola al NR normal.
- Instalado en el servidor el 16-11-2026. Subido a GitHub el 22-11-2026 con instalador y desinstalador.

## v2.4
- Versión de partida: analizador de espectro, ecualizador paramétrico y filtros.
