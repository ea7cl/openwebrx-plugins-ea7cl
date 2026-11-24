#!/bin/sh
P=/usr/lib/python3/dist-packages/htdocs/plugins/receiver
F=$P/rig_skin/rig_skin.js
if ! grep -q "rig_colores_ea7cl" $P/init.js; then
  echo "PARADO: init.js no carga rig_colores_ea7cl; se perderian los colores."; exit 1
fi
mkdir -p /home/ea7cl/respaldos
COPIA=/home/ea7cl/respaldos/plugins-antes-$(date +%Y%m%d-%H%M).tar.gz
tar czf $COPIA -C $P . || { echo "PARADO: no se pudo hacer la copia"; exit 1; }
echo "Copia hecha: $COPIA"
curl -fsSL -o /home/ea7cl/update-rig-skin.sh https://raw.githubusercontent.com/aganet/openwebrxplus-rig-skin/main/update-rig-skin.sh || { echo "PARADO: no se pudo descargar el actualizador"; exit 1; }
sh /home/ea7cl/update-rig-skin.sh || { echo "PARADO: fallo el actualizador oficial; nada cambiado"; exit 1; }
sed -i "s/var MAX_ZOOM = [0-9.]*;/var MAX_ZOOM = 1;/" $F
sed -i "s/'orbit download failed, retrying'/'fallo al descargar las órbitas, reintentando'/; s/: 'loading orbits');/: 'cargando órbitas');/; s/note('HAM and WX are both off')/note('HAM y WX están desactivados')/" $F
sed -i "s/' ready, click to reload'/' lista, clic para recargar'/; s/'You run '/'Tienes la '/; s/'; ' + v + ' is on the server'/'; en el servidor está la ' + v/" $F
echo "--- Comprobacion (deben salir tres 1) ---"
echo "Tamano panel:   $(grep -c 'MAX_ZOOM = 1;' $F)"
echo "Avisos SAT:     $(grep -c 'cargando órbitas' $F)"
echo "Aviso version:  $(grep -c 'clic para recargar' $F)"
echo "Version: $(grep -o "^Plugins.rig_skin._version = '[^']*'" $F)"
bash /home/ea7cl/parches_rig_skin.sh
# EA7CL 24-11-2026: el actualizador oficial que se baja arriba no vuelve a poner
# los enganches de doppler_autostart en rig_skin.js; se ponen aqui
if [ -x $P/doppler_autostart/reapply.sh ]; then
  $P/doppler_autostart/reapply.sh
fi
echo "Enganches Doppler: $(grep -c DOPPLER_AUTOSTART_HOOK_BEGIN $F) (tienen que ser 3)"
