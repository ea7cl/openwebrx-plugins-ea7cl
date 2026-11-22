#!/bin/bash
# Quita audio_dsp o lo devuelve a una copia anterior.
#   sudo bash ~/audio_dsp-uninstall.sh                      -> quita audio_dsp (lo aparta, no borra nada)
#   sudo bash ~/audio_dsp-uninstall.sh /var/backups/audio_dsp/FECHA   -> vuelve a esa copia (init.js y carpeta)
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-audio_dsp-$TS}
COPIA="$1"

mkdir -p "$BK"
cp -a "$D/init.js" "$BK/init.js"
[ -d "$D/audio_dsp" ] && mv "$D/audio_dsp" "$BK/audio_dsp"
echo "Lo que había, apartado en $BK"

if [ -n "$COPIA" ]; then
    [ -f "$COPIA/init.js" ] || { echo "En $COPIA no hay init.js; no sigo (lo de antes está en $BK)" >&2; exit 1; }
    cp -a "$COPIA/init.js" "$D/init.js"
    [ -d "$COPIA/audio_dsp" ] && cp -a "$COPIA/audio_dsp" "$D/audio_dsp"
    echo "Repuesta la copia $COPIA"
else
    sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('audio_dsp'\);/d" "$D/init.js"
    echo "Quitada de init.js la carga de audio_dsp"
fi

echo
echo "Hecho. Ctrl+F5 en el navegador."
echo "Para volver a dejarlo como estaba hace un momento:"
echo "  sudo cp -a $BK/init.js $D/init.js && sudo rm -rf $D/audio_dsp && sudo cp -a $BK/audio_dsp $D/"
