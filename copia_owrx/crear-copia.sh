#!/bin/bash
# Copia de todo lo personalizado en OpenWebRX+, para recuperarlo después de actualizar
# o volver a como estaba si una actualización sale mal.
# Uso: sudo bash /home/ea7cl/owrx-personalizado/crear-copia.sh
#
# Guarda en /home/ea7cl/owrx-personalizado/copia-FECHA (y en un .tar.gz):
#   modificados/   archivos de OpenWebRX+ cambiados por ti (la actualización los machaca)
#   parches/       solo los cambios de cada uno, para aplicarlos sobre una versión nueva
#   propios/       plugins, imágenes y demás archivos añadidos por ti
#   config/        /etc/openwebrx y /var/lib/openwebrx
#   versiones.txt  versión de cada paquete de OpenWebRX+ instalado; sus .deb quedan en
#                  /home/ea7cl/owrx-personalizado/paquetes para reinstalarlos tal cual
#   restaurar.sh   vuelve a poner los cambios después de actualizar
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
. "$SRC/lib-owrx.sh"
VER=$(version_de openwebrx)
TS=$(date +%Y-%m-%d-%H%M)
DEST=$BASE/copia-$TS
TMP=$(mktemp -d)
chmod 755 "$TMP"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST/modificados" "$DEST/parches" "$DEST/propios" "$DEST/config"
echo "$VER" > "$DEST/version.txt"

# 0) paquetes instalados, para poder volver exactamente a estas versiones
: > "$DEST/versiones.txt"
FALTAN=""
for p in $(paquetes_owrx); do
    if [ "$p" = openwebrx ]; then MODO=original; else MODO=""; fi
    if guardar_deb "$p" $MODO; then
        echo "$p=$(version_de "$p")" >> "$DEST/versiones.txt"
    else
        FALTAN="$FALTAN $p"
    fi
done
echo "Paquetes:    $(wc -l < "$DEST/versiones.txt") guardados en $ALMACEN"
[ -z "$FALTAN" ] || echo "AVISO: no se han podido guardar:$FALTAN"

# paquete original de la versión instalada, para sacar las diferencias
ORIG_DEB=$(deb_nombre openwebrx "$VER")
if [ -s "$ORIG_DEB" ]; then
    dpkg-deb -x "$ORIG_DEB" "$TMP/orig"
else
    echo "AVISO: no está el paquete original de OpenWebRX+ $VER; la copia va sin parches/"
fi

# 1) archivos de OpenWebRX+ modificados
modificados > "$DEST/modificados.txt"
while read -r f; do
    mkdir -p "$DEST/modificados$(dirname "$f")" "$DEST/parches$(dirname "$f")"
    cp -a "$f" "$DEST/modificados$f"
    [ -d "$TMP/orig" ] || continue
    diff -u --label "$f.orig" --label "$f" "$TMP/orig$f" "$f" > "$DEST/parches$f.diff" || true
done < "$DEST/modificados.txt"
echo "Modificados: $(wc -l < "$DEST/modificados.txt") archivos"

# 2) archivos añadidos (sin copias de seguridad .bak ni cachés)
propios > "$DEST/propios.txt"
tar -cf - -T "$DEST/propios.txt" 2>/dev/null | tar -xf - -C "$DEST/propios"
echo "Propios:     $(wc -l < "$DEST/propios.txt") archivos"

# 3) configuración
cp -a /etc/openwebrx "$DEST/config/etc-openwebrx"
cp -a /var/lib/openwebrx "$DEST/config/var-lib-openwebrx"
echo "Config:      /etc/openwebrx y /var/lib/openwebrx"

cp "$SRC/restaurar.sh" "$DEST/restaurar.sh"
cp "$SRC/LEEME.txt" "$DEST/LEEME.txt" 2>/dev/null || true
tar -czf "$DEST.tar.gz" -C "$BASE" "copia-$TS"
# Solo lo necesario para traer las copias a Windows. Lo de dentro de cada copia conserva
# su dueño (root, openwebrx...): si fuera de ea7cl, al volver atrás OpenWebRX no arranca.
chown ea7cl: "$BASE" "$DEST.tar.gz"
chown -R ea7cl: "$ALMACEN"

echo
echo "Copia de OpenWebRX+ $VER en $DEST"
echo "y comprimida en $DEST.tar.gz"
