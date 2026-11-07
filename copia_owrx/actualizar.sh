#!/bin/bash
# Actualiza OpenWebRX+ sin perder nada de lo personalizado (EA7CL).
#
#   sudo bash actualizar.sh --prueba     qué trae la versión nueva y cómo quedarían tus cambios; no toca nada
#   sudo bash actualizar.sh              copia completa, actualiza, repone tus cambios y lo comprueba
#   sudo bash actualizar.sh --continuar  sigue una actualización parada por choques, ya resueltos
#   sudo bash actualizar.sh --volver     deja todo como estaba antes de la última actualización
#
# Para cada archivo de OpenWebRX+ que has cambiado compara tres versiones: la original de la
# versión instalada, la tuya y la original de la versión nueva.
#   - La versión nueva no lo cambia:      se pone el tuyo tal cual.
#   - La versión nueva sí lo cambia:      se combinan sus novedades con tus cambios.
#   - Los dos cambian las mismas líneas:  CHOQUE. No se instala nada hasta resolverlo.
# Antes de instalar hace la copia completa (crear-copia.sh). Después comprueba que OpenWebRX
# arranca, responde, no da errores y tiene todos tus cambios y plugins; si algo falla, vuelve
# solo a como estaba.
set -uo pipefail
SRC=$(cd "$(dirname "$0")" && pwd)
. "$SRC/lib-owrx.sh"
URL=http://127.0.0.1:8073/
LOG=$BASE/actualizaciones.log
APT=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
TS=$(date +%Y-%m-%d-%H%M)

MODO=${1:-}
case "$MODO" in ""|--prueba|--continuar|--volver) ;; *) sed -n '3,7p' "$0"; exit 1 ;; esac
[ "$(id -u)" = 0 ] || { echo "Hay que ejecutarlo con sudo"; exit 1; }
exec 9>/run/owrx-actualizar.lock
flock -n 9 || { echo "Ya hay una actualización en marcha"; exit 1; }
[ "$MODO" = --prueba ] || exec > >(tee -a "$LOG") 2>&1
echo "===== $(date '+%F %T')  actualizar.sh $MODO"

fallo() { echo; printf 'ERROR: %b\n' "$*"; exit 1; }

# Prepara en $W/combinados cada archivo tuyo ya adaptado a la versión nueva y deja en
# $W/resultado qué ha pasado con cada uno. RAIZ solo se usa en las pruebas del script.
combinar() {
    local e f mio viejo nuevo out
    CHOQUES=0
    : > "$W/resultado"
    : > "$W/duenos"     # dueño de cada archivo tuyo, para dejarlo igual al ponerlo
    while read -r f; do
        mio=${RAIZ:-}$f; viejo=$W/viejo$f; nuevo=$W/nuevo$f; out=$W/combinados$f
        mkdir -p "$(dirname "$out")"
        if [ ! -e "$mio" ]; then e=borrado
        elif [ ! -e "$nuevo" ]; then e=desaparece
        elif [ ! -e "$viejo" ] || cmp -s "$viejo" "$nuevo"; then cp -a "$mio" "$out"; e=igual
        elif cmp -s "$mio" "$nuevo"; then e=incluido
        elif ! grep -Iq . "$mio"; then cp -a "$mio" "$out"; e=binario
        else
            cp -a "$mio" "$out"
            diff -u --label "$f ($VIEJA)" --label "$f ($NUEVA)" "$viejo" "$nuevo" > "$out.novedades.diff"
            if git merge-file -q -L tuyo -L "original $VIEJA" -L "nuevo $NUEVA" "$out" "$viejo" "$nuevo"; then
                e=combinado
            else
                e=CHOQUE
            fi
        fi
        if [ "$e" = combinado ] && ! python_correcto "$out"; then e=CHOQUE; fi
        [ "$e" = CHOQUE ] && CHOQUES=$((CHOQUES + 1))
        echo "$e|$f" >> "$W/resultado"
        [ -e "$mio" ] && echo "$(stat -c %u:%g "$mio")|$f" >> "$W/duenos"
    done < "$W/lista"
}

python_correcto() {
    [[ $1 != *.py ]] || python3 -c 'import ast, sys; ast.parse(open(sys.argv[1]).read())' "$1" 2>/dev/null
}

