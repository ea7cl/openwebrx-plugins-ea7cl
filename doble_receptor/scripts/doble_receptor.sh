#!/bin/bash
# doble_receptor 2.1 (EA7CL) · instalar / estado / deshacer, con copia de seguridad
#
#   bash doble_receptor.sh estado
#   sudo bash doble_receptor.sh aplicar [modo]  (hace copia antes de tocar nada; modo por defecto: enlace)
#   sudo bash doble_receptor.sh modo enlace     (DUAL solo entrando con  http://servidor:8073/?dual )
#   sudo bash doble_receptor.sh modo todos      (tecla DUAL para todos los oyentes)
#   sudo bash doble_receptor.sh modo apagado    (como si no estuviera; el plugin se queda guardado)
#   sudo bash doble_receptor.sh deshacer        (lo deja todo como estaba, desde la copia)
#
# Los modos solo cambian la línea del plugin en init.js: efecto inmediato, sin
# reiniciar OpenWebRX (los oyentes lo ven al recargar la página, Ctrl+F5).
#
# Toca solo:
#   htdocs/plugins/receiver/doble_receptor/                  (carpeta nueva del plugin)
#   htdocs/plugins/receiver/anti_iframe/anti_iframe.js       (0.1 -> 0.2: permite la propia web)
#   htdocs/plugins/receiver/rig_fil_ea7cl/rig_fil_ea7cl.js   (0.1 -> 0.2: no se apaga con el doble receptor 2)
#   htdocs/plugins/receiver/init.js                          (una línea al final)
# No reinicia OpenWebRX ni toca su configuración. En el navegador: Ctrl+F5.
set -e

AQUI="$(cd "$(dirname "$0")" && pwd)"
# dónde están los archivos: junto al script (carpeta doble-receptor-2) o en el
# repositorio openwebrx-plugins-ea7cl (este script en doble_receptor/scripts/)
if [ -f "$AQUI/doble_receptor/doble_receptor.js" ]; then
    PLUG="$AQUI/doble_receptor"; FUENTE="$AQUI"; ORIG="$AQUI/original"
else
    PLUG="$(cd "$AQUI/.." && pwd)"; FUENTE="$(cd "$AQUI/../.." && pwd)"; ORIG="$PLUG/original"
fi
HTDOCS="${DR_HTDOCS:-/usr/lib/python3/dist-packages/htdocs}"
REC="$HTDOCS/plugins/receiver"
COPIAS="${DR_COPIAS:-/var/backups/doble-receptor-2}"
MARCA="EA7CL: doble receptor MAIN/SUB"
# una línea por modo, todas con la MARCA (así se encuentran, se cambian y se quitan)
LINEA_TODOS="Plugins.load('doble_receptor');   // EA7CL: doble receptor MAIN/SUB 2.0"
LINEA_ENLACE="(function () { var m = null; try { m = window.frameElement; } catch (e) {} if (/[?&]dual(=|&|\$)/.test(location.search) || (m && m.id === 'drx-sub')) Plugins.load('doble_receptor'); })();   // EA7CL: doble receptor MAIN/SUB, solo con ?dual"
LINEA_APAGADO="// Plugins.load('doble_receptor');   // EA7CL: doble receptor MAIN/SUB, apagado"
LINEA="$LINEA_TODOS"   # la de la 2.1.17 y anteriores

linea_de() {
    case "$1" in
        todos) echo "$LINEA_TODOS" ;;
        enlace) echo "$LINEA_ENLACE" ;;
        apagado) echo "$LINEA_APAGADO" ;;
        *) return 1 ;;
    esac
}

modo_actual() {
    local l; l="$(grep -F "$MARCA" "$REC/init.js" 2>/dev/null | head -1)"
    if [ -z "$l" ]; then echo "sin instalar"
    elif [ "$l" = "$LINEA_TODOS" ]; then echo "todos"
    elif [ "$l" = "$LINEA_ENLACE" ]; then echo "enlace"
    elif [ "$l" = "$LINEA_APAGADO" ]; then echo "apagado"
    else echo "desconocido"; fi
}

