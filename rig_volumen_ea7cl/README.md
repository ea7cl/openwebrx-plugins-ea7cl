# rig_volumen_ea7cl — todo el volumen del receptor (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.6**. Instalado en el servidor `openwebrx` el 16-nov-2026,
idéntico al de este repositorio.

Todo lo del volumen del receptor está en este plugin; ningún otro plugin EA7CL toca el volumen. La tecla
MUTE es la de rig_skin, sin cambios. El VOL del SUB del doble receptor copia este comportamiento.

## Qué hace

- Añade al frontal del equipo de **rig_skin** una barra deslizante de volumen, para no depender de la sección CONTROLES.
- Pulsar «VOL» silencia o activa el audio, igual que MUTE; en MUTE el letrero pasa a «MUTE» en rojo.
- **MUTE sin mover las barras** (tecla MUTE, VOL o el altavoz de CONTROLES): se quedan donde estaban y al quitar
  el MUTE vuelve ese volumen. Moverlas en MUTE cambia el volumen al que volverá, sin quitar el MUTE.
- **Rueda del ratón** en las dos barras (VOL y CONTROLES): un paso por golpe, también en MUTE; la página no se desplaza.
- Las dos barras marcan siempre lo mismo, al momento. No modifica rig_skin ni OpenWebRX.

## Archivos

| Archivo | Para qué |
|---|---|
| `rig_volumen_ea7cl.js` | El plugin. |
| `scripts/rig_volumen_ea7cl-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (debajo de `Plugins.load('rig_skin');`, porque depende de rig_skin). |
| `scripts/rig_volumen_ea7cl-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp rig_volumen_ea7cl/rig_volumen_ea7cl.js rig_volumen_ea7cl/scripts/rig_volumen_ea7cl-install.sh rig_volumen_ea7cl/scripts/rig_volumen_ea7cl-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_volumen_ea7cl-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp rig_volumen_ea7cl/scripts/rig_volumen_ea7cl-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_volumen_ea7cl-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-rig_volumen_ea7cl-FECHA` y al terminar dice la orden para volver a ponerlo.
