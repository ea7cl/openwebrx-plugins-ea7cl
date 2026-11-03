#!/bin/bash
# Instala o actualiza el plugin scan_recordado (ventana MEM, recordada por navegador) con copias de seguridad previas
set -e
D=/usr/lib/python3/dist-packages/htdocs/plugins/receiver
TS=$(date +%Y-%m-%d-%H%M)
SRC=/home/ea7cl/scan_recordado.js

cp -a "$D/init.js" "$D/init.js.bak-$TS"
echo "Copia de seguridad: $D/init.js.bak-$TS"

if [ -f "$D/scan_recordado/scan_recordado.js" ]; then
    cp -a "$D/scan_recordado/scan_recordado.js" "/home/ea7cl/scan_recordado.js.bak-$TS"
    echo "Copia de seguridad: /home/ea7cl/scan_recordado.js.bak-$TS"
fi

mkdir -p "$D/scan_recordado"
install -m 644 "$SRC" "$D/scan_recordado/scan_recordado.js"
echo "Plugin copiado: $D/scan_recordado/scan_recordado.js"

if grep -q "Plugins.load('scan_recordado')" "$D/init.js"; then
    echo "init.js ya cargaba scan_recordado, no se toca"
else
    # necesita utils: va justo debajo de toggle_scannable, dentro del bloque
    # que espera a que utils esté cargado
    LINEA='^[[:space:]]*Plugins.load(.*toggle_scannable'
    if ! grep -q "$LINEA" "$D/init.js"; then
        echo "ERROR: init.js no carga toggle_scannable; no se toca init.js" >&2
        exit 1
    fi
    sed -i "0,/$LINEA/{/$LINEA/a Plugins.load('scan_recordado');   // EA7CL: recordar las marcas de scan de cada oyente
}" "$D/init.js"
    echo "Añadida a init.js, debajo de toggle_scannable: Plugins.load('scan_recordado');"
fi

# lista completa de memorias para el buscador, regenerada cada vez que
# cambian los marcadores (gen_memorias.py se queda en /home/ea7cl, como gen_profiles.py)
U=scan-recordado-memorias
if [ -f /home/ea7cl/gen_memorias.py ]; then
    chmod 755 /home/ea7cl/gen_memorias.py
    install -m 644 "/home/ea7cl/$U.path" "/home/ea7cl/$U.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now "$U.path"
    python3 /home/ea7cl/gen_memorias.py
    echo "Vigilante activo: $U.path (regenera $D/scan_recordado/memorias.json)"
fi

echo
echo "Para volver atras:"
echo "  sudo systemctl disable --now $U.path; sudo rm -f /etc/systemd/system/$U.path /etc/systemd/system/$U.service; sudo systemctl daemon-reload"
echo "  sudo cp -a $D/init.js.bak-$TS $D/init.js && sudo rm -r $D/scan_recordado"
