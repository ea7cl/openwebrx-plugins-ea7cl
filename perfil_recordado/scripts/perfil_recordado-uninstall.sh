#!/bin/bash
# Desinstala el plugin perfil_recordado (EA7CL): cada navegador vuelve a su último perfil, frecuencia y modo.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-perfil_recordado-FECHA.
# Uso:  sudo bash ~/perfil_recordado-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-perfil_recordado-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('perfil_recordado'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de perfil_recordado"

if [ -d "$D/perfil_recordado" ]; then
    mv "$D/perfil_recordado" "$BK/perfil_recordado"
    echo "Carpeta del plugin movida a $BK/perfil_recordado"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/perfil_recordado $D/"
