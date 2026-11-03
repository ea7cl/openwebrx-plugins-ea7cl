#!/bin/bash
# Descarga o actualiza la base de datos de paises DB-IP "IP to Country Lite" (CC BY 4.0, https://db-ip.com)
# que usa el contador. La instala el instalador en /etc/cron.monthly para que se renueve cada mes.
set -e
DIR=/var/lib/openwebrx/geoip
DB=$DIR/dbip-country-lite.mmdb
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

mkdir -p "$DIR"
# DB-IP publica la base de cada mes el dia 1; si la de este mes aun no esta, se usa la del anterior
for MES in "$(date +%Y-%m)" "$(date -d '-1 month' +%Y-%m)"; do
    if curl -fsSL --max-time 300 -o "$TMP" "https://download.db-ip.com/free/dbip-country-lite-$MES.mmdb.gz"; then
        gunzip -c "$TMP" > "$DB.tmp"
        chmod 644 "$DB.tmp"
        mv "$DB.tmp" "$DB"
        echo "Base de paises instalada: $DB ($MES)"
        exit 0
    fi
done
echo "AVISO: no se pudo descargar la base de paises; el contador funciona igual pero sin paises" >&2
exit 1
