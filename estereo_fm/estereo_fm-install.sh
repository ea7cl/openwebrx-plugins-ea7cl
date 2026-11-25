#!/bin/bash
# Instala owrx-estereo (FM, DAB y DRM en estéreo) en este OpenWebRX+. Explicación en README.md.
exec bash "$(dirname "$(readlink -f "$0")")/owrx-estereo.sh" aplicar
