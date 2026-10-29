#!/bin/bash
# Vuelve a poner lo personalizado después de actualizar OpenWebRX+.
# Uso (dentro de la carpeta de la copia):
#   sudo bash restaurar.sh --prueba   solo dice lo que haría, sin tocar nada
#   sudo bash restaurar.sh            lo hace
#
# - Archivos de OpenWebRX+ modificados: si la versión instalada es la misma que la de
#   la copia, se copian tal cual; si es otra, se aplican solo tus cambios (parches)
#   sobre los archivos nuevos. Si un cambio no encaja, se deja el archivo de la versión
#   nueva y se avisa, para revisarlo a mano.
# - Plugins y archivos propios: solo se reponen los que falten.
# - La configuración (/etc/openwebrx, /var/lib/openwebrx) no se toca: la actualización
#   la conserva. Está en config/ por si hiciera falta.
set -e
C=$(cd "$(dirname "$0")" && pwd)
PRUEBA=0; [ "$1" = "--prueba" ] && PRUEBA=1
VER_COPIA=$(cat "$C/version.txt")
VER=$(dpkg-query -W -f='${Version}' openwebrx)
TS=$(date +%Y-%m-%d-%H%M)
echo "Copia hecha con OpenWebRX+ $VER_COPIA; instalado ahora $VER"
[ $PRUEBA = 1 ] && echo "MODO PRUEBA: no se cambia nada"
echo

FALLOS=""
while read -r f; do
    p="$C/parches$f.diff"
    if [ "$VER" = "$VER_COPIA" ] || ! grep -q '^@@' "$p"; then
        # misma versión, o archivo binario (imagen): se copia tal cual
        if cmp -s "$C/modificados$f" "$f"; then echo "ya estaba:  $f"; continue; fi
        if [ $PRUEBA = 0 ]; then
            cp -a "$f" "$f.antes-de-restaurar-$TS" 2>/dev/null || true
            cp -a "$C/modificados$f" "$f"
        fi
        echo "copiado:    $f"
    elif patch --dry-run -s -f -R "$f" < "$p" >/dev/null 2>&1; then
        echo "ya estaba:  $f"
    elif patch --dry-run -s -f "$f" < "$p" >/dev/null 2>&1; then
        if [ $PRUEBA = 0 ]; then
            cp -a "$f" "$f.antes-de-restaurar-$TS"
            patch -s -f --no-backup-if-mismatch "$f" < "$p"
        fi
        echo "parcheado:  $f"
    else
        FALLOS="$FALLOS  $f\n"
        echo "NO ENCAJA:  $f (se deja el de la versión nueva)"
    fi
done < "$C/modificados.txt"

while read -r f; do
    [ -e "$f" ] && continue
    if [ $PRUEBA = 0 ]; then
        mkdir -p "$(dirname "$f")"
        cp -a "$C/propios$f" "$f"
    fi
    echo "repuesto:   $f"
done < "$C/propios.txt"

echo
if [ -n "$FALLOS" ]; then
    echo "Estos cambios no encajan en la versión nueva y hay que revisarlos a mano"
    echo "(el cambio está en $C/parches/...):"
    printf "$FALLOS"
    echo
fi
if [ $PRUEBA = 0 ]; then
    echo "Para que se aplique: sudo systemctl restart openwebrx"
    echo "Los archivos sustituidos se guardaron como *.antes-de-restaurar-$TS"
fi
