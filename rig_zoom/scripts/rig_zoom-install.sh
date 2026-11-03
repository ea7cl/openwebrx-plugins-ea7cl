#!/bin/bash
# Instala o actualiza el plugin rig_zoom (EA7CL): reduce o amplía a escala el panel de rig_skin.
# Copiar antes al servidor:  scp rig_zoom/rig_zoom.js rig_zoom/scripts/rig_zoom-install.sh rig_zoom/scripts/rig_zoom-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/rig_zoom-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/rig_zoom/rig_zoom.js" ]; then
    cp -a "$D/rig_zoom/rig_zoom.js" "$SRC/rig_zoom.js.bak-$TS"
    echo "Copia de seguridad: $SRC/rig_zoom.js.bak-$TS"
fi

mkdir -p "$D/rig_zoom"
install -m 644 "$SRC/rig_zoom.js" "$D/rig_zoom/rig_zoom.js"
echo "Plugin copiado: $D/rig_zoom/rig_zoom.js"

LINEA="Plugins.load('rig_zoom');   // EA7CL: reduce o amplía a escala el panel de rig_skin"
if grep -qE "^[[:space:]]*Plugins\.load\('rig_zoom'\);" "$D/init.js"; then
    echo "init.js ya cargaba rig_zoom, no se toca"
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
echo "Para quitarlo: sudo bash ~/rig_zoom-uninstall.sh"
