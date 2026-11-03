#!/bin/bash
# Desinstala el contador de visitas. Los datos (/var/lib/openwebrx/contador*) se conservan.
# Uso:  sudo bash contador/scripts/contador-uninstall.sh
set -e

if [ "$(id -u)" -ne 0 ]; then
    echo "Hay que ejecutarlo con sudo" >&2
    exit 1
fi

OWRX=$(python3 -c "import importlib.util, os; print(os.path.dirname(importlib.util.find_spec('owrx').origin))")
HT=$(dirname "$OWRX")/htdocs/plugins/receiver

sed -i -e '/^from owrx.contador import ContadorThread$/d' -e '/^\s*ContadorThread.getSharedInstance().add_client(self)$/d' "$OWRX/connection.py"
rm -f "$OWRX/contador.py" /etc/cron.monthly/contador-geoip
# la línea puede llevar un comentario detrás ("Plugins.load('contador');   // EA7CL: ...")
[ -f "$HT/init.js" ] && sed -i -E "/^[[:space:]]*(\/\/[[:space:]]*)?Plugins\.load\('contador'\);/d" "$HT/init.js"
rm -rf "$HT/contador"

systemctl restart openwebrx
echo "Contador desinstalado. Los datos siguen en /var/lib/openwebrx/contador.json y contador-huellas.txt"
