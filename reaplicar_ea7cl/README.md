# reaplicar_ea7cl (EA7CL)

Vuelve a poner los **cambios propios en archivos del paquete OpenWebRX+** (traducciones, estilos,
`index.html`, cabecera, Meshtastic Narrow…) después de cada actualización con `apt`. Guarda cada cambio como
un parche pequeño y, tras cada `apt`, pone los que falten. Si una versión nueva cambió esa parte, avisa
(`NO ENCAJA`) y no toca ese archivo.

No guarda lo que ya gestionan `fm_calidad`, `am_calidad` y `estereo_fm`: tienen su propio aviso de apt.

## Qué trae esta carpeta

| Ruta | Qué es | Dónde va en el servidor |
|---|---|---|
| `reaplicar_ea7cl` | El programa | `/usr/local/sbin/reaplicar_ea7cl` |
| `99owrx-reaplicar-ea7cl` | Aviso de apt: tras cada `apt` ejecuta `reaplicar_ea7cl aplicar` | `/etc/apt/apt.conf.d/` |
| `cambios-1.2.130/parches/` | Los 18 cambios guardados, hechos sobre OpenWebRX+ 1.2.130 | `/usr/local/share/reaplicar-ea7cl/parches/` |
| `cambios-1.2.130/copias/` | Archivos que se copian enteros (el fondo `openwebrx-background-cool-blue.webp`) | `/usr/local/share/reaplicar-ea7cl/copias/` |
| `propios/sessionstats.py` | Archivo nuevo de estadísticas de sesiones; lo necesita el cambio de `connection.py` | `/usr/lib/python3/dist-packages/owrx/` |

El nombre de cada parche es la ruta del archivo con `%` en lugar de `/`.

### Los cambios guardados

| Archivo (desde `/usr/lib/python3/dist-packages/`) | Qué cambia |
|---|---|
| `htdocs/index.html` | Título «SDR MÁLAGA, ESPAÑA», posición de las flechas de la cascada y otros retoques de la página |
| `htdocs/include/header.include.html` | Cabecera en español y botones propios (web, Telegram, donativos, ayuda) |
| `htdocs/css/openwebrx.css`, `openwebrx-header.css` | Estilos: capas, colores de la cabecera |
| `htdocs/openwebrx.js` | Mensajes en español y un arreglo cuando aún no hay cascada |
| `htdocs/lib/ProgressBar.js`, `UI.js`, `Waterfall.js` | Textos de barras y avisos en español |
| `htdocs/policy.html` | Política de uso en español, con enlace para reconectar |
| `htdocs/plugins/receiver/utils/utils.js` | utils de 0xAF en una versión más nueva |
| `owrx/connection.py`, `owrx/client.py` | Mensajes en español y estadísticas de sesiones (`sessionstats.py`) |
| `owrx/controllers/clients.py` | Opción «30 days» al vetar un cliente en /clients |
| `owrx/modes.py` | Filtros por defecto: FM y AM ±5 kHz, LSB/USB 50-2850 Hz, DMR ±6,5 kHz; modo Meshtastic Narrow |
| `owrx/dsp.py`, `owrx/service/__init__.py`, `csdr/chain/lora.py` | Demodulador de Meshtastic Narrow (de `meshtastic_narrow`) |
| `owrx/aprs/direwolf.py` | Silencia la salida de direwolf en el registro |

## Instalar

En el servidor, desde la carpeta del repositorio:

```bash
cd ~/openwebrx-plugins-ea7cl/reaplicar_ea7cl
sudo bash scripts/reaplicar_ea7cl-install.sh     # instala y enseña el estado; no cambia OpenWebRX
sudo reaplicar_ea7cl aplicar                     # pone los cambios que falten y reinicia OpenWebRX
sudo reaplicar_ea7cl estado                      # todo debe salir «puesto»
```

- El instalador copia antes lo que hubiera en `/var/backups/reaplicar-ea7cl/instalador-FECHA/`.
- `aplicar` copia cada archivo antes de cambiarlo en `/var/backups/reaplicar-ea7cl/<versión>/`.
- Registro: `/var/log/reaplicar_ea7cl.log`.
- Los cambios son de la **1.2.130**. En otra versión, los que no encajen salen como `NO ENCAJA` y hay que
  revisarlos a mano; los demás se ponen.
- Si quitas `meshtastic_narrow`, borra antes sus tres parches (`dsp.py`, `service%__init__.py`, `lora.py`) y
  la parte Meshtastic de `modes.py`, o vuelve a guardar con `reaplicar_ea7cl guardar`.

## Después de cambiar algo a mano

Si retocas otro archivo de OpenWebRX, guarda de nuevo todos los cambios (compara con el paquete original):

```bash
sudo reaplicar_ea7cl guardar
```

## Desinstalar

```bash
sudo bash scripts/reaplicar_ea7cl-uninstall.sh
```

Aparta el programa, el aviso de apt y los cambios guardados en `/home/ea7cl/desinstalado-reaplicar_ea7cl-FECHA`.
No deshace los cambios ya puestos. Para volver a los archivos originales: `sudo apt install --reinstall openwebrx`
(fm-calidad, am-calidad y el estéreo se vuelven a poner solos).
