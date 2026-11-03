# rig_dx_spotter — mejoras del DX CLUSTER (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.61**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

Mejora la lista de la ventana DX CLUSTER de **rig_skin**:
- columna con el indicativo de quien pone el spot («de EA4XX»);
- botones **EU / TODOS**: solo spots anunciados desde Europa, o todos;
- selector de **BANDA** para ver solo los spots de una banda sin mover el dial;
- botón **COMENT**: el comentario de cada spot al final de su línea (abreviado si no cabe, entero al pasar el ratón);
- cada modo con su color (CW amarillo, SSB rosa, FT8 cian, FT4 azul, digitales violeta, FM rojo; la fila escuchada
  en verde). Si el cluster no trae el modo, se deduce del comentario o del plan de bandas IARU R1 y al pulsar se
  sintoniza en ese modo.

Usa los spots que ya recibe rig_skin y consulta HolyCluster solo para saber de qué continente es cada anunciante.
Las preferencias de cada oyente se guardan en su navegador. No modifica rig_skin.

## Archivos

| Archivo | Para qué |
|---|---|
| `rig_dx_spotter.js` | El plugin. |
| `scripts/rig_dx_spotter-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (debajo de `Plugins.load('rig_skin');`, porque depende de rig_skin). |
| `scripts/rig_dx_spotter-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp rig_dx_spotter/rig_dx_spotter.js rig_dx_spotter/scripts/rig_dx_spotter-install.sh rig_dx_spotter/scripts/rig_dx_spotter-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_dx_spotter-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp rig_dx_spotter/scripts/rig_dx_spotter-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_dx_spotter-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-rig_dx_spotter-FECHA` y al terminar dice la orden para volver a ponerlo.
