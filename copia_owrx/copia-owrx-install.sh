#!/bin/bash
# Instala o actualiza en el servidor los scripts de copia y actualización de OpenWebRX+ (EA7CL).
# Copiar antes al servidor:  scp copia_owrx/*.sh copia_owrx/LEEME.txt openwebrx:~/
# Uso:  sudo bash ~/copia-owrx-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
BASE=/home/ea7cl/owrx-personalizado
SRC=/home/ea7cl
TS=$(date +%Y-%m-%d-%H%M)

mkdir -p "$BASE"
for f in lib-owrx.sh crear-copia.sh actualizar.sh restaurar.sh LEEME.txt; do
    [ -f "$SRC/$f" ] || { echo "Falta $SRC/$f; cópialo antes con scp" >&2; exit 1; }
    [ -f "$BASE/$f" ] && cp -a "$BASE/$f" "$BASE/$f.bak-$TS"
    install -m 755 "$SRC/$f" "$BASE/$f"
done
chmod 644 "$BASE/LEEME.txt" "$BASE/lib-owrx.sh"
chown ea7cl:ea7cl "$BASE" "$BASE"/*.sh "$BASE/LEEME.txt"
echo "Scripts copiados en $BASE (las versiones anteriores quedan como .bak-$TS)"
echo "Instrucciones: $BASE/LEEME.txt"
