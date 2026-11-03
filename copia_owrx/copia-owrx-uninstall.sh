#!/bin/bash
# Desinstala los scripts de copia y actualización de OpenWebRX+ (EA7CL).
# No toca OpenWebRX+ ni borra las copias hechas: los scripts se apartan a
# /home/ea7cl/owrx-personalizado/desinstalado-FECHA y las copia-FECHA y paquetes/ se quedan donde están.
# Uso:  sudo bash ~/copia-owrx-uninstall.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
BASE=/home/ea7cl/owrx-personalizado
TS=$(date +%Y-%m-%d-%H%M)
BK=$BASE/desinstalado-$TS

mkdir -p "$BK"
for f in lib-owrx.sh crear-copia.sh actualizar.sh LEEME.txt; do
    [ -f "$BASE/$f" ] && mv "$BASE/$f" "$BK/"
done
echo "Scripts apartados en $BK"
echo "Las copias (copia-FECHA, sus .tar.gz y paquetes/) siguen en $BASE; bórralas a mano si ya no las quieres."
echo "restaurar.sh se deja en $BASE y dentro de cada copia, para poder volver a una copia aunque no estén los demás."
echo
echo "Para volver a ponerlos:  sudo mv $BK/* $BASE/"
