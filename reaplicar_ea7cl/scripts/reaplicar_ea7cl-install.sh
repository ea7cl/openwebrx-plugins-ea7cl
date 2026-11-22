#!/bin/bash
# Instala reaplicar_ea7cl (EA7CL): vuelve a poner tus cambios en archivos de OpenWebRX+ tras cada actualización.
# Se ejecuta desde la carpeta reaplicar_ea7cl/ del repositorio (o una copia suya en el servidor):
#   sudo bash scripts/reaplicar_ea7cl-install.sh
# Instala el programa, el aviso de apt, sessionstats.py y los cambios guardados de OpenWebRX 1.2.130.
# NO cambia ningún archivo de OpenWebRX: al final dice qué cambios faltan; ponerlos es
#   sudo reaplicar_ea7cl aplicar        (reinicia OpenWebRX)
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
SBIN=${SBIN:-/usr/local/sbin}
BASE=${BASE:-/usr/local/share/reaplicar-ea7cl}
APTD=${APTD:-/etc/apt/apt.conf.d}
OWRX=${OWRX:-/usr/lib/python3/dist-packages/owrx}
COPIAS=${COPIAS:-/var/backups/reaplicar-ea7cl}
TS=$(date +%Y%m%d-%H%M%S)
VER="$(dpkg-query -W -f='${Version}' openwebrx 2>/dev/null || echo desconocida)"
CAMBIOS="$AQUI/cambios-1.2.130"

for f in "$AQUI/reaplicar_ea7cl" "$AQUI/99owrx-reaplicar-ea7cl" "$AQUI/propios/sessionstats.py" "$CAMBIOS/parches"; do
    [ -e "$f" ] || { echo "Falta $f: ejecútalo desde la carpeta reaplicar_ea7cl completa" >&2; exit 1; }
done
command -v patch >/dev/null || { echo "Falta el programa patch: sudo apt install patch" >&2; exit 1; }
[ -d "$OWRX" ] || { echo "No encuentro OpenWebRX en $OWRX" >&2; exit 1; }
case "$VER" in
    1.2.130*) ;;
    *) echo "AVISO: OpenWebRX es la $VER y los cambios guardados son de la 1.2.130."
       echo "       Se instalan igual; los que no encajen saldrán como NO ENCAJA y no se tocan." ;;
esac

# 1. Copia de lo que haya antes
K="$COPIAS/instalador-$TS"; mkdir -p "$K"
[ -f "$SBIN/reaplicar_ea7cl" ] && cp -a "$SBIN/reaplicar_ea7cl" "$K/"
[ -f "$APTD/99owrx-reaplicar-ea7cl" ] && cp -a "$APTD/99owrx-reaplicar-ea7cl" "$K/"
[ -f "$OWRX/sessionstats.py" ] && cp -a "$OWRX/sessionstats.py" "$K/"
[ -d "$BASE" ] && cp -a "$BASE" "$K/reaplicar-ea7cl"
echo "Copia de lo que había: $K"

# 2. Programa y aviso de apt
install -m 755 "$AQUI/reaplicar_ea7cl" "$SBIN/reaplicar_ea7cl"
install -m 644 "$AQUI/99owrx-reaplicar-ea7cl" "$APTD/99owrx-reaplicar-ea7cl"
echo "Instalado $SBIN/reaplicar_ea7cl y el aviso $APTD/99owrx-reaplicar-ea7cl"

# 3. sessionstats.py: archivo nuevo que necesita el cambio de connection.py
install -m 644 "$AQUI/propios/sessionstats.py" "$OWRX/sessionstats.py"
echo "Instalado $OWRX/sessionstats.py (lo usa el cambio de connection.py)"

# 4. Cambios guardados
[ -d "$BASE" ] && mv "$BASE" "$BASE.anterior-$TS"
mkdir -p "$BASE"
cp -r "$CAMBIOS/parches" "$BASE/parches"
mkdir -p "$BASE/copias"; [ -d "$CAMBIOS/copias" ] && cp -a "$CAMBIOS/copias/." "$BASE/copias/"
echo "Cambios guardados en $BASE: $(ls "$BASE/parches" | wc -l) parches y $(ls "$BASE/copias" | wc -l) copias completas"

echo
echo "--- Estado (no se ha cambiado ningún archivo de OpenWebRX) ---"
RE_BASE="$BASE" "$SBIN/reaplicar_ea7cl" estado || true
echo
echo "Para poner los que faltan:   sudo reaplicar_ea7cl aplicar     (reinicia OpenWebRX; con muchos SDR, unos 3 min)"
echo "Para quitar el programa:     sudo bash scripts/reaplicar_ea7cl-uninstall.sh"
