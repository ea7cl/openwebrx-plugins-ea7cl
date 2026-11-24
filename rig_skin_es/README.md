# rig_skin_es — rig_skin en español (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.2** (24-nov-2026), la misma que funciona en el servidor.

## Qué hace

- Traduce al español los textos y las ayudas emergentes del aspecto **rig_skin** mientras se ven en pantalla.
- Las siglas habituales de un equipo (MUTE, SQL, RIT, NR, LOCK, SCAN, VFO, DX, SAT, WATCH…) se dejan como están.
- No modifica rig_skin: sus actualizaciones no borran la traducción. Un texto nuevo de una versión futura sale
  en inglés hasta añadirlo a la lista `TEXTOS` del plugin. Lo que rig_skin dibuja dentro de gráficos (canvas)
  no se puede traducir desde aquí.

## Archivos

| Archivo | Para qué |
|---|---|
| `rig_skin_es.js` | El plugin. |
| `scripts/rig_skin_es-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga a `init.js` si falta (debajo de `Plugins.load('rig_skin');`, porque depende de rig_skin). |
| `scripts/rig_skin_es-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp rig_skin_es/rig_skin_es.js rig_skin_es/scripts/rig_skin_es-install.sh rig_skin_es/scripts/rig_skin_es-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_skin_es-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp rig_skin_es/scripts/rig_skin_es-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/rig_skin_es-uninstall.sh'
```

No borra nada: guarda `init.js`, la carpeta del plugin y sus piezas de servidor en
`/home/ea7cl/desinstalado-rig_skin_es-FECHA` y al terminar dice la orden para volver a ponerlo.
