# banderas_emoji — banderas en Chrome y Edge de Windows (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.1**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

- Chrome, Edge y demás navegadores basados en Chromium en Windows no dibujan las banderas emoji (🇪🇸 sale como «ES»).
- Solo en esos navegadores, carga una fuente pequeña con las banderas (Twemoji Country Flags, unos 77 kB, licencias
  MIT / CC-BY 4.0 de TalkJS y Twemoji) y la pone delante en los textos con banderas: perfiles, título, ventanas…
- La fuente **se descarga de internet** (`cdn.jsdelivr.net`); si ese sitio no responde, se siguen viendo las letras.
- La fuente solo se usa para las banderas; el resto del texto no cambia.

## Archivos

| Archivo | Para qué |
|---|---|
| `banderas_emoji.js` | El plugin. |
| `scripts/banderas_emoji-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (al final de `init.js`). |
| `scripts/banderas_emoji-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp banderas_emoji/banderas_emoji.js banderas_emoji/scripts/banderas_emoji-install.sh banderas_emoji/scripts/banderas_emoji-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/banderas_emoji-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp banderas_emoji/scripts/banderas_emoji-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/banderas_emoji-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-banderas_emoji-FECHA` y al terminar dice la orden para volver a ponerlo.
