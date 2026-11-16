#!/bin/bash
# Instala o actualiza el plugin scan_pausa_ea7cl (EA7CL): SCAN con pausa de 5 s.
# Copiar antes al servidor:  scp scan_pausa_ea7cl/scan_pausa_ea7cl.js scan_pausa_ea7cl/scripts/scan_pausa_ea7cl-install.sh scan_pausa_ea7cl/scripts/scan_pausa_ea7cl-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/scan_pausa_ea7cl-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

for f in scan_pausa_ea7cl.js; do
    [ -f "$SRC/$f" ] || { echo "Falta $SRC/$f: cópialo antes al servidor" >&2; exit 1; }
done

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

mkdir -p "$D/scan_pausa_ea7cl"
for f in scan_pausa_ea7cl.js; do
    if [ -f "$D/scan_pausa_ea7cl/$f" ]; then
        cp -a "$D/scan_pausa_ea7cl/$f" "$SRC/$f.bak-$TS"
        echo "Copia de seguridad: $SRC/$f.bak-$TS"
    fi
    install -m 644 "$SRC/$f" "$D/scan_pausa_ea7cl/$f"
    echo "Plugin copiado: $D/scan_pausa_ea7cl/$f"
done

LINEA="Plugins.load('scan_pausa_ea7cl');   // EA7CL: SCAN con pausa de 5 s"
if grep -qE "^[[:space:]]*Plugins\.load\('scan_pausa_ea7cl'\);" "$D/init.js"; then
    echo "init.js ya cargaba scan_pausa_ea7cl, no se toca"
else
    # que el archivo acabe en salto de línea antes de añadir
    [ -n "$(tail -c1 "$D/init.js")" ] && echo >> "$D/init.js"
    printf "%s\n" "$LINEA" >> "$D/init.js"
    echo "Añadida al final de init.js: $LINEA"
fi

echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/scan_pausa_ea7cl-uninstall.sh"
