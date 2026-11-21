#!/bin/bash
# Quita am-calidad y deja OpenWebRX como estaba. No borra las copias de seguridad
# (/var/backups/owrx-amcalidad/) ni el script (/usr/local/sbin/am-calidad, para volver a ponerla).
exec bash "$(dirname "$(readlink -f "$0")")/am-calidad.sh" deshacer
