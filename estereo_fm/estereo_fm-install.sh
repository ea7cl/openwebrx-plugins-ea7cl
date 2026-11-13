#!/bin/bash
# Instala owrx-estereo (FM y DAB en estéreo) en este OpenWebRX+. Explicación en README.md.
exec bash "$(dirname "$(readlink -f "$0")")/owrx-estereo.sh" aplicar
