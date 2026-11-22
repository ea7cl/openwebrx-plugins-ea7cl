#!/bin/bash
# Instala o actualiza el plugin arreglo_modo_digital (EA7CL): modo digital nunca como modo base.
# Copiar antes al servidor:  scp arreglo_modo_digital/arreglo_modo_digital.js arreglo_modo_digital/arreglo_modo_digital.css arreglo_modo_digital/scripts/arreglo_modo_digital-install.sh arreglo_modo_digital/scripts/arreglo_modo_digital-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/arreglo_modo_digital-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

for f in arreglo_modo_digital.js arreglo_modo_digital.css; do
    [ -f "$SRC/$f" ] || { echo "Falta $SRC/$f: cópialo antes al servidor" >&2; exit 1; }
done

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

mkdir -p "$D/arreglo_modo_digital"
for f in arreglo_modo_digital.js arreglo_modo_digital.css; do
    if [ -f "$D/arreglo_modo_digital/$f" ]; then
        cp -a "$D/arreglo_modo_digital/$f" "$SRC/$f.bak-$TS"
        echo "Copia de seguridad: $SRC/$f.bak-$TS"
    fi
    install -m 644 "$SRC/$f" "$D/arreglo_modo_digital/$f"
    echo "Plugin copiado: $D/arreglo_modo_digital/$f"
done

LINEA="Plugins.load('arreglo_modo_digital');   // EA7CL: modo digital nunca como modo base"
if grep -qE "^[[:space:]]*Plugins\.load\('arreglo_modo_digital'\);" "$D/init.js"; then
    echo "init.js ya cargaba arreglo_modo_digital, no se toca"
else
    # que el archivo acabe en salto de línea antes de añadir
    [ -n "$(tail -c1 "$D/init.js")" ] && echo >> "$D/init.js"
    printf "%s\n" "$LINEA" >> "$D/init.js"
    echo "Añadida al final de init.js: $LINEA"
fi

echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/arreglo_modo_digital-uninstall.sh"
