#!/bin/bash
# Instala o actualiza el plugin rig_dx_spotter (EA7CL): mejoras de la ventana DX CLUSTER de rig_skin.
# Copiar antes al servidor:  scp rig_dx_spotter/rig_dx_spotter.js rig_dx_spotter/scripts/rig_dx_spotter-install.sh rig_dx_spotter/scripts/rig_dx_spotter-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/rig_dx_spotter-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/rig_dx_spotter/rig_dx_spotter.js" ]; then
    cp -a "$D/rig_dx_spotter/rig_dx_spotter.js" "$SRC/rig_dx_spotter.js.bak-$TS"
    echo "Copia de seguridad: $SRC/rig_dx_spotter.js.bak-$TS"
fi

mkdir -p "$D/rig_dx_spotter"
install -m 644 "$SRC/rig_dx_spotter.js" "$D/rig_dx_spotter/rig_dx_spotter.js"
echo "Plugin copiado: $D/rig_dx_spotter/rig_dx_spotter.js"

LINEA="Plugins.load('rig_dx_spotter');   // EA7CL: mejoras de la ventana DX CLUSTER de rig_skin"
if grep -qE "^[[:space:]]*Plugins\.load\('rig_dx_spotter'\);" "$D/init.js"; then
    echo "init.js ya cargaba rig_dx_spotter, no se toca"
elif grep -qE "^[[:space:]]*Plugins\.load\('rig_skin'\);" "$D/init.js"; then
    # depende de rig_skin: va justo debajo de su carga
    sed -i -E "0,/^[[:space:]]*Plugins\.load\('rig_skin'\);/{/^[[:space:]]*Plugins\.load\('rig_skin'\);/a $LINEA
}" "$D/init.js"
    echo "Añadida a init.js, debajo de rig_skin: $LINEA"
else
    echo "ERROR: init.js no carga rig_skin, del que depende este plugin; no se toca init.js" >&2
    exit 1
fi

echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/rig_dx_spotter-uninstall.sh"
