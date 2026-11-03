# scan_recordado — memorias y scan a gusto de cada oyente (EA7CL)

Plugin de receptor para OpenWebRX+ que permite a **cada oyente elegir qué memorias ve y cuáles entran en el SCAN**,
y lo **recuerda en su navegador** cada vez que abre el SDR o cambia de perfil.

Instalada en el servidor `openwebrx` el 3-nov-2026 la v1.2 (etiqueta `scan_recordado-v1.2`,
SHA-256 `d5cce0fc3c8987ef0fa077a94e95f2ee2c9e3be39e40c7527c76e48b26d9c7fd`;
copia previa del plugin: `/home/ea7cl/scan_recordado.js.bak-2026-11-03-1847`).

## Qué hace

- **Clic derecho sobre una memoria** del waterfall (`toggle_scannable` de 0xAF): la activa o quita del scan
  (sombra roja arriba cuando está activada). Antes se perdía al recargar; ahora se recuerda.
- **Botón MEM** en la columna de plugins: abre la ventana «Memorias» con las del perfil actual, agrupadas en
  memorias del receptor, propias (MW) y plan de bandas. Cada una tiene dos casillas:
  - **Ver**: si se quita, la memoria desaparece del waterfall y del scan para ese oyente.
  - **Scan**: igual que el clic derecho; sirve también en iPhone/iPad, donde no hay clic derecho.
- **Buscador** (v1.2): una letra busca las memorias que empiezan por ella; más letras, las que la contienen.
  Debajo de las del perfil actual salen las de **otros perfiles**, con el perfil que las cubre; al pulsar una,
  `profile_jump` cambia a ese perfil y la sintoniza. Si ningún perfil la cubre, sale atenuada.
  Ojo: si el perfil es de un SDR con varios perfiles (🔻), cambiarlo lo cambia también para quien esté en ese SDR,
  igual que al elegirlo en el desplegable.
- En la ventana: pulsar un nombre para **sintonizarlo**, y los botones **Ver todas**,
  **Scan todas**, **Scan ninguna** y **Restaurar** (volver a como vienen del receptor). Los botones actúan
  sobre las memorias que se ven en la lista, así que se pueden combinar con la búsqueda.
- Cada oyente tiene **su propia lista**: lo que cambia uno no afecta a los demás ni al servidor.
- Se guarda solo en el navegador (`localStorage`, claves `ea7_scan_recordado` y `ea7_mem_ocultas`).
  Otro navegador, otro dispositivo o borrar los datos del sitio empiezan como vienen del receptor.
- Una memoria se reconoce por su origen, frecuencia y nombre: si se cambia el nombre o la frecuencia
  de una memoria en el servidor, vuelve a verse y a su marca de scan por defecto.

## Marcadores nuevos del servidor

- Los que se añaden o borran en **Ajustes → Marcadores** llegan al momento a los oyentes conectados
  (lo hace OpenWebRX+). Aparecen visibles y con el scan del servidor; solo siguen ocultas las memorias
  que cada oyente quitó una a una.
- La lista de todos los perfiles para el buscador (`memorias.json`) la genera `gen_memorias.py`, que junta
  los marcadores igual que OpenWebRX+ (`/etc/openwebrx/bookmarks.d`, región, país y `bookmarks.json`).
  El vigilante `scan-recordado-memorias.path` la regenera en cuanto cambia `bookmarks.json` o
  `bookmarks.d`. La ventana MEM la vuelve a pedir cada vez que se abre.

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
| `servidor/gen_memorias.py` | Genera `memorias.json` con los marcadores de todos los perfiles. Se queda en `/home/ea7cl`, como `gen_profiles.py`. |
| `servidor/scan-recordado-memorias.path` / `.service` | Vigilante de systemd que ejecuta `gen_memorias.py` cuando cambian los marcadores. |
| `scripts/scan-recordado-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin, añade la carga a `init.js` si falta, activa el vigilante y genera `memorias.json`. |
| `scripts/scan-recordado-uninstall.sh` | Desinstala: vigilante, línea de `init.js`, carpeta del plugin y generador, con copia de todo. |

## Instalar o reinstalar

```bash
scp scan_recordado/scan_recordado.js scan_recordado/scripts/scan-recordado-install.sh scan_recordado/servidor/* openwebrx:~/
ssh -t openwebrx 'sudo bash ~/scan-recordado-install.sh'
```

Después, Ctrl+F5 en el navegador.

Ojo: el servidor deja que el navegador guarde los plugins hasta **una hora**. Tras actualizar,
quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo; con Ctrl+F5 se ve la nueva.

## Desinstalar

```bash
scp scan_recordado/scripts/scan-recordado-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/scan-recordado-uninstall.sh'
```

Para y quita el vigilante, quita de `init.js` la línea de scan_recordado y aparta la carpeta del plugin
y `gen_memorias.py`. No borra nada: lo guarda todo en `/home/ea7cl/desinstalado-scan_recordado-FECHA`
y al terminar dice la orden para volver a ponerlo. Lo que cada oyente eligió queda en su navegador,
sin efecto.
