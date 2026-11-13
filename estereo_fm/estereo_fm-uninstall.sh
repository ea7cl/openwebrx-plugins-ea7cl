#!/bin/bash
# Quita owrx-estereo y deja OpenWebRX como estaba. No borra las copias de seguridad
# (/var/backups/owrx-estereo/) ni el script (/usr/local/sbin/owrx-estereo, para volver a ponerlo).
exec bash "$(dirname "$(readlink -f "$0")")/owrx-estereo.sh" deshacer
