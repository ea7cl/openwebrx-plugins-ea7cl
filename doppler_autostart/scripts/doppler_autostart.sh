#!/bin/bash
# doppler_autostart 0.5 (EA7CL): estado / aplicar / deshacer
# Uso: sudo bash scripts/doppler_autostart.sh estado|aplicar|deshacer
# Solo cambia un archivo: plugins/receiver/doppler_autostart/doppler_autostart.js
# (init.js y el enganche en rig_skin de la 0.1 se quedan como están).
set -e
HTDOCS="${DA_HTDOCS:-/usr/lib/python3/dist-packages/htdocs}"
COPIAS="${DA_COPIAS:-/var/backups/doppler-autostart}"
DEST="$HTDOCS/plugins/receiver/doppler_autostart/doppler_autostart.js"
AQUI="$(cd "$(dirname "$0")" && pwd)"
NUEVO="$AQUI/../doppler_autostart.js"
SHA_01="33a0f48c62e18b5abf96925498cb1a81d2454ca6e10562659bdc1d3b2d93e348"

version() {
    [ -f "$DEST" ] || { echo "no está"; return; }
    if grep -q "_version = 0.[2-9]" "$DEST"; then echo "0.2 o posterior";
    elif [ "$(sha256sum "$DEST" | cut -d' ' -f1)" = "$SHA_01" ]; then echo "0.1 (la de ChatGPT)";
    else echo "desconocida"; fi
}

case "$1" in
estado)
    echo "doppler_autostart instalado: $(version)"
    ls -1 "$COPIAS" 2>/dev/null | sed 's/^/  copia: /' || true
    ;;
aplicar)
    v="$(version)"
    case "$v" in
        "0.2 o posterior") if cmp -s "$NUEVO" "$DEST"; then echo "Ya está esta versión."; exit 0; fi ;;
        "0.1 (la de ChatGPT)") ;;
        *) echo "No se instala: el archivo actual no es la 0.1 conocida ($v)."; exit 1 ;;
    esac
    [ -f "$NUEVO" ] || { echo "Falta $NUEVO"; exit 1; }
    F="$COPIAS/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$F"
    cp -p "$DEST" "$F/doppler_autostart.js"
    (cd "$F" && sha256sum doppler_autostart.js > SHA256)
    install -m 644 "$NUEVO" "$DEST"
    echo "Instalada la 0.5. Copia de la anterior en $F"
    echo "En el navegador: Ctrl+F5."
    ;;
deshacer)
    U="$(ls -1d "$COPIAS"/*/ 2>/dev/null | sort | tail -1)"
    [ -n "$U" ] || { echo "No hay copias en $COPIAS"; exit 1; }
    (cd "$U" && sha256sum -c SHA256 >/dev/null) || { echo "La copia $U no cuadra con su SHA256"; exit 1; }
    install -m 644 "$U/doppler_autostart.js" "$DEST"
    echo "Vuelta a la versión de $U: $(version)"
    ;;
*)
    echo "Uso: sudo bash $0 estado|aplicar|deshacer"; exit 1 ;;
esac