informe() {
    local e f
    echo "Tus archivos de OpenWebRX+ modificados:"
    while IFS='|' read -r e f; do
        case $e in
            igual)      echo "  sin novedades, se pone el tuyo:        $f" ;;
            combinado)  echo "  novedades + tus cambios, combinados:   $f" ;;
            incluido)   echo "  la versión nueva ya trae tu cambio:    $f" ;;
            binario)    echo "  AVISO imagen distinta, se pone la tuya: $f" ;;
            desaparece) echo "  AVISO la versión nueva ya no lo tiene: $f (tu cambio se pierde)" ;;
            borrado)    echo "  lo borraste tú, se vuelve a borrar:    $f" ;;
            CHOQUE)     echo "  CHOQUE, hay que revisarlo:             $f" ;;
        esac
    done < "$W/resultado"
    local conf otros
    conf=$(dpkg --verify openwebrx | awk '$2 == "c" {print $NF}' | while read -r f; do
        [ -e "$W/viejo$f" ] && [ -e "$W/nuevo$f" ] && ! cmp -s "$W/viejo$f" "$W/nuevo$f" && echo "  $f"
    done)
    if [ -n "$conf" ]; then
        echo
        echo "La versión nueva cambia configuración que tienes modificada. Se mantiene la tuya;"
        echo "la de la versión nueva quedará al lado como .dpkg-dist, por si quieres mirarla:"
        echo "$conf"
    fi
    otros=$(while read -r f; do [ -e "$W/nuevo$f" ] && echo "  $f"; done < "$W/propios")
    if [ -n "$otros" ]; then
        echo
        echo "La versión nueva trae archivos con el mismo nombre que unos tuyos; se vuelven a poner los tuyos:"
        echo "$otros"
    fi
}

novedades() {
    local cl=$W/nuevo/usr/share/doc/openwebrx/changelog.gz
    [ -e "$cl" ] || return 0
    echo "Novedades de la versión nueva:"
    zcat "$cl" | awk -v v="($VIEJA)" 'index($0, v) {exit} {print "  " $0}'
}

# Errores de Python del registro de openwebrx desde $1 que indican código roto. Los demás
# (oyentes que se desconectan, IPs baneadas, fallos de red o de un decodificador) salen
# cada día con todo funcionando bien, así que no cuentan.
errores_python() {
    journalctl -u openwebrx --since "$1" --no-pager -o cat \
        | awk '/^Traceback/ {t = 1; next} t && !/^[ \t]/ {print; t = 0}' \
        | grep -E '^(SyntaxError|IndentationError|TabError|ImportError|ModuleNotFoundError|NameError|UnboundLocalError|AttributeError|TypeError)\b'
}

# Comprueba que OpenWebRX funciona y que están tus cambios. $1 = desde cuándo mirar el registro
comprobar() {
    local ok=1 n e f limite
    # Con todos los SDR y bases de datos tarda más de un minuto en responder: se espera hasta 5
    limite=$((SECONDS + 300))
    echo "  Esperando a que OpenWebRX responda (puede tardar un par de minutos)..."
    while [ $SECONDS -lt $limite ]; do
        curl -fs -o /dev/null --max-time 5 "$URL" && break
        systemctl is-failed -q openwebrx && break
        sleep 3
    done
    systemctl is-active -q openwebrx || { echo "  FALLO: el servicio openwebrx no está en marcha"; ok=0; }
    curl -fs -o /dev/null --max-time 5 "$URL" || { echo "  FALLO: la página no responde en $URL"; ok=0; }
    sleep 5
    n=$(errores_python "$1" | wc -l)
    if [ "$n" != 0 ]; then
        echo "  FALLO: $n errores de Python en el registro de openwebrx, por ejemplo:"
        errores_python "$1" | sort | uniq -c | sort -rn | head -3
        ok=0
    fi
    if [ -f "$W/resultado" ]; then
        while IFS='|' read -r e f; do
            case $e in igual|combinado|binario|CHOQUE)
                cmp -s "$W/combinados$f" "$f" || { echo "  FALLO: no está tu cambio en $f"; ok=0; } ;;
            esac
        done < "$W/resultado"
    fi
    for n in $(grep -v '^\s*//' $P/htdocs/plugins/receiver/init.js | grep -o "Plugins.load('[A-Za-z0-9_]*')" | cut -d"'" -f2); do
        [ -f "$P/htdocs/plugins/receiver/$n/$n.js" ] || { echo "  FALLO: falta el plugin $n"; ok=0; }
    done
    [ $ok = 1 ] && echo "  Correcto: OpenWebRX en marcha y respondiendo, sin errores, con tus cambios y todos los plugins."
    [ $ok = 1 ]
}

