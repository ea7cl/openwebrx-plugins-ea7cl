#!/bin/bash
# Instala o actualiza el plugin perfil_recordado (EA7CL): cada navegador vuelve a su último perfil, frecuencia y modo.
# Copiar antes al servidor:  scp perfil_recordado/perfil_recordado.js perfil_recordado/scripts/perfil_recordado-install.sh perfil_recordado/scripts/perfil_recordado-uninstall.sh openwebrx:~/
# Uso:  sudo bash ~/perfil_recordado-install.sh
set -e
if [ "$(id -u)" -ne 0 ]; then echo "Hay que ejecutarlo con sudo" >&2; exit 1; fi
D=${D:-/usr/lib/python3/dist-packages/htdocs/plugins/receiver}
SRC=${SRC:-/home/ea7cl}
TS=$(date +%Y-%m-%d-%H%M)

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/perfil_recordado/perfil_recordado.js" ]; then
    cp -a "$D/perfil_recordado/perfil_recordado.js" "$SRC/perfil_recordado.js.bak-$TS"
    echo "Copia de seguridad: $SRC/perfil_recordado.js.bak-$TS"
fi

mkdir -p "$D/perfil_recordado"
install -m 644 "$SRC/perfil_recordado.js" "$D/perfil_recordado/perfil_recordado.js"
echo "Plugin copiado: $D/perfil_recordado/perfil_recordado.js"

LINEA="Plugins.load('perfil_recordado');   // EA7CL: cada navegador vuelve a su último perfil, frecuencia y modo"
if grep -qE "^[[:space:]]*Plugins\.load\('perfil_recordado'\);" "$D/init.js"; then
    echo "init.js ya cargaba perfil_recordado, no se toca"
elif grep -qE "^[[:space:]]*Plugins\.load\('rig_skin'\);" "$D/init.js"; then
    # depende de rig_skin: va justo debajo de su carga
    sed -i -E "0,/^[[:space:]]*Plugins\.load\('rig_skin'\);/{/^[[:space:]]*Plugins\.load\('rig_skin'\);/a $LINEA
}" "$D/init.js"
    echo "Añadida a init.js, debajo de rig_skin: $LINEA"
else
    echo "ERROR: init.js no carga rig_skin, del que depende este plugin; no se toca init.js" >&2
    exit 1
fi

echo
echo "Listo. Ctrl+F5 en el navegador (el servidor deja que el navegador guarde los plugins hasta una hora)."
echo "Para quitarlo: sudo bash ~/perfil_recordado-uninstall.sh"
