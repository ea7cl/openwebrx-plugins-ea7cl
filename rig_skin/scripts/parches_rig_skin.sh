#!/bin/bash
# EA7CL: cambios propios en rig_skin que hay que repetir tras cada actualizacion.
# Lo llama /home/ea7cl/actualizar_rig_skin.sh al final; tambien se puede
# ejecutar solo. Se puede repetir sin problema (no duplica nada).
#  1) textos de la ventana SAT (orbitas) en espanol (0.10.18 y 0.10.19)
#  2) VFO A/B con resolucion de 10 Hz, las dos ultimas cifras mas pequenas
#  3) frecuencias largas (QO-100, 23 cm) con letra algo menor para que quepan
D=/usr/lib/python3/dist-packages/htdocs/plugins/receiver/rig_skin
JS=$D/rig_skin.js
CSS=$D/rig_skin.css

# 1) orbitas en espanol (textos de la 0.10.19; los de la 0.10.18 se dejan por si acaso)
sed -i \
 -e "s/'Update the orbits (at most every 2 hours, celestrak asks for that)'/'Actualizar las órbitas (como mucho cada 2 horas, lo pide celestrak)'/" \
 -e "s/'Update the orbits'/'Actualizar las órbitas'/" \
 -e "s/'the orbits are updating'/'se están actualizando las órbitas'/" \
 -e "s/'orbits updated '/'órbitas actualizadas a las '/" \
 -e "s/'orbits updated'/'órbitas actualizadas'/" \
 -e "s/'orbit update failed'/'falló la actualización de las órbitas'/g" \
 -e "s/'updating orbits'/'actualizando órbitas'/" \
 -e "s/'next update after '/'próxima actualización después de las '/g" \
 -e "s/'orbits: built-in set, '/'órbitas: juego incluido, '/" \
 -e "s/? 'orbits: ' +/? 'órbitas: ' +/" "$JS"

# 2) VFO a 10 Hz
sed -i \
 -e "s/var t = hz ? (hz \/ 1000000).toFixed(4) : '-.----';/var t = hz ? (hz \/ 1000000).toFixed(5) : '-.-----';/" \
 -e "s/var place = 100;   \/\/ the last shown decimal is the 100 Hz digit/var place = 10;   \/\/ EA7CL: la ultima cifra es la de 10 Hz/" "$JS"
if ! grep -q "EA7CL: 100 Hz y 10 Hz" "$CSS"; then
cat >> "$CSS" <<'FIN'

/* EA7CL: 100 Hz y 10 Hz mas pequenos en el VFO A/B (como en las emisoras) */
.owrx-rig-vfo-freq .owrx-rig-digit[data-place="10"],
.owrx-rig-vfo-freq .owrx-rig-digit[data-place="100"] {
    font-size: 68%;
    letter-spacing: 0;
}
FIN
fi

# frecuencias largas (QO-100 10489.54000, 23 cm 1296.20000): letra algo menor
# para que quepan enteras en la ventanita del VFO
if ! grep -q "EA7CL: frecuencias largas" "$CSS"; then
cat >> "$CSS" <<'FIN'

/* EA7CL: frecuencias largas en el VFO A/B (QO-100, 23 cm): letra algo menor */
.owrx-rig-vfo-freq:has(> span:nth-child(10)) { font-size: 18pt; }
.owrx-rig-vfo-freq:has(> span:nth-child(11)) { font-size: 16pt; }
FIN
fi

echo "Parches EA7CL (cada linea tiene que dar 1):"
echo -n "  orbitas en espanol: "; grep -c "Actualizar las órbitas" "$JS"
echo -n "  VFO a 10 Hz:        "; grep -c "toFixed(5) : '-.-----'" "$JS"
echo -n "  cifras pequenas:    "; grep -c "EA7CL: 100 Hz y 10 Hz" "$CSS"
echo -n "  QO-100 / 23 cm:     "; grep -c "EA7CL: frecuencias largas" "$CSS"

# 4) DX: spots de V/UHF solo hasta 800 km (rig_skin trae 2000)
sed -i 's/if (d !== null \&\& d > 2000) return;/if (d !== null \&\& d > 800) return;   \/\/ EA7CL: 800 km/' "$JS"
echo -n "  DX V/UHF 800 km:    "; grep -c "d > 800) return;" "$JS"
