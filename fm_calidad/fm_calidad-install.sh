#!/bin/bash
# Instala fm-calidad (FM de V-UHF con mejor sonido) en este OpenWebRX+. Explicación en README.md.
exec bash "$(dirname "$(readlink -f "$0")")/fm-calidad.sh" aplicar
