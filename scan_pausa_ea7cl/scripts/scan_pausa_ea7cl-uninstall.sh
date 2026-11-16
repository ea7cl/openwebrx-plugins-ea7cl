#!/bin/bash
# Desinstala el plugin scan_pausa_ea7cl (EA7CL): SCAN con pausa de 5 s.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-scan_pausa_ea7cl-FECHA.
# Uso:  sudo bash ~/scan_pausa_ea7cl-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-scan_pausa_ea7cl-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('scan_pausa_ea7cl'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de scan_pausa_ea7cl"

if [ -d "$D/scan_pausa_ea7cl" ]; then
    mv "$D/scan_pausa_ea7cl" "$BK/scan_pausa_ea7cl"
    echo "Carpeta del plugin movida a $BK/scan_pausa_ea7cl"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/scan_pausa_ea7cl $D/"
