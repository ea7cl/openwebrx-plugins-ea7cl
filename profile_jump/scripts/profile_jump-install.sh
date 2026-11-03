#!/bin/bash
# Instala o actualiza el plugin profile_jump (EA7CL): cambia al perfil que cubre la frecuencia pedida por rig_skin.
# Copiar antes al servidor:  scp profile_jump/profile_jump.js profile_jump/scripts/profile_jump-*.sh profile_jump/servidor/* openwebrx:~/
# Uso:  sudo bash ~/profile_jump-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/profile_jump/profile_jump.js" ]; then
    cp -a "$D/profile_jump/profile_jump.js" "$SRC/profile_jump.js.bak-$TS"
    echo "Copia de seguridad: $SRC/profile_jump.js.bak-$TS"
fi

mkdir -p "$D/profile_jump"
install -m 644 "$SRC/profile_jump.js" "$D/profile_jump/profile_jump.js"
echo "Plugin copiado: $D/profile_jump/profile_jump.js"

LINEA="Plugins.load('profile_jump');   // EA7CL: cambia al perfil que cubre la frecuencia pedida por rig_skin"
if grep -qE "^[[:space:]]*Plugins\.load\('profile_jump'\);" "$D/init.js"; then
    echo "init.js ya cargaba profile_jump, no se toca"
elif grep -qE "^[[:space:]]*Plugins\.load\('rig_skin'\);" "$D/init.js"; then
    # depende de rig_skin: va justo debajo de su carga
    sed -i -E "0,/^[[:space:]]*Plugins\.load\('rig_skin'\);/{/^[[:space:]]*Plugins\.load\('rig_skin'\);/a $LINEA
}" "$D/init.js"
    echo "Añadida a init.js, debajo de rig_skin: $LINEA"
else
    echo "ERROR: init.js no carga rig_skin, del que depende este plugin; no se toca init.js" >&2
    exit 1
fi

# profiles.json: gen_profiles.py lo genera y el vigilante gen-profiles.path lo
# regenera cada vez que cambian los perfiles (settings.json)
SD=${SD:-/etc/systemd/system}
chmod 755 "$SRC/gen_profiles.py"
install -m 644 "$SRC/gen-profiles.path" "$SRC/gen-profiles.service" "$SD/"
systemctl daemon-reload
systemctl enable --now gen-profiles.path
python3 "$SRC/gen_profiles.py"
echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/profile_jump-uninstall.sh"
