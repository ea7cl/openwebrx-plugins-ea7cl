#!/bin/bash
# Instala o actualiza el plugin botones_ea7cl con copias de seguridad previas
set -e
D=/usr/lib/python3/dist-packages/htdocs/plugins/receiver
TS=$(date +%Y-%m-%d-%H%M)
SRC=/home/ea7cl/botones_ea7cl.js

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/botones_ea7cl/botones_ea7cl.js" ]; then
    cp -a "$D/botones_ea7cl/botones_ea7cl.js" "/home/ea7cl/botones_ea7cl.js.bak-$TS"
    echo "Copia de seguridad: /home/ea7cl/botones_ea7cl.js.bak-$TS"
fi

mkdir -p "$D/botones_ea7cl"
install -m 644 "$SRC" "$D/botones_ea7cl/botones_ea7cl.js"
echo "Plugin copiado: $D/botones_ea7cl/botones_ea7cl.js"

if grep -q "Plugins.load('botones_ea7cl')" "$D/init.js"; then
    echo "init.js ya cargaba botones_ea7cl, no se toca"
else
    printf "Plugins.load('botones_ea7cl');\n" >> "$D/init.js"
    echo "Añadida a init.js: Plugins.load('botones_ea7cl');"
fi

echo
echo "Para volver atras:"
echo "  sudo cp -a $D/init.js.bak-$TS $D/init.js && sudo rm -r $D/botones_ea7cl"
