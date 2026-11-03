#!/bin/bash
# Desinstala el plugin banderas_emoji (EA7CL): banderas emoji en Chrome y Edge de Windows.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-banderas_emoji-FECHA.
# Uso:  sudo bash ~/banderas_emoji-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-banderas_emoji-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('banderas_emoji'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de banderas_emoji"

if [ -d "$D/banderas_emoji" ]; then
    mv "$D/banderas_emoji" "$BK/banderas_emoji"
    echo "Carpeta del plugin movida a $BK/banderas_emoji"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/banderas_emoji $D/"
