#!/bin/bash
# Instala o actualiza el plugin banderas_emoji (EA7CL): banderas emoji en Chrome y Edge de Windows.
# Copiar antes al servidor:  scp banderas_emoji/banderas_emoji.js banderas_emoji/scripts/banderas_emoji-install.sh banderas_emoji/scripts/banderas_emoji-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/banderas_emoji-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/banderas_emoji/banderas_emoji.js" ]; then
    cp -a "$D/banderas_emoji/banderas_emoji.js" "$SRC/banderas_emoji.js.bak-$TS"
    echo "Copia de seguridad: $SRC/banderas_emoji.js.bak-$TS"
fi

mkdir -p "$D/banderas_emoji"
install -m 644 "$SRC/banderas_emoji.js" "$D/banderas_emoji/banderas_emoji.js"
echo "Plugin copiado: $D/banderas_emoji/banderas_emoji.js"

LINEA="Plugins.load('banderas_emoji');   // EA7CL: banderas emoji en Chrome y Edge de Windows"
if grep -qE "^[[:space:]]*Plugins\.load\('banderas_emoji'\);" "$D/init.js"; then
    echo "init.js ya cargaba banderas_emoji, no se toca"
else
    # que el archivo acabe en salto de línea antes de añadir
    [ -n "$(tail -c1 "$D/init.js")" ] && echo >> "$D/init.js"
    printf "%s\n" "$LINEA" >> "$D/init.js"
    echo "Añadida al final de init.js: $LINEA"
fi

echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/banderas_emoji-uninstall.sh"