# Vuelve a las versiones, configuración y archivos de la copia $1
volver() {
    local C=$1 p v d desde paq=() A W=""
    echo
    echo "Volviendo a como estaba en $(basename "$C") (OpenWebRX+ $(cat "$C/version.txt"))"
    systemctl stop openwebrx
    while IFS='=' read -r p v; do
        [ "$(version_de "$p")" = "$v" ] && continue
        d=$(deb_nombre "$p" "$v")
        if [ -s "$d" ]; then paq+=("$d"); else echo "  AVISO: no está guardado el paquete $p $v"; fi
    done < "$C/versiones.txt"
    if [ ${#paq[@]} -gt 0 ]; then
        apt-get install --allow-downgrades "${APT[@]}" "${paq[@]}" || echo "  AVISO: apt-get no ha podido reinstalar todo"
    fi
    # la configuración de ese momento (la versión nueva puede haberla convertido a su formato)
    A=$BASE/antes-de-volver-$TS
    mkdir -p "$A"
    cp -a /etc/openwebrx "$A/etc-openwebrx"
    cp -a /var/lib/openwebrx "$A/var-lib-openwebrx"
    rsync -a --delete "$C/config/etc-openwebrx/" /etc/openwebrx/
    rsync -a --delete "$C/config/var-lib-openwebrx/" /var/lib/openwebrx/
    # las copias antiguas tienen la configuración con dueño ea7cl: se dejan los dueños de antes
    duenos_como "$A/etc-openwebrx" /etc/openwebrx root:root
    duenos_como "$A/var-lib-openwebrx" /var/lib/openwebrx openwebrx:openwebrx
    echo "  Configuración repuesta (la que había quedó en $A)"
    (cd "$C" && bash restaurar.sh) | grep -v '^Para que se aplique'
    desde=$(date '+%F %T')
    systemctl restart openwebrx
    comprobar "$desde"
}

VIEJA=$(version_de openwebrx)

if [ "$MODO" = --volver ]; then
    C=""
    for d in $(ls -1d "$BASE"/copia-*/ 2>/dev/null | sort -r); do
        d=${d%/}
        if [ -s "$d/versiones.txt" ] && [ "$(cat "$d/version.txt")" != "$VIEJA" ]; then C=$d; break; fi
    done
    [ -n "$C" ] || fallo "no hay ninguna copia de una versión distinta de la instalada ($VIEJA)"
    volver "$C"
    exit $?
fi

if [ "$MODO" = --continuar ]; then
    W=$(ls -1d "$BASE"/actualizacion-*/ 2>/dev/null | sort | tail -1)
    W=${W%/}
    [ -n "$W" ] && [ -f "$W/pendiente" ] || fallo "no hay ninguna actualización parada"
    . "$W/estado"
    [ "$(version_de openwebrx)" = "$VIEJA" ] || fallo "la versión instalada ya no es $VIEJA"
    QUEDAN=""
    while IFS='|' read -r e f; do
        [ "$e" = CHOQUE ] || continue
        if grep -q -e '^<<<<<<< ' -e '^>>>>>>> ' "$W/combinados$f" || ! python_correcto "$W/combinados$f"; then
            QUEDAN="$QUEDAN  $W/combinados$f\n"
        fi
    done < "$W/resultado"
    [ -z "$QUEDAN" ] || fallo "todavía quedan choques sin resolver (marcas <<<<<<< / >>>>>>>) en:\n$QUEDAN"
    echo "Choques resueltos; se sigue con la actualización de $VIEJA a $NUEVA"
else
    apt-get update -q >/dev/null || fallo "no se pudo consultar el repositorio (apt-get update)"
    NUEVA=$(LC_ALL=C apt-cache policy openwebrx | awk '/Candidate:/ {print $2}')
    echo "OpenWebRX+ instalado: $VIEJA   disponible: $NUEVA"
    if [ "$NUEVA" = "$VIEJA" ]; then echo "No hay versión nueva; no se hace nada."; exit 0; fi

    if [ "$MODO" = --prueba ]; then
        W=$(mktemp -d /tmp/owrx-prueba.XXXXXX)
        trap 'rm -rf "$W"' EXIT
        guardar_deb openwebrx original || fallo "no se encuentra el paquete original de $VIEJA (haz antes crear-copia.sh)"
        modificados > "$W/lista"
        propios > "$W/propios"
    else
        echo
        echo "1) Copia completa de lo que hay ahora"
        bash "$SRC/crear-copia.sh" || fallo "no se pudo hacer la copia; no se ha tocado nada"
        C=$(ls -1d "$BASE"/copia-*/ | sort | tail -1)
        C=${C%/}
        W=$BASE/actualizacion-$NUEVA-$TS
        mkdir -p "$W"
        cp "$C/modificados.txt" "$W/lista"
        cp "$C/propios.txt" "$W/propios"
        printf 'VIEJA=%q\nNUEVA=%q\nC=%q\n' "$VIEJA" "$NUEVA" "$C" > "$W/estado"
        echo
        echo "2) Comparando tus cambios con la versión nueva"
    fi
    [ -s "$(deb_nombre openwebrx "$VIEJA")" ] || fallo "no está el paquete original de $VIEJA"
    chmod 755 "$W"
    (cd "$W" && apt-get download -q "openwebrx=$NUEVA" >/dev/null 2>&1) || fallo "no se pudo descargar OpenWebRX+ $NUEVA"
    dpkg-deb -x "$(deb_nombre openwebrx "$VIEJA")" "$W/viejo"
    dpkg-deb -x "$W"/openwebrx_*.deb "$W/nuevo"
    combinar
    echo
    novedades
    echo
    informe
    echo
    if [ "$MODO" = --prueba ]; then
        if [ $CHOQUES = 0 ]; then
            echo "Se puede actualizar sin problemas: sudo bash $SRC/actualizar.sh"
        else
            echo "Hay $CHOQUES choques: al actualizar se parará antes de instalar para resolverlos."
        fi
        echo "MODO PRUEBA: no se ha cambiado nada."
        exit 0
    fi
    if [ $CHOQUES -gt 0 ]; then
        touch "$W/pendiente"
        chown -R ea7cl: "$W"
        echo "PARADO ANTES DE INSTALAR: hay $CHOQUES choques. No se ha cambiado nada en OpenWebRX."
        echo "En cada archivo con CHOQUE, dentro de $W/combinados/..., hay que dejar"
        echo "una sola versión entre las marcas <<<<<<< tuyo / ======= / >>>>>>> nuevo y quitar las marcas"
        echo "(las novedades de la versión nueva están en el .novedades.diff de al lado). Después:"
        echo "  sudo bash $SRC/actualizar.sh --continuar"
        exit 2
    fi
fi

echo
echo "3) Instalando OpenWebRX+ $NUEVA"
systemctl stop openwebrx
apt-get install --only-upgrade "${APT[@]}" $(paquetes_owrx)
if [ "$(version_de openwebrx)" != "$NUEVA" ]; then
    echo "FALLO: la instalación no ha terminado bien"
    volver "$C"
    exit 1
fi

echo
echo "4) Poniendo tus cambios"
while IFS='|' read -r e f; do
    case $e in
        igual|combinado|binario|CHOQUE)
            cp -a "$W/combinados$f" "$f"
            o=$(awk -F'|' -v f="$f" '$2 == f {print $1}' "$W/duenos" 2>/dev/null)
            chown -h "${o:-root:root}" "$f"
            echo "  puesto:   $f" ;;
        borrado) rm -f "$f"; echo "  borrado:  $f" ;;
    esac
