# scan_recordado — memorias y scan a gusto de cada oyente (EA7CL)

Plugin de receptor para OpenWebRX+ que permite a **cada oyente elegir qué memorias ve y cuáles entran en el SCAN**,
y lo **recuerda en su navegador** cada vez que abre el SDR o cambia de perfil.

Instalado en el servidor `openwebrx` el 3-nov-2026 (etiqueta `scan_recordado-v1.1`,
SHA-256 `082c9b1f1e7094f5f1f49db903f010a86456a23d611dc8583b0b4263d29d2d07`;
copia previa de `init.js`: `init.js.bak-2026-11-03-1803`).

## Qué hace

- **Clic derecho sobre una memoria** del waterfall (`toggle_scannable` de 0xAF): la activa o quita del scan
  (sombra roja arriba cuando está activada). Antes se perdía al recargar; ahora se recuerda.
- **Botón MEM** en la columna de plugins: abre la ventana «Memorias» con las del perfil actual, agrupadas en
  memorias del receptor, propias (MW) y plan de bandas. Cada una tiene dos casillas:
  - **Ver**: si se quita, la memoria desaparece del waterfall y del scan para ese oyente.
  - **Scan**: igual que el clic derecho; sirve también en iPhone/iPad, donde no hay clic derecho.
- En la ventana: **buscar** por nombre, pulsar un nombre para **sintonizarlo**, y los botones **Ver todas**,
  **Scan todas**, **Scan ninguna** y **Restaurar** (volver a como vienen del receptor). Los botones actúan
  sobre las memorias que se ven en la lista, así que se pueden combinar con la búsqueda.
- Cada oyente tiene **su propia lista**: lo que cambia uno no afecta a los demás ni al servidor.
- Se guarda solo en el navegador (`localStorage`, claves `ea7_scan_recordado` y `ea7_mem_ocultas`).
  Otro navegador, otro dispositivo o borrar los datos del sitio empiezan como vienen del receptor.
- Una memoria se reconoce por su origen, frecuencia y nombre: si se cambia el nombre o la frecuencia
  de una memoria en el servidor, vuelve a verse y a su marca de scan por defecto.

## Requisitos

- `utils` y `toggle_scannable` cargados en `init.js` (ya lo están). El instalador pone
  `Plugins.load('scan_recordado');` justo debajo de `toggle_scannable`, dentro del bloque que espera a `utils`.
- No modifica `toggle_scannable` ni OpenWebRX+: escucha el mismo clic derecho y filtra las memorias
  antes de dibujarlas.
- El botón MEM toma solo el estilo LED de `botones_ea7cl`.

## Archivos

| Archivo | Para qué |
|---|---|
| `scan_recordado.js` | El plugin. |
| `scripts/scan-recordado-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade la carga a `init.js` si falta. |

## Instalar o reinstalar

```bash
scp scan_recordado/scan_recordado.js scan_recordado/scripts/scan-recordado-install.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/scan-recordado-install.sh'
```

Después, Ctrl+F5 en el navegador.

## Volver atrás

El instalador imprime la orden exacta con la copia de `init.js` que acaba de hacer.
