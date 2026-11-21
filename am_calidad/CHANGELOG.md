# am_calidad (am-calidad) · cambios

## 1.0 · 2026-11-21
- AM de cada oyente sin decodificador con AGC por portadora: baja la ganancia en el acto al abrir
  el squelch con una portadora fuerte (se acaba el golpe saturado) y no bombea con la voz.
- Paso banda de audio: paso alto de 250 Hz (quita graves y continua) y paso bajo según la
  frecuencia: 3500 Hz desde 30 MHz (Airband), 4500 Hz en onda corta, 5000 Hz en onda media/larga.
- Limitador blando con tope 0,75 (−2,5 dBFS) y quitacontinua lento final.
- Con decodificador (ACARS…) y en los servicios de fondo, la cadena original intacta. La SAM no se toca.
- Instalador con copia de seguridad, `deshacer` byte a byte y reaplicado tras apt en versiones
  probadas (1.2.130). Convive con fm_calidad.
- Probada en la Raspberry Pi de pruebas e instalada en el receptor de EA7CL.
