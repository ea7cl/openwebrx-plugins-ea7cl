#!/bin/bash
# Validación de Let's Encrypt por DNS con DuckDNS (EA7CL). La llama certbot, no se usa a mano.
#   duckdns-txt.sh poner   publica en DuckDNS el texto que pide Let's Encrypt y espera a que se vea
#   duckdns-txt.sh quitar  lo borra al terminar
# certbot pasa CERTBOT_DOMAIN (ea7cl-sdr.duckdns.org) y CERTBOT_VALIDATION (el texto).
# El token de DuckDNS se lee de /etc/owrx-https/duckdns-token y nunca se escribe en pantalla ni en registros.
set -euo pipefail
TOKEN_FILE=/etc/owrx-https/duckdns-token
T=$(tr -d ' \t\r\n' < "$TOKEN_FILE")
[[ $T =~ ^[0-9a-fA-F-]{36}$ ]] || { echo "El token de $TOKEN_FILE no es válido (debe ser como xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)" >&2; exit 1; }
D=${CERTBOT_DOMAIN%.duckdns.org}

duck() { curl -fsS --max-time 30 -K - <<< "url = \"https://www.duckdns.org/update?domains=$D&token=$T&$1\""; }

case ${1:-} in
    poner)
        r=$(duck "txt=$CERTBOT_VALIDATION")
        [ "$r" = OK ] || { echo "DuckDNS no ha aceptado el texto (respuesta: $r)" >&2; exit 1; }
        # esperar a que los DNS públicos lo vean (normalmente unos segundos)
        for i in $(seq 1 30); do
            if dig +short TXT "_acme-challenge.$CERTBOT_DOMAIN" @1.1.1.1 | grep -q -- "$CERTBOT_VALIDATION" &&
               dig +short TXT "_acme-challenge.$CERTBOT_DOMAIN" @8.8.8.8 | grep -q -- "$CERTBOT_VALIDATION"; then
                sleep 20
                exit 0
            fi
            sleep 10
        done
        echo "AVISO: el texto no se ve todavía en los DNS públicos; se intenta igualmente" >&2
        ;;
    quitar)
        duck "txt=borrar&clear=true" >/dev/null || true
        ;;
    *) echo "Uso: $0 poner|quitar (lo llama certbot)" >&2; exit 1 ;;
esac
