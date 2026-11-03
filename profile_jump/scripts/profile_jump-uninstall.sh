#!/bin/bash
# Desinstala el plugin profile_jump (EA7CL): cambia al perfil que cubre la frecuencia pedida por rig_skin.
# No borra nada: guarda init.js y la carpeta del plugin, el vigilante gen-profiles y gen_profiles.py en /home/ea7cl/desinstalado-profile_jump-FECHA.
# Uso:  sudo bash ~/profile_jump-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-profile_jump-$TS}

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
echo "Copia de seguridad: $BK/init.js"

# vigilante que regenera profiles.json, y su generador
SD=${SD:-/etc/systemd/system}
H=${H:-/home/ea7cl}
if [ -f "$SD/gen-profiles.path" ]; then
    systemctl disable --now gen-profiles.path || true
    mv "$SD/gen-profiles.path" "$SD/gen-profiles.service" "$BK/" 2>/dev/null || true
    systemctl daemon-reload
    echo "Vigilante gen-profiles.path parado y quitado"
fi
if [ -f "$H/gen_profiles.py" ]; then mv "$H/gen_profiles.py" "$BK/"; fi
sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('profile_jump'\);/d" "$D/init.js"
echo "Quitada de init.js la carga de profile_jump"

if [ -d "$D/profile_jump" ]; then
    mv "$D/profile_jump" "$BK/profile_jump"
    echo "Carpeta del plugin movida a $BK/profile_jump"
fi

echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo mv $BK/profile_jump $D/ && sudo mv $BK/gen_profiles.py $H/ && sudo mv $BK/gen-profiles.path $BK/gen-profiles.service $SD/ && sudo systemctl daemon-reload && sudo systemctl enable --now gen-profiles.path"
