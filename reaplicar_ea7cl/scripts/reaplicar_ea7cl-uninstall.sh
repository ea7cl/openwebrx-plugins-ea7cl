#!/bin/bash
# Desinstala reaplicar_ea7cl (EA7CL). No borra nada: aparta el programa, el aviso de apt y los cambios
# guardados en /home/ea7cl/desinstalado-reaplicar_ea7cl-FECHA.
# NO deshace los cambios ya puestos en los archivos de OpenWebRX (ni quita sessionstats.py, que necesita
# connection.py mientras siga cambiado). Para volver a los archivos originales del paquete:
#   sudo apt install --reinstall openwebrx      (fm-calidad, am-calidad y estéreo se vuelven a poner solos)
# Uso:  sudo bash scripts/reaplicar_ea7cl-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
SBIN=${SBIN:-/usr/local/sbin}
BASE=${BASE:-/usr/local/share/reaplicar-ea7cl}
APTD=${APTD:-/etc/apt/apt.conf.d}
TS=$(date +%Y-%m-%d-%H%M)
BK=${BK:-/home/ea7cl/desinstalado-reaplicar_ea7cl-$TS}

mkdir -p "$BK"
[ -f "$APTD/99owrx-reaplicar-ea7cl" ] && mv "$APTD/99owrx-reaplicar-ea7cl" "$BK/" && echo "Aviso de apt apartado"
[ -f "$SBIN/reaplicar_ea7cl" ] && mv "$SBIN/reaplicar_ea7cl" "$BK/" && echo "Programa apartado"
[ -d "$BASE" ] && mv "$BASE" "$BK/reaplicar-ea7cl" && echo "Cambios guardados apartados"

echo
echo "Desinstalado. Todo está en $BK"
echo "Para volver a ponerlo tal como estaba:"
echo "  sudo mv $BK/99owrx-reaplicar-ea7cl $APTD/ && sudo mv $BK/reaplicar_ea7cl $SBIN/ && sudo mv $BK/reaplicar-ea7cl $BASE"