# cambia la línea del plugin en init.js (sin cambiar dueño ni permisos del archivo)
poner_linea() {
    local nueva="$1"
    NUEVA="$nueva" MARCA="$MARCA" awk 'index($0, ENVIRON["MARCA"]) { print ENVIRON["NUEVA"]; next } { print }' \
        "$REC/init.js" > "$REC/init.js.dr-tmp"
    cat "$REC/init.js.dr-tmp" > "$REC/init.js"
    rm -f "$REC/init.js.dr-tmp"
}

modo() {
    local nueva
    nueva="$(linea_de "$1")" || { echo "Modo desconocido: '$1' (todos | enlace | apagado)"; exit 1; }
    grep -q "$MARCA" "$REC/init.js" 2>/dev/null || { echo "El doble receptor no está instalado (primero: aplicar)"; exit 1; }
    [ -f "$REC/doble_receptor/doble_receptor.js" ] || { echo "Falta la carpeta del plugin: vuelva a aplicar"; exit 1; }
    poner_linea "$nueva"
    explicar_modo
}

explicar_modo() {
    case "$(modo_actual)" in
        todos)   echo "Modo: todos. Tecla DUAL en el panel para todos los oyentes." ;;
        enlace)  echo "Modo: enlace. La página normal no cambia; DUAL solo entrando con http://<servidor>:8073/?dual" ;;
        apagado) echo "Modo: apagado. Página normal para todos; el plugin sigue guardado." ;;
        *)       echo "Modo: $(modo_actual)" ;;
    esac
    echo "Los oyentes lo ven al recargar la página (Ctrl+F5)."
}
# plugins de EA7CL que se actualizan (carpeta/archivo, versión nueva)
OTROS="anti_iframe/anti_iframe.js:0.2 rig_fil_ea7cl/rig_fil_ea7cl.js:0.2"

version_de() { grep -oE "(_version = |VERSION = ')[0-9.]+" "$1" 2>/dev/null | head -1 | grep -oE "[0-9.]+$"; }

estado() {
    echo "OpenWebRX htdocs: $HTDOCS"
    if [ -f "$REC/doble_receptor/doble_receptor.js" ]; then
        echo "plugin:        instalado ($(grep -o "version = '[0-9.]*'" "$REC/doble_receptor/doble_receptor.js" | head -1))"
    else
        echo "plugin:        no instalado"
    fi
    echo "modo:          $(modo_actual)"
    local o
    for o in $OTROS; do
        printf '%-14s %s\n' "${o%%/*}:" "$(version_de "$REC/${o%%:*}" || true)"
    done
    if [ -d "$COPIAS" ]; then echo "copias:        $(ls -1 "$COPIAS" | tr '\n' ' ')"; else echo "copias:        ninguna"; fi
}

