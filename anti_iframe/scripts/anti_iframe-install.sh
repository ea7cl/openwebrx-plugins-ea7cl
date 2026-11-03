#!/bin/bash
# Instala o actualiza el plugin anti_iframe (EA7CL): avisa si el receptor se muestra incrustado en la web de otro.
# Copiar antes al servidor:  scp anti_iframe/anti_iframe.js anti_iframe/scripts/anti_iframe-install.sh anti_iframe/scripts/anti_iframe-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/anti_iframe-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/anti_iframe/anti_iframe.js" ]; then
    cp -a "$D/anti_iframe/anti_iframe.js" "$SRC/anti_iframe.js.bak-$TS"
    echo "Copia de seguridad: $SRC/anti_iframe.js.bak-$TS"
fi

mkdir -p "$D/anti_iframe"
install -m 644 "$SRC/anti_iframe.js" "$D/anti_iframe/anti_iframe.js"
echo "Plugin copiado: $D/anti_iframe/anti_iframe.js"

LINEA="Plugins.load('anti_iframe');   // EA7CL: avisa si el receptor se muestra incrustado en la web de otro"
if grep -qE "^[[:space:]]*Plugins\.load\('anti_iframe'\);" "$D/init.js"; then
    echo "init.js ya cargaba anti_iframe, no se toca"
else
    # que el archivo acabe en salto de línea antes de añadir
    [ -n "$(tail -c1 "$D/init.js")" ] && echo >> "$D/init.js"
    printf "%s\n" "$LINEA" >> "$D/init.js"
    echo "Añadida al final de init.js: $LINEA"
fi

echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/anti_iframe-uninstall.sh"
