# rig_skin 0.10.23 parcheado (EA7CL)

**rig_skin es obra de George Anestopoulos** (usuario [aganet](https://github.com/aganet) en GitHub;
en el código firma SV1DOD / HB9ISH). Proyecto original:
https://github.com/aganet/openwebrxplus-rig-skin (licencia MIT). Aquí solo están los cambios
propios de EA7CL encima de su trabajo.

Copia del plugin **0.10.23** tal como está en el servidor desde el 24-nov-2026, con los cambios
EA7CL ya aplicados (`rig_skin.js`, `rig_skin.css`, `rig_skin_map.js`).

## Cambios de EA7CL

1. DX de V/UHF solo hasta **800 km** (el original trae 2000).
2. Textos de las órbitas SAT y del aviso de versión **en español**.
3. VFO A/B a **10 Hz**, con las dos últimas cifras más pequeñas; frecuencias largas (QO-100,
   23 cm) con letra algo menor.
4. Panel con ampliación máxima 1 (`MAX_ZOOM = 1`).
5. Los tres enganches `DOPPLER_AUTOSTART_HOOK` de [doppler_autostart](../doppler_autostart/).
6. **Nuevo (parche 6):** si la página se abre con la lista de pases SAT abierta, rig_skin miraba
   la posición del receptor antes de que llegara del servidor y se quedaba en «receiver position
   not configured». Ahora vuelve a mirar a los 2 s.

DXSummit por `https://` ya viene de fábrica desde la 0.10.21.

## Scripts

| Archivo | Qué hace |
|---|---|
| `scripts/actualizar_rig_skin.sh` | Copia de seguridad de los plugins, actualiza rig_skin con el actualizador oficial, aplica los parches y vuelve a poner los enganches de Doppler (`doppler_autostart/reapply.sh`). |
| `scripts/parches_rig_skin.sh` | Cambios propios que hay que repetir tras cada actualización. Se puede repetir sin duplicar nada. |

En el servidor los scripts están en `/home/ea7cl/`.

## Plugins que acompañan a la 0.10.23

- [banderas_emoji](../banderas_emoji/) **0.2**: avisa a rig_skin de que sí se pintan banderas
  (desde la 0.10.22 rig_skin lo comprueba y, si no, pone «ES» en lugar de la bandera).
- [rig_skin_es](../rig_skin_es/) **0.2**: traduce los textos nuevos (flechas de los visores,
  «AUDIO SCOPE», ayuda del S-meter).
- [rig_dx_spotter](../rig_dx_spotter/) **0.62**: quita spots basura de la web de DXSummit y pone
  la bandera por el nombre del país.