aplicar() {
    [ -f "$REC/init.js" ] || { echo "No encuentro $REC/init.js"; exit 1; }
    [ -f "$PLUG/doble_receptor.js" ] && [ -f "$PLUG/doble_receptor.css" ] || { echo "No encuentro doble_receptor.js y .css"; exit 1; }
    # modo: el pedido; si no se pide, el que ya tenía; si es nuevo, enlace
    local m="$1"
    if [ -z "$m" ]; then
        case "$(modo_actual)" in todos|enlace|apagado) m="$(modo_actual)" ;; *) m="enlace" ;; esac
    fi
    linea_de "$m" > /dev/null || { echo "Modo desconocido: '$m' (todos | enlace | apagado)"; exit 1; }
    # los otros plugins: solo se cambian si son exactamente la versión conocida (o ya la nueva)
    local o f
    for o in $OTROS; do
        f="${o%%:*}"
        if [ -f "$REC/$f" ] && ! cmp -s "$REC/$f" "$FUENTE/$f" && ! cmp -s "$REC/$f" "$ORIG/$(basename "$f")"; then
            echo "$f no es la versión conocida: no se toca nada."; exit 1
        fi
    done

    # 1) copia de seguridad de todo lo que se va a tocar
    # (nunca encima de otra copia: si ya hay una de este mismo segundo, -1, -2...)
    local C="$COPIAS/$(date +%Y%m%d-%H%M%S)" n=1
    while [ -e "$C" ]; do C="$COPIAS/$(date +%Y%m%d-%H%M%S)-$n"; n=$((n + 1)); done
    mkdir -p "$C"
    cp -a "$REC/init.js" "$C/init.js"
    for o in $OTROS; do
        f="${o%%:*}"
        [ -d "$REC/$(dirname "$f")" ] && cp -a "$REC/$(dirname "$f")" "$C/$(dirname "$f")"
    done
    [ -d "$REC/doble_receptor" ] && cp -a "$REC/doble_receptor" "$C/doble_receptor"
    ( cd "$C" && find . -type f -exec sha256sum {} + > SUMAS.txt )
    echo "Copia hecha en $C"

    # 2) instalar
    rm -rf "$REC/doble_receptor"
    mkdir -p "$REC/doble_receptor"
    cp "$PLUG/doble_receptor.js" "$PLUG/doble_receptor.css" "$REC/doble_receptor/"
    chmod -R a+rX "$REC/doble_receptor"
    for o in $OTROS; do
        f="${o%%:*}"
        if [ -d "$REC/$(dirname "$f")" ]; then cp "$FUENTE/$f" "$REC/$f"; chmod a+r "$REC/$f"; fi
    done
    if grep -q "$MARCA" "$REC/init.js"; then
        poner_linea "$(linea_de "$m")"
    else
        printf '\n%s\n' "$(linea_de "$m")" >> "$REC/init.js"
    fi
    echo "Instalado."
    explicar_modo
}

deshacer() {
    # la copia más reciente hecha ANTES de instalar (su init.js no tiene la línea);
    # las copias de reinstalaciones o actualizaciones no sirven para volver atrás
    local C="" d o f
    for d in $(ls -1d "$COPIAS"/*/ 2>/dev/null | sort -r); do
        d="${d%/}"
        if [ -f "$d/init.js" ] && ! grep -q "$MARCA" "$d/init.js"; then C="$d"; break; fi
    done
    [ -n "$C" ] || { echo "No hay copia de antes de instalar en $COPIAS"; exit 1; }
    echo "Restaurando desde $C"
    # init.js: si nadie lo ha tocado desde la instalación, vuelve byte a byte;
    # si lo han cambiado después, solo se quita la línea del plugin
    local igual=0 l
    for l in "$LINEA_TODOS" "$LINEA_ENLACE" "$LINEA_APAGADO"; do
        cmp -s "$REC/init.js" <(cat "$C/init.js"; printf '\n%s\n' "$l") && igual=1
    done
    if [ $igual = 1 ]; then
        cp -a "$C/init.js" "$REC/init.js"
    else
        grep -vF "$MARCA" "$REC/init.js" > "$REC/init.js.dr-tmp" && cat "$REC/init.js.dr-tmp" > "$REC/init.js" && rm -f "$REC/init.js.dr-tmp"
        echo "init.js había cambiado después de instalar: solo se quitó la línea del plugin."
    fi
    for o in $OTROS; do
        f="${o%%:*}"; d="$(dirname "$f")"
        if [ -d "$C/$d" ]; then rm -rf "$REC/$d"; cp -a "$C/$d" "$REC/$d"; fi
    done
    rm -rf "$REC/doble_receptor"
    if [ -d "$C/doble_receptor" ]; then cp -a "$C/doble_receptor" "$REC/doble_receptor"; fi
    echo "Hecho: todo como antes de instalar. En el navegador: Ctrl+F5."
}

case "$1" in
    estado) estado ;;
    aplicar) aplicar "$2" ;;
    modo) modo "$2" ;;
    deshacer) deshacer ;;
    *) echo "Uso: bash $0 estado | sudo bash $0 aplicar [todos|enlace|apagado] | sudo bash $0 modo todos|enlace|apagado | sudo bash $0 deshacer"; exit 1 ;;
esac
