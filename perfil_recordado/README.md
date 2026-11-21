# perfil_recordado — vuelve al último perfil (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.3** (21-nov-2026), idéntica a la que funciona en el
servidor `openwebrx`.

## Qué hace

- Cada navegador recuerda el último perfil, frecuencia y modo que usó (`localStorage`, clave `ea7_perfil_recordado`).
- Al volver a abrir la web entra directamente en ese perfil (si fue hace menos de `DIAS` = 7 días).
- Si se corta la conexión (muy habitual en iPhone/iPad) y OpenWebRX+ reconecta, vuelve al mismo perfil y
  frecuencia en vez de al primero.
- Con `EVITAR_SDR_COMPARTIDO = true` no devuelve solo a un perfil de un SDR que tiene varios perfiles (🔻),
  para no mover ese SDR a otros oyentes al entrar.
- **Enlaces con frecuencia** (0.2/0.3): si alguien abre un enlace como `.../#freq=144975000,mod=nfm`, manda
  el enlace y no lo recordado. Si esa frecuencia no está en el perfil con el que se entra, salta al perfil
  que la cubre (con la lista `profiles.json` de [`profile_jump`](../profile_jump/)) y pone la frecuencia
  y el modo del enlace. F5 sigue igual, porque OpenWebRX deja en la dirección la frecuencia actual.
- Solo cuenta como **reconexión** si antes se cortó la conexión (0.3; antes, la primera apertura de la
  página también contaba como reconexión y por eso no se respetaba el enlace).

## Archivos

| Archivo | Para qué |
|---|---|
| `perfil_recordado.js` | El plugin. |
| `scripts/perfil_recordado-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (debajo de `Plugins.load('rig_skin');`, porque depende de rig_skin). |
| `scripts/perfil_recordado-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp perfil_recordado/perfil_recordado.js perfil_recordado/scripts/perfil_recordado-install.sh perfil_recordado/scripts/perfil_recordado-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/perfil_recordado-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp perfil_recordado/scripts/perfil_recordado-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/perfil_recordado-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-perfil_recordado-FECHA` y al terminar dice la orden para volver a ponerlo.
