#!/bin/bash
# Instala el plugin autozoom con copia de seguridad previa de init.js
set -e
D=/usr/lib/python3/dist-packages/htdocs/plugins/receiver
TS=$(date +%Y-%m-%d-%H%M)
SRC=/home/ea7cl/autozoom.js

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

mkdir -p "$D/autozoom"
install -m 644 "$SRC" "$D/autozoom/autozoom.js"
echo "Plugin copiado: $D/autozoom/autozoom.js"

if grep -q "Plugins.load('autozoom')" "$D/init.js"; then
    echo "init.js ya cargaba autozoom, no se toca"
else
    printf "\nPlugins.load('autozoom');\n" >> "$D/init.js"
    echo "Añadida a init.js: Plugins.load('autozoom');"
fi

echo
echo "Para volver atras:"
echo "  sudo cp -a $D/init.js.bak-$TS $D/init.js && sudo rm -r $D/autozoom"
