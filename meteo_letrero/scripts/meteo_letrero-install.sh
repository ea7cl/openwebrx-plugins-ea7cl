#!/bin/bash
# Instala o actualiza el plugin meteo_letrero (EA7CL): letrero con el tiempo de la estación Davis.
# Copiar antes al servidor:  scp meteo_letrero/meteo_letrero.js meteo_letrero/scripts/meteo_letrero-*.sh meteo_letrero/servidor/* openwebrx:~/
# Uso:  sudo bash ~/meteo_letrero-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/meteo_letrero/meteo_letrero.js" ]; then
    cp -a "$D/meteo_letrero/meteo_letrero.js" "$SRC/meteo_letrero.js.bak-$TS"
    echo "Copia de seguridad: $SRC/meteo_letrero.js.bak-$TS"
fi

mkdir -p "$D/meteo_letrero"
install -m 644 "$SRC/meteo_letrero.js" "$D/meteo_letrero/meteo_letrero.js"
echo "Plugin copiado: $D/meteo_letrero/meteo_letrero.js"

LINEA="Plugins.load('meteo_letrero');   // EA7CL: letrero con el tiempo de la estación Davis"
if grep -qE "^[[:space:]]*Plugins\.load\('meteo_letrero'\);" "$D/init.js"; then
    echo "init.js ya cargaba meteo_letrero, no se toca"
else
    # que el archivo acabe en salto de línea antes de añadir
    [ -n "$(tail -c1 "$D/init.js")" ] && echo >> "$D/init.js"
    printf "%s\n" "$LINEA" >> "$D/init.js"
    echo "Añadida al final de init.js: $LINEA"
fi

# datos.json: meteo_copia.py lo escribe cada minuto (tarea /etc/cron.d/meteo_letrero)
CRON=${CRON:-/etc/cron.d}
chmod 755 "$SRC/meteo_copia.py"
install -m 644 "$SRC/meteo_letrero.cron" "$CRON/meteo_letrero"
echo "Tarea de cada minuto instalada: $CRON/meteo_letrero"
python3 -I "$SRC/meteo_copia.py" || echo "Aviso: ahora no se ha podido leer el tiempo de la Raspberry"
echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/meteo_letrero-uninstall.sh"
