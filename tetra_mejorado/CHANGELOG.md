# tetra_mejorado (tetra-mejorado) · cambios

## 1.0 · 2026-11-25
- Panel TETRA con las 4 casillas TS1-TS4 (tetrarx numera 0-3); en verde las que tienen voz. El
  original enseñaba el tipo de trama como «TS» y ocultaba los valores 0 (nunca salía TS0).
- Las tramas de tráfico y voz no traen TN: se deduce por el orden de las ráfagas (acierta 4969 de
  4971 en una prueba real de 76 s).
- Datos de la red siempre, no solo con voz: MCC-MNC y país, color, zona, frecuencias de la base,
  potencia máxima del móvil, servicio de voz y cifrado.
- SSI corregido: se lee `SSI` (el abonado) y no `ssi`, que no lo es. Nuevos GSSI, USSI y SMI con su TS.
  16777215 («a todos») no se enseña.
- «Última voz», señal con apertura del ojo, desvío (también 0 Hz) y panel en gris si dejan de llegar datos.
- Nombres de red opcionales en `/etc/openwebrx/tetra_redes.txt`.
- El audio no cambia (los 4 TS mezclados): el «slot 4 perdido» del que se habló era la numeración.
- Instalador con copia de seguridad, `deshacer` byte a byte y reaplicado tras apt en versiones
  probadas (1.2.130). Probado en la Raspberry Pi de pruebas con señal real e instalado en el receptor de EA7CL.
