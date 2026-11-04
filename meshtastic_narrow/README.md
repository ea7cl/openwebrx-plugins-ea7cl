# meshtastic_narrow

Modo **Meshtastic Narrow** para OpenWebRX+ (EA7CL): recibe y descifra Meshtastic en los modos
*Narrow* de la banda de 868 MHz (62,5 kHz de ancho), como la red **SFNarrow en 869,618 MHz**.

OpenWebRX+ ya trae el modo *Meshtastic*, pero con un solo ancho de banda para todo el servidor
(250 kHz, el de LongFast). Este añade un segundo modo con 62,5 kHz, así funcionan los dos a la vez.

## Qué se ve

- En **DIG** aparece *Meshtastic Narrow*, debajo de *Meshtastic*.
- Los mensajes salen en el mismo **panel Meshtastic**: textos del canal público, telemetría
  (temperatura, humedad, presión, batería), posiciones, trazados de ruta y acuses.
- Los nodos que envían su posición salen en el **mapa** de OpenWebRX, con el icono de Meshtastic
  (la línea «Meshtastic» del mapa aparece con el primer nodo que manda posición).
- **En segundo plano**, como AIS o VDL2: se decodifica aunque no haya nadie escuchando, así el
  mapa se llena las 24 horas. Un oyente puede mover ese receptor a otro perfil; cuando se va,
  OpenWebRX lo devuelve solo al perfil que cubre 869,618 MHz.
- Los mensajes privados entre dos nodos solo muestran su tamaño: van cifrados con la clave de
  cada nodo y nadie más puede leerlos.
- Memoria del servidor **Meshtastic SFNarrow** en 869,618 MHz, para entrar con un clic
  (también sale en el buscador del botón MEM).

Probado el 4-nov-2026 con escucha real en 869,618 MHz: 78 paquetes en 30 minutos, todos SF7.

## Qué toca

| Archivo | Cambio |
|---|---|
| `owrx/modes.py` | el modo `meshtastic-narrow` en la lista de modos |
| `owrx/dsp.py` | arrancar su decodificador cuando un oyente elige el modo |
| `owrx/service/__init__.py` | arrancarlo en segundo plano |
| `csdr/chain/lora.py` | el decodificador: `lorarx` con `-b 6` (62,5 kHz) y SF 7, 8 y 9 |
| `htdocs/plugins/receiver/meshtastic_narrow/` | plugin web: abre el panel de mensajes Meshtastic con este modo |
| `htdocs/plugins/receiver/init.js` | la línea `Plugins.load('meshtastic_narrow');` |
| `/var/lib/openwebrx/bookmarks.json` | la memoria *Meshtastic SFNarrow* |
| `/etc/openwebrx/bands-r1.json` y `bands.json` | frecuencia de servicio `"meshtastic-narrow": 869618000` en la banda EU868 |
| `/var/lib/openwebrx/settings.json` | `meshtastic-narrow` en los decodificadores de segundo plano; en el receptor (RTL-SDR 00001001), servicios activados y programa `0000-0000` (todo el día) con el perfil que cubre la frecuencia |

Lo añadido en los cuatro archivos de Python va entre las marcas
`# EA7CL meshtastic_narrow (inicio)` y `(fin)`. Al desinstalar se quita solo eso y los archivos
quedan exactamente como estaban. Como son archivos de OpenWebRX, `copia_owrx` los guarda en
cada copia y los vuelve a poner después de actualizar.

Necesita `lorarx` (paquete `dxlaprs-lora`) y `python3-meshtastic`, que OpenWebRX+ ya usa para
su modo Meshtastic.

Los ajustes del segundo plano los pone y quita `meshtastic_narrow_config.py`, con OpenWebRX parado.
Antes de cambiar el receptor guarda cómo estaba en `/var/lib/openwebrx/meshtastic_narrow-antes.json`
y al desinstalar lo deja igual.

## El perfil

El modo necesita 1 MHz de banda alrededor de la frecuencia. Para 869,618 MHz con una RTL-SDR:
**2 400 000 de sample rate** y el **centro en 869,400 MHz** (lejos del borde y del pico del centro),
ganancia fija hacia 40 dB.

## Instalar

```bash
scp meshtastic_narrow/meshtastic_narrow.js meshtastic_narrow/servidor/meshtastic_narrow_*.py meshtastic_narrow/scripts/meshtastic_narrow-*.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/meshtastic_narrow-install.sh'
```

Guarda antes todo lo que toca en `/home/ea7cl/meshtastic_narrow-antes-FECHA`, con un `restaurar.sh`
para volver a ese momento. Detiene OpenWebRX (los oyentes se cortan unos 3 minutos: con tantos
receptores tarda en pararse y en arrancar), aplica los cambios y lo arranca. Si no arranca bien o
aparece un error de Python, lo deja todo como estaba. Después: Ctrl+F5 en el navegador.

Otra frecuencia, nombre o receptor, o sin segundo plano:
`sudo FREQ=869525000 NOMBRE="Meshtastic X" RECEPTOR=00000202 bash ~/meshtastic_narrow-install.sh`
`sudo SEGUNDO_PLANO=0 bash ~/meshtastic_narrow-install.sh`

Volver a instalar encima actualiza lo que haya, sin duplicar nada.

Ver si está puesto: `python3 -I ~/meshtastic_narrow_parchear.py ver` y
`sudo python3 -I ~/meshtastic_narrow_config.py ver`

## Desinstalar

```bash
ssh -t openwebrx 'sudo bash ~/meshtastic_narrow-uninstall.sh'
```

Guarda todo en `/home/ea7cl/desinstalado-meshtastic_narrow-FECHA` y quita el modo, el plugin,
su línea de `init.js`, la memoria y el segundo plano (el receptor vuelve a como estaba antes de
instalar). No toca el perfil de 869 MHz.
