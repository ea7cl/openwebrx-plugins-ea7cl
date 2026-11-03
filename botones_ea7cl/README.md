# botones_ea7cl — aspecto común de los botones de plugins (EA7CL)

Plugin de receptor para OpenWebRX+ que da el mismo aspecto, **estilo LED de equipo de radio**,
a todos los botones de la columna de plugins (AZ, DOP, LST y los que se añadan en el futuro).

Instalado en el servidor `openwebrx` el 24-oct-2026 (etiqueta `botones_ea7cl-v1.0`,
SHA-256 `ff90fa80757c796479a9721e328d8d4722a7744b7b5a1e292017b896dadc3f86`).

## Qué hace

- Todos los botones con el **mismo ancho**, relieve suave, esquinas redondeadas y un **piloto LED** a la izquierda.
- **Apagado:** piloto gris, letras grises claras.
- **Encendido:** fondo verde, letras blancas y piloto verde brillante.
  - AZ: cuando el autozoom está activado.
  - DOP, LST y cualquier otro: cuando su ventana está abierta.
- Se iluminan al pasar el ratón por encima.
- **LST:** el número de oyentes va dentro del botón («LST 6»); verde si está conectado, rojo si hay error.

## Por qué no se pierde con las actualizaciones

- **No modifica los otros plugins**: solo añade estilos (CSS) por encima. DOP se carga desde
  internet y LST es otro plugin; si se actualizan, este sigue aplicando el aspecto.
- La carpeta `botones_ea7cl/` y el `init.js` del servidor **no pertenecen al paquete de OpenWebRX**
  (`dpkg -S` solo reconoce la carpeta y `init.js.sample`), así que una actualización de OpenWebRX no los borra.
- Este repositorio guarda el plugin y el script de instalación para poder reinstalarlo siempre.

## Archivos

| Archivo | Para qué |
|---|---|
| `botones_ea7cl.js` | El plugin. |
| `scripts/botones-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade `Plugins.load('botones_ea7cl');` a `init.js` si falta. |
| `scripts/botones-uninstall.sh` | Desinstala: quita la línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp botones_ea7cl/botones_ea7cl.js botones_ea7cl/scripts/botones-install.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/botones-install.sh'
```

## Desinstalar

```bash
scp botones_ea7cl/scripts/botones-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/botones-uninstall.sh'
```

Quita de `init.js` la línea de botones_ea7cl y aparta la carpeta del plugin; los botones vuelven al aspecto
de cada plugin. No borra nada: guarda `init.js` y la carpeta en `/home/ea7cl/desinstalado-botones_ea7cl-FECHA`
y al terminar dice la orden para volver a ponerlo. No uses la copia antigua de `init.js` del 24-oct para
quitarlo: se perderían los plugins añadidos después.
