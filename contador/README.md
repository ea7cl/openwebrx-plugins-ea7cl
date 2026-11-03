# contador — contador de visitas propio para OpenWebRX+

Plugin de receptor para OpenWebRX+ que pone en la cabecera del receptor una tarjeta con
**visitas**, **visitantes únicos**, **número de países** y las banderas de los países que más
visitan. Sustituye a contadores externos como Flag Counter: lo cuenta el propio servidor, así
que no depende de ningún servicio de fuera ni bloquea la página si ese servicio falla.

```
VISITAS  1.950
1.789 únicos · 58 países
🇪🇸 503  🇺🇸 60  🇺🇦 22  🇦🇩 20
🇩🇪 20   🇫🇷 14  🇧🇷 9   🇩🇿 9
```

## Cómo funciona

- El servidor (`owrx/contador.py`) cuenta cada oyente que se conecta al receptor:
  - **Visita:** la misma dirección IP dentro de 30 minutos cuenta como una sola visita.
  - **Visitante único:** cada dirección IP distinta, una sola vez para siempre.
  - **País:** el de la dirección IP, con la base de datos gratuita DB-IP «IP to Country Lite».
  - Las conexiones desde la red local **no cuentan**.
- **Privacidad:** no se guarda ninguna IP, solo un resumen (hash con sal) para saber si ya se había visto.
  El fichero público que lee el navegador (`datos.json`) solo tiene totales.
- Cada 10 segundos, si hay cambios, deja los totales en `htdocs/plugins/receiver/contador/datos.json`.
- El navegador (`contador.js`) lee ese fichero al cargar y cada 2 minutos.
- Textos en español si el navegador está en español; en inglés en los demás casos.
- Las banderas se cargan de flagcdn.com; si no cargan, sale el código del país (ES, US…).

## Requisitos

- OpenWebRX+ instalado **como paquete** (Debian, Ubuntu, Raspberry Pi OS…), con `systemctl` y acceso `sudo`.
  No vale para la versión Docker: allí los cambios en el código se pierden al recrear el contenedor.
- Conexión a internet en el servidor para descargar la base de países (unos 8 MB, una vez al mes).

## Instalación

En el servidor de OpenWebRX+:

```bash
git clone https://github.com/ea7cl/openwebrx-plugins-ea7cl.git
cd openwebrx-plugins-ea7cl
sudo bash contador/scripts/contador-install.sh
```

Si no tienes `git` (`sudo apt install git`), o prefieres copiarlo desde otro ordenador:

```bash
scp -r contador usuario@servidor:~/
ssh -t usuario@servidor 'sudo bash ~/contador/scripts/contador-install.sh'
```

Después abre el receptor en el navegador y pulsa en el título de la cabecera para desplegarla:
la tarjeta está al final. Los números empiezan a subir con el primer oyente que entre desde
fuera de tu red local (puedes tardar unos segundos en verlo; recarga la página).

### Qué hace el instalador

1. Instala `python3-maxminddb` si falta (para leer la base de países).
2. Descarga la base de países en `/var/lib/openwebrx/geoip/` y deja `/etc/cron.monthly/contador-geoip`
   para renovarla cada mes. Si la descarga falla, el contador funciona igual pero sin países.
3. Copia `servidor/contador.py` a `owrx/contador.py`.
4. Añade dos líneas a `owrx/connection.py` (antes guarda una copia `connection.py.bak-FECHA`):
   ```python
   from owrx.contador import ContadorThread                      # tras: from owrx.cpu import CpuUsageThread
   ContadorThread.getSharedInstance().add_client(self)          # tras: CpuUsageThread.getSharedInstance().add_client(self)
   ```
   Si tu versión de OpenWebRX tiene otra forma, el instalador no toca nada y avisa: añade esas dos líneas a mano.
5. Copia `plugin/contador.js` a `htdocs/plugins/receiver/contador/` (carpeta propiedad de `openwebrx`, que escribe ahí `datos.json`).
6. Añade `Plugins.load('contador');` a `htdocs/plugins/receiver/init.js` (lo crea si no existe).
7. Reinicia OpenWebRX (`systemctl restart openwebrx`): los oyentes conectados se reconectan solos.

