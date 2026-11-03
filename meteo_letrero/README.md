# meteo_letrero — letrero con el tiempo (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.6**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

- Letrero a lo ancho de la pantalla, entre la cabecera y la cinta de bandas (no tapa ninguna ventana: la cinta y la
  cascada bajan lo que mide).
- Muestra el tiempo de la estación Davis Vantage Pro2: los mismos datos del pie de foto de la cámara.
- Dos formas: en movimiento (de derecha a izquierda, se para con el ratón encima) o quieto y centrado. Cada oyente
  cambia de una a otra pulsando sobre el letrero, y su navegador lo recuerda.
- Velocidad, alto, letra y lugar se ajustan al principio del plugin (`VELOCIDAD`, `ALTO`, `LETRA`, `LUGAR`).

## Piezas en el servidor

- `datos.json` (en la carpeta del plugin) lo escribe `meteo_copia.py` cada minuto: lee en la Raspberry
  (192.168.1.128) el pie de foto que ya genera weewx y saca los valores. En la Raspberry no se toca nada.
- La tarea de cada minuto es `/etc/cron.d/meteo_letrero` (en el repositorio, `servidor/meteo_letrero.cron`).
- `meteo_copia.py` vive en `/home/ea7cl`. El instalador pone la tarea y lo ejecuta una vez; el desinstalador
  quita la tarea y lo aparta.

## Archivos

| Archivo | Para qué |
|---|---|
| `meteo_letrero.js` | El plugin. |
| `servidor/meteo_copia.py` | Escribe `datos.json` con el tiempo de la Raspberry. Va en `/home/ea7cl`. |
| `servidor/meteo_letrero.cron` | Tarea de cada minuto; se instala como `/etc/cron.d/meteo_letrero`. |
| `scripts/meteo_letrero-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (al final de `init.js`). |
| `scripts/meteo_letrero-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp meteo_letrero/meteo_letrero.js meteo_letrero/scripts/meteo_letrero-*.sh meteo_letrero/servidor/* openwebrx:~/
ssh -t openwebrx 'sudo bash ~/meteo_letrero-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp meteo_letrero/scripts/meteo_letrero-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/meteo_letrero-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-meteo_letrero-FECHA` y al terminar dice la orden para volver a ponerlo.
