#!/bin/bash
# Instala o actualiza el modo "Meshtastic Narrow" (EA7CL): Meshtastic a 62,5 kHz, SF7-9, para los
# modos Narrow de 868 MHz (por ejemplo la red SFNarrow en 869,618 MHz).
#   - añade el modo en OpenWebRX (modes.py, dsp.py, service/__init__.py, csdr/chain/lora.py),
#     entre marcas EA7CL
#   - plugin web meshtastic_narrow, para que se abra el panel de mensajes Meshtastic
#   - memoria del servidor "Meshtastic SFNarrow" en 869,618 MHz con ese modo
#   - decodificación en segundo plano (como AIS o VDL2): frecuencia de servicio en el plan de
#     bandas, el modo en los decodificadores de segundo plano y el receptor programado para
#     volver solo al perfil de 869 MHz cuando no lo usa ningún oyente
# Antes guarda todo lo que toca en /home/ea7cl/meshtastic_narrow-antes-FECHA (con restaurar.sh).
# Si OpenWebRX no arranca bien después, lo vuelve a dejar todo como estaba.
# Copiar antes al servidor:
#   scp meshtastic_narrow/meshtastic_narrow.js meshtastic_narrow/servidor/meshtastic_narrow_*.py meshtastic_narrow/scripts/meshtastic_narrow-*.sh openwebrx:~/
# Uso:  sudo bash ~/meshtastic_narrow-install.sh
# Variables:  FREQ=869618000  NOMBRE="Meshtastic SFNarrow"  RECEPTOR=00001001 (número de serie)
#             SEGUNDO_PLANO=0 para no decodificar en segundo plano
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
PY=${PY:-/usr/lib/python3/dist-packages}
HT=$PY/htdocs/plugins/receiver
SRC=${SRC:-/home/ea7cl}
MARC=${MARC:-/var/lib/openwebrx/bookmarks.json}
AJUSTES=${AJUSTES:-/var/lib/openwebrx/settings.json}
ANTES=${ANTES:-/var/lib/openwebrx/meshtastic_narrow-antes.json}
export FREQ=${FREQ:-869618000}
export RECEPTOR=${RECEPTOR:-00001001}
export AJUSTES ANTES
NOMBRE=${NOMBRE:-Meshtastic SFNarrow}
SEGUNDO_PLANO=${SEGUNDO_PLANO:-1}
TS=$(date +%Y-%m-%d-%H%M%S)
BK=${BK:-/home/ea7cl/meshtastic_narrow-antes-$TS}
ARCH="owrx/modes.py owrx/dsp.py owrx/service/__init__.py csdr/chain/lora.py"

for f in "$SRC/meshtastic_narrow.js" "$SRC/meshtastic_narrow_parchear.py" "$SRC/meshtastic_narrow_config.py"; do
    [ -f "$f" ] || { echo "Falta $f (cópialo antes con scp)" >&2; exit 1; }
done
command -v lorarx >/dev/null || { echo "Falta lorarx (paquete dxlaprs-lora)" >&2; exit 1; }
python3 -I -c "import meshtastic" 2>/dev/null || { echo "Falta python3-meshtastic" >&2; exit 1; }

# 1) copia de todo lo que se va a tocar, con su script para volver a ella
mkdir -p "$BK/etc"
for a in $ARCH; do mkdir -p "$BK/$(dirname "$a")"; cp -a "$PY/$a" "$BK/$a"; done
cp -a "$HT/init.js" "$BK/init.js"
cp -a "$MARC" "$BK/bookmarks.json"
cp -a "$AJUSTES" "$BK/settings.json"
cp -a /etc/openwebrx/bands*.json "$BK/etc/"
[ -f "$ANTES" ] && cp -a "$ANTES" "$BK/meshtastic_narrow-antes.json"
cat > "$BK/restaurar.sh" <<EOF
#!/bin/bash
# Deja OpenWebRX como estaba antes de instalar meshtastic_narrow el $TS
set -e
cd "\$(dirname "\$0")"
systemctl stop openwebrx
for a in $ARCH; do cp -a "\$a" "$PY/\$a"; done
cp -a init.js "$HT/init.js"
cp -a bookmarks.json "$MARC"
cp -a settings.json "$AJUSTES"
cp -a etc/bands*.json /etc/openwebrx/
if [ -f meshtastic_narrow-antes.json ]; then cp -a meshtastic_narrow-antes.json "$ANTES"; else rm -f "$ANTES"; fi
[ -d "$HT/meshtastic_narrow" ] && [ ! -f "$BK/plugin-estaba" ] && rm -rf "$HT/meshtastic_narrow"
systemctl start openwebrx
echo "Restaurado desde \$(pwd)"
EOF
[ -d "$HT/meshtastic_narrow" ] && touch "$BK/plugin-estaba"
echo "Copia de seguridad en $BK (para volver a ella: sudo bash $BK/restaurar.sh)"

