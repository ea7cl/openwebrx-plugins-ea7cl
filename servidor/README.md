# servidor (EA7CL)

Configuración y scripts del servidor que no pertenecen a un plugin concreto.

| Archivo | Ruta en el servidor | Qué hace |
|---|---|---|
| `init.js` | `/usr/lib/python3/dist-packages/htdocs/plugins/receiver/init.js` | Carga de todos los plugins del receptor. |
| `scripts/dablin` | `/usr/local/bin/dablin` | Envoltorio de dablin que ajusta la frecuencia de muestreo de cada emisora DAB/DAB+. |
| `scripts/filtro_detector.py` | `/usr/local/sbin/filtro_detector.py` | Filtro delante de parse2ban: decide qué avisos del detector se bloquean. |
| `scripts/bloquear_redes.sh` | `/home/ea7cl/bloquear_redes.sh` | Bloquea redes enteras por número de AS con ipset. |

No se suben la lista blanca de parse2ban ni las listas generadas en `/home/ea7cl/redes_bloqueadas`.
