#!/bin/bash
# Desinstala el plugin smeter_bandas (EA7CL): corrige la lectura del S-meter en perfiles concretos.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-smeter_bandas-FECHA.
# Uso:  sudo bash ~/smeter_bandas-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-smeter_bandas-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('smeter_bandas'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de smeter_bandas"

if [ -d "$D/smeter_bandas" ]; then
    mv "$D/smeter_bandas" "$BK/smeter_bandas"
    echo "Carpeta del plugin movida a $BK/smeter_bandas"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/smeter_bandas $D/"
