#!/bin/bash
# certbot lo ejecuta cada vez que renueva el certificado: nginx coge el nuevo sin cortar a nadie.
# (OpenWebRX no se toca: el https lo hace nginx)
systemctl reload nginx
