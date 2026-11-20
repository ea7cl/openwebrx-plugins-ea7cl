# rig_skin 0.10.20 parcheado (EA7CL)

Copia del plugin [rig_skin](https://github.com/aganet/openwebrxplus-rig-skin) **0.10.20** tal como está en el
servidor, con los cambios EA7CL ya aplicados (`rig_skin.js`, `rig_skin.css`, `rig_skin_map.js`).

| Archivo | Qué hace |
|---|---|
| `scripts/actualizar_rig_skin.sh` | Copia de seguridad de los plugins, actualiza rig_skin con el actualizador oficial y aplica los parches. |
| `scripts/parches_rig_skin.sh` | Cambios propios que hay que repetir tras cada actualización (órbitas SAT en español, VFO con 10 Hz, frecuencias largas). Se puede repetir sin duplicar nada. |

En el servidor los scripts están en `/home/ea7cl/`.

`rig_skin.js` lleva también los tres enganches `DOPPLER_AUTOSTART_HOOK` de [doppler_autostart](../doppler_autostart/). Avisan al Doppler al elegir un satélite en la ventana SAT. Los pone `doppler_autostart/scripts/patch.py`, y `update-rig-skin.sh` los vuelve a poner después de cada actualización.
