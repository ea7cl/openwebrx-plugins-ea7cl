# smeter_bandas — corrección del S-meter por perfil (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.4**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

- Corrige **solo la lectura** del S-meter de rig_skin en perfiles concretos que marcan de más. La señal, la ganancia
  del SDR y el silenciador no cambian; solo lo que marca la aguja.
- rig_skin calibra el S-meter con `offset_hf` / `offset_vhf` (en `init.js`, `window.rig_skin_config`). Al entrar en
  uno de los perfiles de la lista `CORRECCION`, este plugin suma a ese offset la corrección en dB del perfil y al
  salir lo deja como estaba. 6 dB = 1 unidad S.
- Ahora corrige 27 MHz (−65 dB), 28 MHz (−60 dB) y 50-52 MHz (−30 dB), entre otros de la lista.

## Archivos

| Archivo | Para qué |
|---|---|
| `smeter_bandas.js` | El plugin. |
| `scripts/smeter_bandas-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (al final de `init.js`). |
| `scripts/smeter_bandas-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp smeter_bandas/smeter_bandas.js smeter_bandas/scripts/smeter_bandas-install.sh smeter_bandas/scripts/smeter_bandas-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/smeter_bandas-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp smeter_bandas/scripts/smeter_bandas-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/smeter_bandas-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-smeter_bandas-FECHA` y al terminar dice la orden para volver a ponerlo.
