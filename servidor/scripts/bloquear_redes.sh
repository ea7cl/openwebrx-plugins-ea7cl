#!/bin/bash
# Bloquea redes enteras por su numero de AS (EA7CL)
# Para anadir otra red, pon su numero en ASNS separado por un espacio
ASNS="212238 60068 51430 9009 205016"
CONJUNTO="redes_bloqueadas"
DIR=/home/ea7cl/redes_bloqueadas
mkdir -p "$DIR"
command -v ipset >/dev/null || apt-get install -y ipset
ipset create "$CONJUNTO" hash:net -exist
ipset flush "$CONJUNTO"
TOTAL=0
for AS in $ASNS; do
  LISTA="$DIR/AS$AS.txt"
  python3 - "$AS" "$DIR" > "$LISTA.nuevo" 2>/dev/null <<'PY'
import json, sys, urllib.request
asn, carpeta = sys.argv[1], sys.argv[2]
url = "https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS" + asn
try:
    d = json.load(urllib.request.urlopen(url, timeout=60))
except Exception:
    d = json.load(open(carpeta + "/AS" + asn + ".json"))
for p in d["data"]["prefixes"]:
    if ":" not in p["prefix"]:
        print(p["prefix"])
PY
  if [ -s "$LISTA.nuevo" ]; then
    mv "$LISTA.nuevo" "$LISTA"; echo "AS$AS: lista descargada"
  else
    rm -f "$LISTA.nuevo"; echo "AS$AS: sin descarga, uso la lista guardada"
  fi
  if [ -s "$LISTA" ]; then
    while read -r R; do ipset add "$CONJUNTO" "$R" -exist; done < "$LISTA"
    N=$(wc -l < "$LISTA"); TOTAL=$((TOTAL+N)); echo "AS$AS: $N bloques"
  else
    echo "AS$AS: NO hay lista, esta red no se bloquea"
  fi
done
iptables -C INPUT -m set --match-set "$CONJUNTO" src -j DROP 2>/dev/null || \
  iptables -I INPUT 1 -m set --match-set "$CONJUNTO" src -j DROP
echo "Total: $TOTAL bloques bloqueados"
