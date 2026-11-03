#!/bin/bash
# Instala o actualiza el plugin mi_ip (EA7CL): tarjeta con la IP del oyente en la cabecera.
# Copiar antes al servidor:  scp mi_ip/mi_ip.js mi_ip/scripts/mi_ip-install.sh mi_ip/scripts/mi_ip-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/mi_ip-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/mi_ip/mi_ip.js" ]; then
    cp -a "$D/mi_ip/mi_ip.js" "$SRC/mi_ip.js.bak-$TS"
    echo "Copia de seguridad: $SRC/mi_ip.js.bak-$TS"
fi

mkdir -p "$D/mi_ip"
install -m 644 "$SRC/mi_ip.js" "$D/mi_ip/mi_ip.js"
echo "Plugin copiado: $D/mi_ip/mi_ip.js"

LINEA="Plugins.load('mi_ip');   // EA7CL: tarjeta con la IP del oyente en la cabecera"
if grep -qE "^[[:space:]]*Plugins\.load\('mi_ip'\);" "$D/init.js"; then
    echo "init.js ya cargaba mi_ip, no se toca"
else
    # que el archivo acabe en salto de línea antes de añadir
    [ -n "$(tail -c1 "$D/init.js")" ] && echo >> "$D/init.js"
    printf "%s\n" "$LINEA" >> "$D/init.js"
    echo "Añadida al final de init.js: $LINEA"
fi

echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/mi_ip-uninstall.sh"
