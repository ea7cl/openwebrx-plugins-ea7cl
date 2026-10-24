#!/bin/bash
# Actualiza el plugin autozoom con copia de seguridad previa
set -e
D=/usr/lib/python3/dist-packages/htdocs/plugins/receiver/autozoom
TS=$(date +%Y-%m-%d-%H%M)
SRC=/home/ea7cl/autozoom.js
BK=/home/ea7cl/autozoom.js.bak-$TS

cp -a "$D/autozoom.js" "$BK"
echo "Copia de seguridad: $BK"

install -m 644 "$SRC" "$D/autozoom.js"
echo "Plugin actualizado: $D/autozoom.js"

echo
echo "Para volver atras:"
echo "  sudo cp $BK $D/autozoom.js"
