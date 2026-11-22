#!/bin/bash
# Instala o actualiza audio_dsp 2.4 + EA7CL (botón IA: NR con red neuronal RNNoise).
# Copiar antes al servidor:
#   scp audio_dsp/audio_dsp.js audio_dsp/audio_dsp.css audio_dsp/rnnoise.wasm audio_dsp/RNNOISE-LICENSE.txt audio_dsp/scripts/audio_dsp-*.sh openwebrx:~/
# Uso:  sudo bash ~/audio_dsp-install.sh
# La IA, el NR, el NB y el LMS solo funcionan si el receptor se abre por https (ver carpeta https/).
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
COPIAS=${COPIAS:-/var/backups/audio_dsp}
TS=$(date +%Y-%m-%d-%H%M)
ARCHIVOS="audio_dsp.js audio_dsp.css rnnoise.wasm RNNOISE-LICENSE.txt"

for f in $ARCHIVOS; do
    [ -f "$SRC/$f" ] || { echo "Falta $SRC/$f: cópialo antes al servidor" >&2; exit 1; }
done
[ -f "$D/init.js" ] || { echo "No encuentro $D/init.js" >&2; exit 1; }

mkdir -p "$COPIAS/$TS"
cp -a "$D/init.js" "$COPIAS/$TS/init.js"
if [ -d "$D/audio_dsp" ]; then cp -a "$D/audio_dsp" "$COPIAS/$TS/audio_dsp"; fi
echo "Copia de seguridad: $COPIAS/$TS"

mkdir -p "$D/audio_dsp"
for f in $ARCHIVOS; do
    install -m 644 "$SRC/$f" "$D/audio_dsp/$f"
    echo "Copiado: $D/audio_dsp/$f"
done

if grep -qE "^[[:space:]]*Plugins\.load\('audio_dsp'\);" "$D/init.js"; then
    echo "init.js ya cargaba audio_dsp, no se toca"
elif grep -qE "Plugins\.load\('utils'\)\.then\(" "$D/init.js"; then
    # audio_dsp necesita utils: se carga dentro de su bloque
    sed -i -E "0,/Plugins\.load\('utils'\)\.then\(.*$/s//&\n    Plugins.load('audio_dsp');   \/\/ EA7CL: ecualizador, filtros y NR con IA/" "$D/init.js"
    echo "Añadida a init.js, dentro del bloque de utils: Plugins.load('audio_dsp');"
else
    [ -n "$(tail -c1 "$D/init.js")" ] && echo >> "$D/init.js"
    echo "Plugins.load('utils').then(function () { Plugins.load('audio_dsp'); });   // EA7CL: audio_dsp necesita utils" >> "$D/init.js"
    echo "AVISO: init.js no cargaba utils; añadida al final la carga de utils y audio_dsp"
fi

echo
echo "Listo. Ctrl+F5 en el navegador. Abre el receptor por https para usar el botón IA."
echo "Para volver a como estaba: sudo bash ~/audio_dsp-uninstall.sh $COPIAS/$TS"
