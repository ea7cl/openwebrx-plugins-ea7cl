# profile_jump — salta al perfil que cubre la frecuencia (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.4**. Copiado del servidor `openwebrx` el 3-nov-2026,
idéntico al que está funcionando (comprobado con SHA-256).

## Qué hace

- Cuando **rig_skin** (DX cluster, balizas, satélites…) intenta sintonizar una frecuencia que queda fuera del
  perfil actual, busca un perfil del receptor que la contenga (el más centrado), cambia a ese perfil y sintoniza.
- Si ningún perfil la cubre, deja actuar a rig_skin como siempre.
- Los receptores marcados con 🔻 solo se eligen como último recurso. Ojo: cambiar el perfil de un SDR con varios
  perfiles lo cambia también para quien esté escuchando en ese SDR.
- Pone los spots FT8/FT4 en su frecuencia de dial y en el modo digital de OpenWebRX+.
- También lo usa la ventana MEM de [scan_recordado](../scan_recordado/) para saltar a memorias de otros perfiles.
- No modifica rig_skin: solo envuelve su función `tuneTo`.

## Piezas en el servidor

- `profiles.json` (en la carpeta del plugin) lo genera `gen_profiles.py` a partir de `/var/lib/openwebrx/settings.json`:
  para cada perfil, su frecuencia central y su ancho. No escribe claves ni usuarios.
- El vigilante de systemd `gen-profiles.path` vuelve a ejecutarlo cada vez que cambia `settings.json`, es decir,
  al añadir o cambiar perfiles en Ajustes.
- `gen_profiles.py` vive en `/home/ea7cl`; los dos archivos de systemd en `/etc/systemd/system`.
  El instalador los pone, activa el vigilante y genera `profiles.json`; el desinstalador los para y los aparta.

## Archivos

| Archivo | Para qué |
|---|---|
| `profile_jump.js` | El plugin. |
| `servidor/gen_profiles.py` | Genera `profiles.json`. Va en `/home/ea7cl`. |
| `servidor/gen-profiles.path` / `.service` | Vigilante de systemd que lo regenera cuando cambian los perfiles. |
| `scripts/profile_jump-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (debajo de `Plugins.load('rig_skin');`, porque depende de rig_skin). |
| `scripts/profile_jump-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp profile_jump/profile_jump.js profile_jump/scripts/profile_jump-*.sh profile_jump/servidor/* openwebrx:~/
ssh -t openwebrx 'sudo bash ~/profile_jump-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp profile_jump/scripts/profile_jump-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/profile_jump-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-profile_jump-FECHA` y al terminar dice la orden para volver a ponerlo.