volver() {
    trap - ERR
    echo "ALGO HA FALLADO: dejando todo como estaba..." >&2
    bash "$BK/restaurar.sh" >&2
    exit 1
}

systemctl stop openwebrx
trap volver ERR

# 2) el modo en OpenWebRX
python3 -I "$SRC/meshtastic_narrow_parchear.py" poner "$PY"

# 3) el plugin web
mkdir -p "$HT/meshtastic_narrow"
install -m 644 "$SRC/meshtastic_narrow.js" "$HT/meshtastic_narrow/meshtastic_narrow.js"
if grep -qE "^[[:space:]]*Plugins\.load\('meshtastic_narrow'\);" "$HT/init.js"; then
    echo "init.js ya cargaba meshtastic_narrow"
else
    [ -n "$(tail -c1 "$HT/init.js")" ] && echo >> "$HT/init.js"
    echo "Plugins.load('meshtastic_narrow');   // EA7CL: panel de mensajes para el modo Meshtastic Narrow" >> "$HT/init.js"
    echo "Añadida a init.js la carga de meshtastic_narrow"
fi

# 4) la memoria del servidor (con OpenWebRX parado, para que no la pise)
NOMBRE="$NOMBRE" MARC="$MARC" python3 -I - <<'EOF'
import json, os
f = os.environ["MARC"]; freq = int(os.environ["FREQ"]); nombre = os.environ["NOMBRE"]
lista = json.load(open(f, encoding="utf-8"))
if any(b.get("modulation") == "meshtastic-narrow" and b.get("frequency") == freq for b in lista):
    print("La memoria ya estaba")
else:
    lista.append({"name": nombre, "frequency": freq, "modulation": "meshtastic-narrow"})
    st = os.stat(f)
    with open(f + ".tmp-mn", "w", encoding="utf-8") as o:
        o.write(json.dumps(lista, indent=4))
    os.chown(f + ".tmp-mn", st.st_uid, st.st_gid); os.chmod(f + ".tmp-mn", st.st_mode)
    os.replace(f + ".tmp-mn", f)
    print(f"Memoria añadida: {nombre} en {freq/1e6:.3f} MHz")
EOF

# 5) segundo plano
if [ "$SEGUNDO_PLANO" = 1 ]; then
    python3 -I "$SRC/meshtastic_narrow_config.py" poner
else
    echo "Sin segundo plano (SEGUNDO_PLANO=0)"
fi

# 6) arrancar y comprobar
systemctl start openwebrx
# solo el registro de este arranque (al pararse, OpenWebRX escribe errores "Broken pipe" normales)
ID=$(systemctl show -p InvocationID --value openwebrx)
# (con tantos receptores tarda en contestar hasta un minuto y medio)
for i in $(seq 1 120); do curl -fs -o /dev/null http://127.0.0.1:8073/ && break; sleep 2; done
systemctl is-active --quiet openwebrx
curl -fs -o /dev/null http://127.0.0.1:8073/
sleep 5
if journalctl _SYSTEMD_INVOCATION_ID="$ID" | grep -qE "SyntaxError|ImportError|NameError|IndentationError|meshtastic.narrow.*Error"; then
    journalctl _SYSTEMD_INVOCATION_ID="$ID" | grep -B4 -A4 -E "SyntaxError|ImportError|NameError|IndentationError|meshtastic.narrow.*Error" | head -40 >&2
    false
fi
trap - ERR

python3 -I "$SRC/meshtastic_narrow_parchear.py" ver "$PY"
python3 -I "$SRC/meshtastic_narrow_config.py" ver
echo
echo "Listo. Ctrl+F5 en el navegador; el modo sale en DIG como \"Meshtastic Narrow\"."
echo "Para quitarlo: sudo bash ~/meshtastic_narrow-uninstall.sh"
echo "Para volver a como estaba justo antes: sudo bash $BK/restaurar.sh"
