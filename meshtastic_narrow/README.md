# meshtastic_narrow

Modo **Meshtastic Narrow** para OpenWebRX+ (EA7CL): recibe y descifra Meshtastic en los modos
*Narrow* de la banda de 868 MHz (62,5 kHz de ancho), como la red **SFNarrow en 869,618 MHz**.

OpenWebRX+ ya trae el modo *Meshtastic*, pero con un solo ancho de banda para todo el servidor
(250 kHz, el de LongFast). Este añade un segundo modo con 62,5 kHz, así funcionan los dos a la vez.

## Qué se ve

- En **DIG** aparece *Meshtastic Narrow*, debajo de *Meshtastic*.
- Los mensajes salen en el mismo **panel Meshtastic**: textos del canal público, telemetría
  (temperatura, humedad, presión, batería), posiciones, trazados de ruta y acuses.
- Los nodos que envían su posición salen en el **mapa** de OpenWebRX.
- Los mensajes privados entre dos nodos solo muestran su tamaño: van cifrados con la clave de
  cada nodo y nadie más puede leerlos.
- Memoria del servidor **Meshtastic SFNarrow** en 869,618 MHz, para entrar con un clic
  (también sale en el buscador del botón MEM).

Probado el 4-nov-2026 con escucha real en 869,618 MHz: 78 paquetes en 30 minutos, todos SF7.

## Qué toca

| Archivo | Cambio |
|---|---|
| `owrx/modes.py` | el modo `meshtastic-narrow` en la lista de modos |
| `owrx/dsp.py` | arrancar su decodificador cuando se elige |
| `csdr/chain/lora.py` | el decodificador: `lorarx` con `-b 6` (62,5 kHz) y SF 7, 8 y 9 |
| `htdocs/plugins/receiver/meshtastic_narrow/` | plugin web: abre el panel de mensajes Meshtastic con este modo |
| `htdocs/plugins/receiver/init.js` | la línea `Plugins.load('meshtastic_narrow');` |
| `/var/lib/openwebrx/bookmarks.json` | la memoria *Meshtastic SFNarrow* |

Lo añadido en los tres archivos de Python va entre las marcas
`# EA7CL meshtastic_narrow (inicio)` y `(fin)`. Al desinstalar se quita solo eso y los archivos
quedan exactamente como estaban. Como son archivos de OpenWebRX, `copia_owrx` los guarda en
cada copia y los vuelve a poner después de actualizar.

Necesita `lorarx` (paquete `dxlaprs-lora`) y `python3-meshtastic`, que OpenWebRX+ ya usa para
su modo Meshtastic.

## El perfil

El modo necesita 1 MHz de banda alrededor de la frecuencia. Para 869,618 MHz con una RTL-SDR:
**2 400 000 de sample rate** y el **centro en 869,400 MHz** (lejos del borde y del pico del centro),
ganancia fija hacia 40 dB.

## Instalar

```bash
scp meshtastic_narrow/meshtastic_narrow.js meshtastic_narrow/servidor/meshtastic_narrow_parchear.py meshtastic_narrow/scripts/meshtastic_narrow-*.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/meshtastic_narrow-install.sh'
```

Guarda antes todo lo que toca en `/home/ea7cl/meshtastic_narrow-antes-FECHA`, detiene OpenWebRX
(los oyentes se cortan unos segundos), aplica los cambios y lo arranca. Si no arranca bien o
aparece un error de Python, lo deja todo como estaba. Después: Ctrl+F5 en el navegador.

Otra frecuencia o nombre para la memoria:
`sudo FREQ=869525000 NOMBRE="Meshtastic X" bash ~/meshtastic_narrow-install.sh`

Ver si está puesto: `python3 -I ~/meshtastic_narrow_parchear.py ver`

## Desinstalar

```bash
ssh -t openwebrx 'sudo bash ~/meshtastic_narrow-uninstall.sh'
```

Guarda todo en `/home/ea7cl/desinstalado-meshtastic_narrow-FECHA` y quita el modo, el plugin,
su línea de `init.js` y la memoria. No toca el receptor ni el perfil de 869 MHz.
