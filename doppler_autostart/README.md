# doppler_autostart — Doppler automático desde SAT y DOP (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.6**. Se instaló en el servidor `openwebrx` el 20-nov-2026 y es idéntico al de este repositorio (comprobado con SHA-256). Necesita `rig_skin` (con los enganches de `scripts/patch.py`) y el plugin `doppler` de 0xAF.

## Qué hace

- **Sintoniza y arranca el seguimiento Doppler** al elegir un satélite desde cualquiera de estos tres sitios:
  - la ventana **SAT** de arriba;
  - la **pantalla de pases** del panel de control (tecla SAT de abajo);
  - la lista de la ventana **DOP**.

  La frecuencia y el modo de cada satélite salen de la lista de satélites de rig_skin. Los datos de la órbita vienen de CelesTrak.
- **El Doppler arranca cuando el receptor ya ha llegado** a la frecuencia del satélite, porque toma como base la frecuencia que hay al arrancar.
- **El nombre y el número (Sat ID) se ven desde el primer momento**, por ejemplo «PO-101: esperando a que llegue el receptor...». Después pasa a «PO-101 (DIWATA-2B)», el nombre de SAT y el de CelesTrak.
- **Sonido siempre abierto con los satélites.** Al elegir un satélite se quita el silenciador (SQ al mínimo, «SQL off») y se mantiene abierto mientras dura el seguimiento. Al parar, el SQ vuelve a funcionar con normalidad.
- **El botón DOP se enciende en verde** mientras hay seguimiento, como LST y MEM. Usa el `data-on` de `botones_ea7cl`.
- **El Doppler se para solo** en cuanto sintonizas otra cosa (clic en la cascada, DX, bandas, rueda o cambio de perfil), con el aviso «Doppler parado: …».
- **TRACK ya no se queda enganchado.** El plugin doppler no paraba el seguimiento anterior al arrancar otro, así que STOP paraba uno y el otro seguía tirando de la frecuencia. Ahora nunca hay dos a la vez.
- Si el satélite elegido en DOP no está en la lista de SAT, avisa: «no está en la lista de SAT; sintoniza a mano y pulsa TRACK».
- **Con el doble receptor** (si está cargado), actúa sobre el receptor marcado. Con el SUB marcado, la ventana DOP enseña y maneja el Doppler del SUB («SUB: …»). Sin doble receptor no cambia nada.

## Archivos

| Archivo | Para qué |
|---|---|
| `doppler_autostart.js` | El plugin (0.6). |
| `scripts/doppler_autostart.sh` | `estado` / `aplicar` / `deshacer`. Pone esta versión sobre una 0.1 o posterior, guarda copia con SHA-256 en `/var/backups/doppler-autostart/FECHA` y `deshacer` vuelve a la copia más reciente. |
| `scripts/patch.py`, `scripts/reapply.sh` | Integración de la 0.1, con los mismos archivos que hay en el servidor dentro de `plugins/receiver/doppler_autostart/`. `patch.py` hace tres cosas: añade a `rig_skin.js` los enganches `DOPPLER_AUTOSTART_HOOK` (avisan con el evento `owrxplus:satellite-tuned` al elegir en la ventana SAT), añade `Plugins.load('doppler_autostart')` a `init.js` y hace que `update-rig-skin.sh` llame a `reapply.sh` para volver a ponerlos tras actualizar rig_skin. Antes de cambiar nada guarda copias `*.doppler-autostart.bak`. |
| `original/doppler_autostart.js` | La 0.1 original (SHA-256 `33a0f48c…`), para volver atrás. |

## Instalar o actualizar (servidor que ya tiene la 0.1)

```
cd openwebrx-plugins-ea7cl/doppler_autostart
sudo bash scripts/doppler_autostart.sh estado
sudo bash scripts/doppler_autostart.sh aplicar
sudo bash scripts/doppler_autostart.sh deshacer   # vuelve a la versión anterior
```

Después, Ctrl+F5 en el navegador. El instalador no sigue si el archivo que hay en el servidor no es la 0.1 conocida ni una 0.2 o posterior.

## Instalación desde cero

1. Copia `doppler_autostart.js` en `plugins/receiver/doppler_autostart/`, y `scripts/patch.py` y `scripts/reapply.sh` en esa misma carpeta.
2. En `init.js` tiene que estar el plugin doppler de 0xAF: `Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/doppler/doppler.js');`.
3. `sudo python3 plugins/receiver/doppler_autostart/patch.py`. Pone los enganches en rig_skin y la carga del plugin justo después del doppler.

`rig_skin/rig_skin.js` de este repositorio ya lleva los enganches.
