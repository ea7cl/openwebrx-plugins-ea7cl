#!/bin/bash
# Desinstala el plugin listeners (LST): quita de init.js la carga y su bloque setup({...}) y aparta la carpeta.
# No borra nada: guarda init.js y la carpeta del plugin en /home/ea7cl/desinstalado-listeners-FECHA.
# Uso:  sudo bash ~/listeners-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-listeners-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

# el bloque "await Plugins.listeners.setup({" ... hasta su "});", y la línea que carga el plugin
sed -i -E \
    -e "/^[[:space:]]*(await[[:space:]]+)?Plugins\.listeners\.setup\(\{/,/^[[:space:]]*\}\);/d" \
    -e "/^[[:space:]]*(await[[:space:]]+)?Plugins\.load\('listeners'\);/d" \
    "$D/init.js"
echo "Quitada de init.js la carga de listeners y su configuración"

if [ -d "$D/listeners" ]; then
    mv "$D/listeners" "$BK/listeners"
    echo "Carpeta del plugin movida a $BK/listeners"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/listeners $D/"
