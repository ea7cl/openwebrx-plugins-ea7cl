# rig_zoom — escala del panel de rig_skin (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.1**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

- Reduce (o amplía) a escala el panel del equipo de **rig_skin**: todo se ve igual, pero ocupa menos pantalla.
- La escala se cambia en `ESCALA` dentro del plugin (1 = tamaño original, 0.75 = 75 %; ahora está en 0.75).
- No modifica rig_skin.

**Ahora no se carga:** en el `init.js` del servidor su línea está comentada (`// Plugins.load('rig_zoom');`).
Instalarlo lo activa; el desinstalador quita también la línea comentada.

## Archivos

| Archivo | Para qué |
|---|---|
| `rig_zoom.js` | El plugin. |
| `scripts/rig_zoom-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (debajo de `Plugins.load('rig_skin');`, porque depende de rig_skin). |
| `scripts/rig_zoom-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp rig_zoom/rig_zoom.js rig_zoom/scripts/rig_zoom-install.sh rig_zoom/scripts/rig_zoom-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_zoom-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp rig_zoom/scripts/rig_zoom-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_zoom-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-rig_zoom-FECHA` y al terminar dice la orden para volver a ponerlo.
