#!/bin/bash
# Instala o actualiza el plugin listeners (LST) versión EA7CL con copias de seguridad previas
set -e
D=/usr/lib/python3/dist-packages/htdocs/plugins/receiver
TS=$(date +%Y-%m-%d-%H%M)
SRC=/home/ea7cl
BK=/home/ea7cl/listeners.bak-$TS

if [ -d "$D/listeners" ]; then
    cp -a "$D/listeners" "$BK"
    echo "Copia de seguridad: $BK"
fi

mkdir -p "$D/listeners"
install -m 644 "$SRC/listeners.js" "$D/listeners/listeners.js"
install -m 644 "$SRC/listeners.css" "$D/listeners/listeners.css"
echo "Plugin copiado: $D/listeners/listeners.js y listeners.css"

if grep -q "Plugins.load('listeners')" "$D/init.js"; then
    echo "init.js ya cargaba listeners, no se toca"
else
    echo "AVISO: init.js no carga listeners; añade el bloque del README (Plugins.load + setup)"
fi

echo
echo "Para volver atras:"
echo "  sudo rm -r $D/listeners && sudo cp -a $BK $D/listeners"
