#!/bin/bash
# Quita tetra-mejorado y deja OpenWebRX como estaba. No borra las copias de seguridad
# (/var/backups/owrx-tetramejorado/) ni el script (/usr/local/sbin/tetra-mejorado, para volver a ponerlo).
exec bash "$(dirname "$(readlink -f "$0")")/tetra-mejorado.sh" deshacer
