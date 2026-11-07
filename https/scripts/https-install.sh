#!/bin/bash
# https para OpenWebRX+ (EA7CL): certificado gratuito de Let's Encrypt para el dominio DuckDNS
# y nginx en el puerto 8443. El puerto 8073 (http) no se toca.
#
# Copiar antes al servidor:
#   scp https/scripts/https-*.sh https/servidor/* openwebrx:~/
# Uso:
#   sudo bash ~/https-install.sh
# Se puede ejecutar las veces que haga falta. La primera vez deja preparado el archivo del
# token de DuckDNS y se para; al volver a ejecutarlo con el token puesto, pide el certificado
# y activa https.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Hay que ejecutarlo con sudo" >&2; exit 1; }
DOMINIO=${DOMINIO:-ea7cl-sdr.duckdns.org}
PUERTO=8443
SRC=/home/ea7cl
CONF=/etc/owrx-https
TOKEN=$CONF/duckdns-token
TS=$(date +%Y-%m-%d-%H%M)

for f in duckdns-txt.sh owrx-https.conf recargar-nginx.sh; do
    [ -f "$SRC/$f" ] || { echo "Falta $SRC/$f; cópialo antes con scp" >&2; exit 1; }
done

echo "1) Programas (de los repositorios de Ubuntu)"
dpkg -s nginx-light certbot dnsutils >/dev/null 2>&1 ||
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q nginx-light certbot dnsutils >/dev/null
rm -f /etc/nginx/sites-enabled/default     # la página de ejemplo de nginx en el puerto 80: no hace falta
echo "   nginx $(nginx -v 2>&1 | cut -d/ -f2), certbot $(certbot --version | cut -d' ' -f2)"

echo "2) Validación con DuckDNS"
install -m 755 "$SRC/duckdns-txt.sh" /usr/local/sbin/duckdns-txt.sh
install -d -m 700 "$CONF"
if [ ! -s "$TOKEN" ]; then
    echo "PEGA_AQUI_EL_TOKEN_DE_DUCKDNS" > "$TOKEN"
fi
chmod 600 "$TOKEN"
if ! tr -d ' \t\r\n' < "$TOKEN" | grep -qE '^[0-9a-fA-F-]{36}$'; then
    echo
    echo "Falta el token de DuckDNS. Está en https://www.duckdns.org, arriba, al entrar con tu cuenta."
    echo "Para ponerlo (se abre el editor; borra la línea que hay, pega el token, Ctrl+O, Intro, Ctrl+X):"
    echo "   ssh -t openwebrx 'sudo nano $TOKEN'"
    echo "Después vuelve a ejecutar: sudo bash ~/https-install.sh"
    exit 2
fi
echo "   token de DuckDNS puesto"

echo "3) Certificado de Let's Encrypt para $DOMINIO"
if [ -s "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
    echo "   ya estaba (se renueva solo)"
else
    certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
        --manual --preferred-challenges dns \
        --manual-auth-hook "/usr/local/sbin/duckdns-txt.sh poner" \
        --manual-cleanup-hook "/usr/local/sbin/duckdns-txt.sh quitar" \
        -d "$DOMINIO"
fi
install -D -m 755 "$SRC/recargar-nginx.sh" /etc/letsencrypt/renewal-hooks/deploy/recargar-nginx.sh
systemctl enable -q certbot.timer
openssl x509 -noout -enddate -in "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" | sed 's/^/   válido hasta: /'

echo "4) nginx en el puerto $PUERTO"
[ -f /etc/nginx/sites-available/owrx-https ] && cp -a /etc/nginx/sites-available/owrx-https "$CONF/owrx-https.conf.bak-$TS"
sed "s/DOMINIO/$DOMINIO/g" "$SRC/owrx-https.conf" > /etc/nginx/sites-available/owrx-https
ln -sf ../sites-available/owrx-https /etc/nginx/sites-enabled/owrx-https
nginx -t -q
systemctl enable -q nginx
systemctl restart nginx

echo "5) Cortafuegos"
ufw allow $PUERTO/tcp comment 'OpenWebRX https' >/dev/null
ufw status | grep -E "^$PUERTO/tcp" | head -1 | sed 's/^/   /'

echo "6) Comprobación"
sleep 2
c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$DOMINIO:$PUERTO:127.0.0.1" "https://$DOMINIO:$PUERTO/")
[ "$c" = 200 ] || { echo "   FALLO: https://$DOMINIO:$PUERTO/ responde $c" >&2; exit 1; }
certbot renew --dry-run -q && echo "   renovación automática probada: correcta"
echo
echo "Listo: https://$DOMINIO:$PUERTO/   (http://$DOMINIO:8073/ sigue igual)"
echo "Para quitarlo: sudo bash ~/https-uninstall.sh"
