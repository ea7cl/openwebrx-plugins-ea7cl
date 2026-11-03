# anti_iframe — aviso si incrustan el receptor (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.1**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

- Si otra web muestra el receptor dentro de la suya (un iframe), intenta abrirlo en su dirección original y,
  si no puede, tapa la página con el aviso «Este receptor es de EA7CL» y un enlace a la dirección buena.
- Las webs a las que sí se permite incrustarlo se ponen en `permitidos` dentro del plugin (ahora ninguna).
- En la web normal no hace nada.

## Archivos

| Archivo | Para qué |
|---|---|
| `anti_iframe.js` | El plugin. |
| `scripts/anti_iframe-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (al final de `init.js`). |
| `scripts/anti_iframe-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp anti_iframe/anti_iframe.js anti_iframe/scripts/anti_iframe-install.sh anti_iframe/scripts/anti_iframe-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/anti_iframe-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp anti_iframe/scripts/anti_iframe-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/anti_iframe-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-anti_iframe-FECHA` y al terminar dice la orden para volver a ponerlo.
