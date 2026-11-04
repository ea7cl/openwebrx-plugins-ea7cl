#!/bin/bash
# Desinstala el modo "Meshtastic Narrow" (EA7CL).
# Quita de modes.py, dsp.py y csdr/chain/lora.py solo lo que hay entre las marcas EA7CL,
# el plugin web, su línea de init.js y la memoria "meshtastic-narrow" del servidor.
# No borra nada: guarda antes todo en /home/ea7cl/desinstalado-meshtastic_narrow-FECHA.
# No toca el receptor ni el perfil de 869 MHz que hayas creado.
# Uso:  sudo bash ~/meshtastic_narrow-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
PY=${PY:-/usr/lib/python3/dist-packages}
HT=$PY/htdocs/plugins/receiver
SRC=${SRC:-/home/ea7cl}
MARC=${MARC:-/var/lib/openwebrx/bookmarks.json}
TS=$(date +%Y-%m-%d-%H%M%S)
BK=${BK:-/home/ea7cl/desinstalado-meshtastic_narrow-$TS}
ARCH="owrx/modes.py owrx/dsp.py csdr/chain/lora.py"
[ -f "$SRC/meshtastic_narrow_parchear.py" ] || { echo "Falta $SRC/meshtastic_narrow_parchear.py (cópialo antes con scp)" >&2; exit 1; }

mkdir -p "$BK"
for a in $ARCH; do mkdir -p "$BK/$(dirname "$a")"; cp -a "$PY/$a" "$BK/$a"; done
cp -a "$HT/init.js" "$BK/init.js"
[ -f "$MARC" ] && cp -a "$MARC" "$BK/bookmarks.json"
echo "Copia de seguridad en $BK"

systemctl stop openwebrx
python3 -I "$SRC/meshtastic_narrow_parchear.py" quitar "$PY"

sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('meshtastic_narrow'\);/d" "$HT/init.js"
echo "Quitada de init.js la carga de meshtastic_narrow"
if [ -d "$HT/meshtastic_narrow" ]; then
    mv "$HT/meshtastic_narrow" "$BK/meshtastic_narrow"
    echo "Plugin movido a $BK/meshtastic_narrow"
fi

if [ -f "$MARC" ]; then
    MARC="$MARC" python3 -I - <<'EOF'
import json, os
f = os.environ["MARC"]
lista = json.load(open(f, encoding="utf-8"))
nueva = [b for b in lista if b.get("modulation") != "meshtastic-narrow"]
if len(nueva) != len(lista):
    st = os.stat(f)
    with open(f + ".tmp-mn", "w", encoding="utf-8") as o:
        o.write(json.dumps(nueva, indent=4))
    os.chown(f + ".tmp-mn", st.st_uid, st.st_gid); os.chmod(f + ".tmp-mn", st.st_mode)
    os.replace(f + ".tmp-mn", f)
    print(f"Quitadas {len(lista) - len(nueva)} memorias con el modo meshtastic-narrow")
EOF
fi

systemctl start openwebrx
echo
echo "Desinstalado. Ctrl+F5 en el navegador."
echo "Para volver a ponerlo tal como estaba: sudo bash ~/meshtastic_narrow-install.sh"
