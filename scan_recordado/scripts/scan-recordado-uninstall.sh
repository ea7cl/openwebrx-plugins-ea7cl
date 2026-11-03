#!/bin/bash
# Desinstala el plugin scan_recordado (ventana MEM) y el vigilante que regenera memorias.json.
# No borra nada: guarda init.js, la carpeta del plugin y el generador en /home/ea7cl/desinstalado-scan_recordado-FECHA.
# Las elecciones de cada oyente siguen en su navegador, pero ya nadie las usa.
# Uso:  sudo bash ~/scan-recordado-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-scan_recordado-$TS}
U=scan-recordado-memorias
SD=${SD:-/etc/systemd/system}
H=${H:-/home/ea7cl}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

# vigilante de systemd
if [ -f "$SD/$U.path" ]; then
    systemctl disable --now "$U.path" || true
    mv "$SD/$U.path" "$SD/$U.service" "$BK/" 2>/dev/null || true
    systemctl daemon-reload
    echo "Vigilante $U.path parado y quitado"
fi
if [ -f "$H/gen_memorias.py" ]; then mv "$H/gen_memorias.py" "$BK/"; fi

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('scan_recordado'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de scan_recordado"

if [ -d "$D/scan_recordado" ]; then
    mv "$D/scan_recordado" "$BK/scan_recordado"
    echo "Carpeta del plugin movida a $BK/scan_recordado"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador (puede tardar hasta una hora en desaparecer en otros navegadores)."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/scan_recordado $D/ && sudo mv $BK/gen_memorias.py $H/ \\"
echo "    && sudo mv $BK/$U.path $BK/$U.service $SD/ && sudo systemctl daemon-reload && sudo systemctl enable --now $U.path"