Se puede ejecutar todas las veces que haga falta: no duplica nada y **conserva los datos** del contador.

## Después de actualizar OpenWebRX

Una actualización de OpenWebRX **sobrescribe `owrx/connection.py`** y el contador deja de contar
(la tarjeta sigue mostrando los últimos totales). Vuelve a ejecutar el instalador:

```bash
cd openwebrx-plugins-ea7cl && git pull
sudo bash contador/scripts/contador-install.sh
```

## Ajustes

**Navegador**, al principio de `htdocs/plugins/receiver/contador/contador.js`
(no hace falta reiniciar, basta recargar la página):

| Ajuste | Por defecto | Para qué |
|---|---|---|
| `BANDERAS` | `12` | Banderas que se muestran, en filas de 4. `0` para ninguna. |
| `REFRESCO` | `120000` | Milisegundos entre lecturas de los datos. |
| `ANCHO` | `200` | Ancho de la tarjeta en píxeles. |
| `ALTO` | `0` | Alto en píxeles, para igualarla con otras tarjetas. `0` = el que necesite. |
| `DESPUES_DE` | `''` | Selector CSS de un elemento de la cabecera tras el que colocarla, p. ej. `'img[src*="hamqsl"]'`. Vacío = al final. |

**Servidor**, al principio de `owrx/contador.py` (después hay que `sudo systemctl restart openwebrx`;
ojo, una actualización de OpenWebRX no lo borra, pero volver a ejecutar el instalador sí lo sobrescribe):

| Ajuste | Por defecto | Para qué |
|---|---|---|
| `COUNTER_BASE` | `0` | Se suma a visitas y únicos. Útil para seguir la cuenta de un contador anterior. |
| `COUNTER_WINDOW` | `1800` | Segundos en los que la misma IP cuenta como una sola visita. |
| `COUNTER_TOP_COUNTRIES` | `24` | Países que se publican en `datos.json`. |

## Si el receptor está detrás de un proxy (nginx, Cloudflare…)

OpenWebRX solo se fía de la cabecera `X-Forwarded-For` si la conexión viene de la red local o de un
proxy de confianza. Si todas las visitas salen como una sola o no cuentan, revisa en los ajustes de
OpenWebRX la lista de *trusted proxies*.

## Comprobar que funciona

```bash
cat /usr/lib/python3/dist-packages/htdocs/plugins/receiver/contador/datos.json
journalctl -u openwebrx | grep -i -E "contador|visitor|GeoIP"
```

## Datos

| Fichero | Qué guarda |
|---|---|
| `/var/lib/openwebrx/contador.json` | Totales, países, fecha de inicio y la sal (privado, solo `openwebrx`). |
| `/var/lib/openwebrx/contador-huellas.txt` | Resúmenes de las IP ya vistas (privado). |
| `htdocs/plugins/receiver/contador/datos.json` | Totales públicos que lee el navegador. |

Para **empezar de cero**: `sudo systemctl stop openwebrx`, borra los dos ficheros de `/var/lib/openwebrx/` y vuelve a arrancarlo.

## Desinstalar

```bash
sudo bash contador/scripts/contador-uninstall.sh
```

Quita las dos líneas de `connection.py`, el módulo, el plugin, la línea de `init.js` y la tarea mensual.
Los datos de `/var/lib/openwebrx/` se conservan por si se vuelve a instalar.

## Archivos

| Archivo | Para qué |
|---|---|
| `plugin/contador.js` | La tarjeta del navegador. |
| `servidor/contador.py` | El contador en el servidor (va en `owrx/contador.py`). |
| `scripts/contador-install.sh` | Instala o actualiza todo. |
| `scripts/contador-uninstall.sh` | Lo quita todo menos los datos. |
| `scripts/contador-geoip.sh` | Descarga la base de países (la usa el instalador y la tarea mensual). |

Base de países: [DB-IP](https://db-ip.com) «IP to Country Lite», licencia CC BY 4.0.
