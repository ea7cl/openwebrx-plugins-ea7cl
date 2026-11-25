# tetra_mejorado (tetra-mejorado) · panel TETRA completo en OpenWebRX+

Versión 1.0 (25-11-2026). Probada en OpenWebRX+ 1.2.130 e instalada en el receptor de EA7CL.
**No es un plugin de la web** (no va en `init.js`): cambia el intérprete TETRA del servidor y su panel.

## Qué fallaba en el modo TETRA original

Comprobado con señal real de 422,600 MHz en la Pi (red 214-30, cifrada) y `tetrarx` de dxlAPRS:

| Fallo | Por qué |
|---|---|
| **Nunca sale TS0 / falta un TS** | El panel solo enseña un dato si no vale 0 (`if (data.ft)`), y además en «TS» ponía el **tipo de trama** (FTYP), no el intervalo. `tetrarx` numera los intervalos **0-3** (TN) y en TETRA se llaman **1-4** |
| Panel vacío casi siempre | Solo mandaba datos con voz (AUDIO=1); en redes cifradas o en reposo no salía nada, aunque `tetrarx` manda red, zona y frecuencias |
| SSI falsos (2, 4, 6…) | Leía `ssi` en minúsculas, que **no es un abonado**; el abonado es `SSI` en mayúsculas |
| No salen GSSI (grupo), USSI ni SMI | No se leían |
| «Net:» siempre vacío | Nunca se rellenaba |
| «Offset: 0 Hz» no salía | El mismo fallo del 0 |

**Sobre «se pierde el slot 4» (lo que dijeron en el chat de Telegram):** `tetrarx` sí decodifica los
4 intervalos (en 76 s de prueba: unas 1290 ráfagas en cada TN 0, 1, 2 y 3), y OpenWebRX mezcla el
audio de todos en una salida (`-c 1`). El TS4 de TETRA es el TN 3 de `tetrarx`: **no se pierde**,
era la numeración y el panel. Las tramas de tráfico y voz no traen TN; se deduce por el orden de
las ráfagas (comprobado: acierta en 4969 de 4971 casos).

## Qué hace

- Panel con las 4 casillas **TS1 TS2 TS3 TS4**; en verde las que tienen voz (2 s tras la última trama).
- Red (MCC-MNC y país), color (BCC), zona (LA), frecuencias de la base, potencia máxima del móvil,
  servicio de voz y si va **cifrado**.
- Grupo (GSSI), SSI, USSI y SMI con el TS en el que se vieron (se recuerdan 60 s; 16777215 = «a todos»
  no se enseña).
- «Última voz: hace N s», señal (dB y apertura del ojo) y desvío.
- Si dejan de llegar datos 5 s, el panel se apaga (gris).
- Datos al navegador como mucho una vez por segundo, o al cambiar algo.
- Nombres de red opcionales en `/etc/openwebrx/tetra_redes.txt`, líneas `mcc mnc texto`
  (ej.: `214 30 Mi red`).

El audio no cambia: se siguen oyendo los 4 TS mezclados.

## Uso

```
sudo bash tetra-mejorado.sh aplicar     # lo pone (o actualiza) y reinicia OpenWebRX
sudo bash tetra-mejorado.sh deshacer    # lo quita y reinicia
bash tetra-mejorado.sh estado
```

Necesita `tetrarx` (paquete `dxlaprs-tetra` del repositorio de OpenWebRX+). Toca el final de
`owrx/tetra.py`, `htdocs/lib/MetaPanel.js` y `htdocs/css/openwebrx.css` (bloques entre marcas) y añade
el paquete `owrx_tetraea7cl`. Copias de los originales en `/var/backups/owrx-tetramejorado/<versión>/`.
Tras cada `apt` se vuelve a aplicar solo (`/etc/apt/apt.conf.d/99owrx-tetramejorado`) si la versión de
OpenWebRX está en PROBADAS.

Para depurar: `DEPURAR = True` en `owrx_tetraea7cl/parser.py` escribe cada trama en
`/tmp/tetra-mejorado-depurar.log`.

## Pruebas (Pi, 25-11-2026)

- Aplicar, volver a aplicar y deshacer sobre una copia: archivos idénticos al original (md5).
- En vivo, 422,600 MHz con el RTL-SDR: red 214-30 (España), color 3, zona 3, 420,0250/410,0250 MHz,
  35 dBm, voz · cifrado, SSI 1100010 en TS2. Capturas en `pruebas/` (una con voz simulada en TS2 y TS4
  para ver las casillas en verde).
- En la Pi se instaló `dxlaprs-tetra` y se añadió el perfil de prueba «TETRA 422 MHz (prueba)» al
  RTL-SDR (copia previa: `/var/lib/openwebrx/settings.json.antes-tetra-20261125`).
