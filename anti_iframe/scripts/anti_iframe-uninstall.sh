#!/bin/bash
# Desinstala el plugin anti_iframe (EA7CL): avisa si el receptor se muestra incrustado en la web de otro.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-anti_iframe-FECHA.
# Uso:  sudo bash ~/anti_iframe-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-anti_iframe-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('anti_iframe'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de anti_iframe"

if [ -d "$D/anti_iframe" ]; then
    mv "$D/anti_iframe" "$BK/anti_iframe"
    echo "Carpeta del plugin movida a $BK/anti_iframe"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/anti_iframe $D/"
