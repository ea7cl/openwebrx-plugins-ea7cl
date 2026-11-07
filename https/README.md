# https

El receptor también por **https**, con certificado gratuito de **Let's Encrypt**:

| Dirección | Qué es |
|---|---|
| `http://ea7cl-sdr.duckdns.org:8073/` | Como siempre. No cambia nada: los enlaces que ya circulan siguen funcionando. |
| `https://ea7cl-sdr.duckdns.org:8443/` | Lo mismo por https: sin el aviso de "No seguro" y con todo lo que los navegadores solo permiten en https (el reductor de ruido NR de audio_dsp, por ejemplo). |

## Cómo funciona

- **nginx** (de Ubuntu) recibe el https en el 8443 y se lo pasa a OpenWebRX por dentro (127.0.0.1:8073).
  Le pasa la IP real de cada oyente, así que el límite de conexiones por IP, los vetos y parse2ban
  funcionan igual que en el 8073.
- **certbot** (de Ubuntu) pide el certificado a Let's Encrypt y lo **renueva solo** (lo mira dos veces
  al día y lo cambia unas semanas antes de que caduque). Después recarga nginx sin cortar a nadie.
  OpenWebRX no se reinicia.
- Let's Encrypt comprueba que el dominio es tuyo por **DNS**: el script `duckdns-txt.sh` publica un
  texto temporal en DuckDNS con el token de la cuenta. No hace falta abrir el puerto 80.

Gratis y sin cuotas: Let's Encrypt es una fundación sin ánimo de lucro y DuckDNS ya se usaba para el
nombre del receptor. Si DuckDNS dejara de funcionar unas semanas, el https caducaría; el http del
8073 seguiría funcionando igual.

## Router

Abrir el puerto **8443 TCP** hacia el servidor (192.168.1.115). Solo TCP; UDP no hace falta.

## Archivos en el servidor

| Archivo | Para qué |
|---|---|
| `/etc/owrx-https/duckdns-token` | Token de DuckDNS (solo lo lee root). **No se sube a git.** |
| `/usr/local/sbin/duckdns-txt.sh` | Validación por DNS en DuckDNS (lo llama certbot). |
| `/etc/nginx/sites-available/owrx-https` | nginx en el 8443. |
| `/etc/letsencrypt/` | Certificado y su renovación. |
| `/etc/letsencrypt/renewal-hooks/deploy/recargar-nginx.sh` | Recarga nginx tras renovar. |

## Instalar

```bash
scp https/scripts/https-*.sh https/servidor/* openwebrx:~/
ssh -t openwebrx 'sudo bash ~/https-install.sh'
```

La primera vez se para y pide el token de DuckDNS (en https://www.duckdns.org, arriba, al entrar con
la cuenta). Se pone con:

```bash
ssh -t openwebrx 'sudo nano /etc/owrx-https/duckdns-token'
```

y se vuelve a ejecutar el instalador. Comprueba él solo que el https responde y que la renovación
automática funciona.

## Comprobar

```bash
ssh openwebrx 'sudo certbot certificates; systemctl list-timers certbot.timer'
```

## Quitar

```bash
ssh -t openwebrx 'sudo bash ~/https-uninstall.sh'
```

Para nginx, quita el 8443 del cortafuegos y aparta certificado, token y configuración en
`/home/ea7cl/desinstalado-https-FECHA`. No toca OpenWebRX ni el 8073.