done < "$W/resultado"
while read -r f; do
    cmp -s "$C/propios$f" "$f" && continue
    mkdir -p "$(dirname "$f")"
    o=$(stat -c %u:%g "$f" 2>/dev/null || true)
    cp -a "$C/propios$f" "$f"
    [ -z "$o" ] || chown -h "$o" "$f"
    echo "  repuesto: $f"
done < "$W/propios"

echo
echo "5) Arrancando y comprobando"
DESDE=$(date '+%F %T')
systemctl restart openwebrx
if ! comprobar "$DESDE"; then
    echo "Algo no ha ido bien con la versión nueva."
    volver "$C"
    echo "La actualización está guardada en $W para revisarla."
    exit 1
fi
rm -f "$W/pendiente"
chown -R ea7cl: "$W"

DIST=$(find /etc/openwebrx -name '*.dpkg-dist' -newer "$W/estado" 2>/dev/null)
if [ -n "$DIST" ]; then
    echo
    echo "Configuración nueva de la versión $NUEVA, para mirar (se mantiene la tuya):"
    echo "$DIST" | sed 's/^/  /'
fi

echo
echo "6) Copia de la versión nueva ya personalizada (base para la próxima actualización)"
bash "$SRC/crear-copia.sh" | tail -2
echo
echo "OpenWebRX+ actualizado de $VIEJA a $NUEVA con todas tus personalizaciones."
echo "Recarga el receptor en el navegador con Ctrl+F5."
