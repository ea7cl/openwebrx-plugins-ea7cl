#!/bin/bash
# Desinstala el plugin arreglo_modo_digital (EA7CL): modo digital nunca como modo base.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-arreglo_modo_digital-FECHA.
# Uso:  sudo bash ~/arreglo_modo_digital-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-arreglo_modo_digital-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('arreglo_modo_digital'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de arreglo_modo_digital"

if [ -d "$D/arreglo_modo_digital" ]; then
    mv "$D/arreglo_modo_digital" "$BK/arreglo_modo_digital"
    echo "Carpeta del plugin movida a $BK/arreglo_modo_digital"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/arreglo_modo_digital $D/"
