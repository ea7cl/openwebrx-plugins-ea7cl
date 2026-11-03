#!/bin/bash
# Desinstala el plugin meteo_letrero (EA7CL): letrero con el tiempo de la estación Davis.
# No borra nada: guarda init.js y la carpeta del plugin, la tarea de cada minuto y meteo_copia.py en /home/ea7cl/desinstalado-meteo_letrero-FECHA.
# Uso:  sudo bash ~/meteo_letrero-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-meteo_letrero-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

# tarea de cada minuto que escribe datos.json, y su script
CRON=${CRON:-/etc/cron.d}
H=${H:-/home/ea7cl}
if [ -f "$CRON/meteo_letrero" ]; then
    mv "$CRON/meteo_letrero" "$BK/meteo_letrero.cron"
    echo "Tarea de cada minuto quitada"
fi
if [ -f "$H/meteo_copia.py" ]; then mv "$H/meteo_copia.py" "$BK/"; fi
sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('meteo_letrero'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de meteo_letrero"

if [ -d "$D/meteo_letrero" ]; then
    mv "$D/meteo_letrero" "$BK/meteo_letrero"
    echo "Carpeta del plugin movida a $BK/meteo_letrero"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/meteo_letrero $D/ && sudo mv $BK/meteo_copia.py $H/ && sudo mv $BK/meteo_letrero.cron $CRON/meteo_letrero"
