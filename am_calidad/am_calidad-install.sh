#!/bin/bash
# Instala am-calidad (AM con mejor sonido) en este OpenWebRX+. Explicación en README.md.
exec bash "$(dirname "$(readlink -f "$0")")/am-calidad.sh" aplicar
