# mi_ip — tarjeta con la IP del oyente (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.2**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

- Sustituye en la cabecera desplegable el recuadro de wieistmeineip.de (dejó de funcionar en octubre de 2026) por
  una tarjeta propia con la IP del oyente, su país con bandera, la ciudad, el navegador y el idioma.
- La IP y el país los da el primer servicio que responda: geojs, ipwho.is o country.is (los mismos que usa LST).
  El navegador y el idioma salen del propio navegador.
- No hace falta tocar la configuración: busca el recuadro antiguo y se pone en su sitio, también cuando OpenWebRX
  vuelve a escribir la cabecera.

## Archivos

| Archivo | Para qué |
|---|---|
| `mi_ip.js` | El plugin. |
| `scripts/mi_ip-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (al final de `init.js`). |
| `scripts/mi_ip-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp mi_ip/mi_ip.js mi_ip/scripts/mi_ip-install.sh mi_ip/scripts/mi_ip-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/mi_ip-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp mi_ip/scripts/mi_ip-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/mi_ip-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-mi_ip-FECHA` y al terminar dice la orden para volver a ponerlo.
