# fm_calidad (fm-calidad) · cambios

## 1.1 · 2026-11-21
- Paso alto del audio a 290 Hz (antes 200) con filtro de 511 coeficientes: los subtonos CTCSS
  hasta 210 Hz quedan por debajo de −78 dB (antes de −5 a −67 dB).
- Margen de picos: nivelador a 0,5 que baja de golpe y limitador blando con tope 0,75 (−2,5 dBFS);
  antes llegaba a 1,0 y había muestras saturadas.
- Probada en la Pi e instalada en el receptor de EA7CL.

## 1.0 · 2026-11-21
- La FM estrecha (NFM) de cada oyente sin decodificador se demodula a 48 kHz en vez de a 12 kHz
  y luego se baja a los 12 kHz de siempre: no se deforma con 5 kHz de desviación ni en los agudos.
- De-énfasis a 48 kHz, paso banda de audio de 200 a 4000 Hz (CTCSS y soplido fuera).
- Nivelador suave por tramos de 20 ms en lugar del AGC de csdr (que distorsionaba), con
  limitador blando.
- Filtro FM por defecto ±6 kHz (antes ±4 kHz); en la web se puede abrir hasta ±12,5 kHz.
- Con decodificador (packet, POCSAG, AIS…) y en los servicios de fondo, la cadena original intacta.
- Instalador con copia de seguridad, `deshacer` byte a byte y reaplicado tras apt en versiones
  probadas (1.2.130).
- Probada en la Raspberry Pi de pruebas e instalada en el receptor de EA7CL.
