#!/bin/bash
# Quita fm-calidad y deja OpenWebRX como estaba. No borra las copias de seguridad
# (/var/backups/owrx-fmcalidad/) ni el script (/usr/local/sbin/fm-calidad, para volver a ponerla).
exec bash "$(dirname "$(readlink -f "$0")")/fm-calidad.sh" deshacer
