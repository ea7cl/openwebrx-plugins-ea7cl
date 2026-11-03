#!/bin/bash
# Desinstala el plugin rig_skin_es (EA7CL): traduce al español los textos de rig_skin.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-rig_skin_es-FECHA.
# Uso:  sudo bash ~/rig_skin_es-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-rig_skin_es-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('rig_skin_es'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de rig_skin_es"

if [ -d "$D/rig_skin_es" ]; then
    mv "$D/rig_skin_es" "$BK/rig_skin_es"
    echo "Carpeta del plugin movida a $BK/rig_skin_es"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/rig_skin_es $D/"
