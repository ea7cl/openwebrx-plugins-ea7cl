#!/bin/bash
# Instala o actualiza el contador de visitas en un OpenWebRX+ instalado como paquete (Debian, Ubuntu, Raspberry Pi OS).
# Uso, desde la carpeta del repositorio:  sudo bash contador/scripts/contador-install.sh
# Se puede repetir sin peligro: conserva los datos del contador y no duplica nada.
set -e

if [ "$(id -u)" -ne 0 ]; then
    echo "Hay que ejecutarlo con sudo" >&2
    exit 1
fi

AQUI=$(cd "$(dirname "$0")/.." && pwd)
TS=$(date +%Y-%m-%d-%H%M)

# Donde esta instalado OpenWebRX (sin importarlo)
OWRX=$(python3 -c "import importlib.util, os; print(os.path.dirname(importlib.util.find_spec('owrx').origin))" 2>/dev/null || true)
if [ -z "$OWRX" ] || [ ! -f "$OWRX/connection.py" ]; then
    echo "No se encuentra OpenWebRX (owrx/connection.py). Este instalador es para el paquete de OpenWebRX+, no para Docker." >&2
    exit 1
fi
HT=$(dirname "$OWRX")/htdocs/plugins/receiver
CON=$OWRX/connection.py
echo "OpenWebRX en $OWRX"

if grep -q "class VisitCounter" "$OWRX/sessionstats.py" 2>/dev/null; then
    echo "Este servidor ya cuenta visitas con owrx/sessionstats.py; no se instala para no contar dos veces." >&2
    exit 1
fi

# 1. Lector de la base de paises
if ! python3 -c "import maxminddb" 2>/dev/null; then
    echo "Instalando python3-maxminddb..."
    apt-get install -y python3-maxminddb
fi

# 2. Base de paises, y su renovacion mensual
install -m 755 "$AQUI/scripts/contador-geoip.sh" /etc/cron.monthly/contador-geoip
if [ ! -f /var/lib/openwebrx/geoip/dbip-country-lite.mmdb ]; then
    /etc/cron.monthly/contador-geoip || true
fi

# 3. Parte del servidor
install -m 644 "$AQUI/servidor/contador.py" "$OWRX/contador.py"
echo "Copiado $OWRX/contador.py"

if grep -q "ContadorThread" "$CON"; then
    echo "connection.py ya llama al contador, no se toca"
else
    if [ "$(grep -c '^from owrx.cpu import CpuUsageThread$' "$CON")" != 1 ] || \
       [ "$(grep -cE '^\s*CpuUsageThread.getSharedInstance\(\).add_client\(self\)$' "$CON")" != 1 ]; then
        echo "connection.py no tiene la forma esperada; añade a mano las dos lineas del README." >&2
        exit 1
    fi
    cp -a "$CON" "$CON.bak-$TS"
    sed -i \
        -e 's/^from owrx.cpu import CpuUsageThread$/&\nfrom owrx.contador import ContadorThread/' \
        -e 's/^\(\s*\)CpuUsageThread.getSharedInstance().add_client(self)$/&\n\1ContadorThread.getSharedInstance().add_client(self)/' \
        "$CON"
    if ! python3 -m py_compile "$CON"; then
        cp -a "$CON.bak-$TS" "$CON"
        echo "Error al modificar connection.py; se ha dejado como estaba." >&2
        exit 1
    fi
    echo "connection.py modificado (copia: $CON.bak-$TS)"
fi

# 4. Parte del navegador; datos.json lo escribe el servicio, por eso la carpeta es de openwebrx
if [ -d "$HT/contador" ]; then
    cp -a "$HT/contador" "$HT/contador.bak-$TS"
fi
mkdir -p "$HT/contador"
install -m 644 "$AQUI/plugin/contador.js" "$HT/contador/contador.js"
chown openwebrx:openwebrx "$HT/contador"
echo "Copiado $HT/contador/contador.js"

if [ ! -f "$HT/init.js" ]; then
    echo "Plugins.load('contador');" > "$HT/init.js"
    echo "Creado $HT/init.js"
elif grep -q "Plugins.load('contador')" "$HT/init.js"; then
    echo "init.js ya cargaba el contador, no se toca"
else
    cp -a "$HT/init.js" "$HT/init.js.bak-$TS"
    printf "\nPlugins.load('contador');\n" >> "$HT/init.js"
    echo "Añadido Plugins.load('contador') a init.js (copia: $HT/init.js.bak-$TS)"
fi

# 5. Reiniciar para que cargue owrx/contador.py
systemctl restart openwebrx
echo
echo "Listo. La tarjeta aparece en la cabecera del receptor (pulsa en el titulo para desplegarla)"
echo "en cuanto se conecte el primer oyente desde fuera de la red local."
echo "Tras actualizar OpenWebRX hay que volver a ejecutar este instalador."
