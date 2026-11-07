#!/bin/bash
# Quita el https del puerto 8443 (EA7CL). No toca OpenWebRX ni el puerto 8073.
# No borra nada: guarda la configuración, el certificado y el token en
# /home/ea7cl/desinstalado-https-FECHA y al final dice cómo volver a ponerlo.
# Uso:  sudo bash ~/https-uninstall.sh
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "Hay que ejecutarlo con sudo" >&2; exit 1; }
DEST=/home/ea7cl/desinstalado-https-$(date +%Y-%m-%d-%H%M)
mkdir -p "$DEST"

systemctl disable --now nginx 2>/dev/null
[ -f /etc/nginx/sites-available/owrx-https ] && mv /etc/nginx/sites-available/owrx-https "$DEST/"
rm -f /etc/nginx/sites-enabled/owrx-https
ufw delete allow 8443/tcp >/dev/null 2>&1
# certificado, renovación y token: se apartan (así certbot deja de renovar)
[ -d /etc/letsencrypt ] && mv /etc/letsencrypt "$DEST/letsencrypt"
[ -d /etc/owrx-https ] && mv /etc/owrx-https "$DEST/owrx-https"
[ -f /usr/local/sbin/duckdns-txt.sh ] && mv /usr/local/sbin/duckdns-txt.sh "$DEST/"
chmod 700 "$DEST"

echo "https quitado. El receptor sigue en http://...:8073 como siempre."
echo "Guardado en $DEST (lleva el token de DuckDNS y la clave del certificado: no lo compartas)."
echo "Los programas nginx y certbot se quedan instalados pero parados."
echo "Para volver a ponerlo:"
echo "  sudo install -d -m 700 /etc/owrx-https && sudo cp $DEST/owrx-https/duckdns-token /etc/owrx-https/"
echo "  sudo bash ~/https-install.sh   (pide un certificado nuevo)"
