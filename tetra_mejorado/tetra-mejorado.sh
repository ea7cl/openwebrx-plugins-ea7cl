#!/bin/bash
# tetra-mejorado (EA7CL) · panel TETRA completo para OpenWebRX+ (TS1-TS4, datos de red, GSSI/SSI).
#
#   sudo bash tetra-mejorado.sh aplicar     lo pone (copia de seguridad de cada archivo que toca;
#                                           si ya estaba puesto, lo actualiza)
#   sudo bash tetra-mejorado.sh deshacer    lo quita y deja OpenWebRX como estaba
#   bash tetra-mejorado.sh estado           dice si está puesto
#
# Al aplicar se instala también en /usr/local/sbin/tetra-mejorado y se deja un aviso de apt
# (/etc/apt/apt.conf.d/99owrx-tetramejorado) para volver a ponerlo tras una actualización.
#
# Qué toca (nada de la configuración de OpenWebRX):
#   · añade el paquete Python  <dist-packages>/owrx_tetraea7cl/
#   · añade un bloque entre marcas "tetra-mejorado (EA7CL)" al final de
#     owrx/tetra.py, htdocs/lib/MetaPanel.js y htdocs/css/openwebrx.css
# Copias de seguridad: /var/backups/owrx-tetramejorado/<versión de OpenWebRX>/
set -e
ACCION="${1:-estado}"
SILENCIOSO=""; FORZAR=""
for a in "${@:2}"; do
  case "$a" in --silencioso) SILENCIOSO=1;; --forzar) FORZAR=1;; esac
done
PROBADAS="1.2.130"
ORIGEN="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
[ -d "$ORIGEN/owrx_tetraea7cl" ] || ORIGEN=/usr/local/share/owrx-tetramejorado
say() { [ -n "$SILENCIOSO" ] || echo "$@"; }

D="$(cd / && python3 -I -c 'import owrx.tetra as m, os; print(os.path.dirname(os.path.dirname(m.__file__)))' 2>/dev/null || true)"
[ -n "$TM_D" ] && D="$TM_D"          # solo para pruebas sobre una copia
if [ -z "$D" ] || [ ! -f "$D/owrx/tetra.py" ] || [ ! -f "$D/htdocs/lib/MetaPanel.js" ]; then
  say "No encuentro OpenWebRX+ con modo TETRA (owrx/tetra.py)."; exit 1
fi
VER="$(dpkg-query -W -f='${Version}' openwebrx 2>/dev/null || echo desconocida)"
COPIAS="/var/backups/owrx-tetramejorado/$VER"
ARCHIVOS="owrx/tetra.py htdocs/lib/MetaPanel.js htdocs/css/openwebrx.css"

parches() {   # $1 = aplicar | deshacer | estado
python3 -I - "$1" "$D" "$ORIGEN/owrx_tetraea7cl" <<'PY'
import os, sys
accion, D, PAQ = sys.argv[1], sys.argv[2], sys.argv[3]
MARCA = "tetra-mejorado (EA7CL)"
def leer(n):
    return open(os.path.join(PAQ, n), encoding="utf-8").read().rstrip("\n") + "\n"
partes = {
    "owrx/tetra.py": ("# >>> %s >>>" % MARCA, "# <<< %s <<<" % MARCA, lambda: (
        "try:\n    import owrx_tetraea7cl.enganche as _tm\n    _tm.aplicar_tetra(globals())\n"
        "except Exception as _e:\n    import logging as _l\n"
        "    _l.getLogger('owrx_tetraea7cl').warning('tetra-mejorado desactivado: %s', _e)\n")),
    "htdocs/lib/MetaPanel.js": ("/* >>> %s >>> */" % MARCA, "/* <<< %s <<< */" % MARCA,
                                lambda: leer("panel.js")),
    "htdocs/css/openwebrx.css": ("/* >>> %s >>> */" % MARCA, "/* <<< %s <<< */" % MARCA,
                                 lambda: leer("panel.css")),
}
for rel, (INI, FIN, codigo) in partes.items():
    p = os.path.join(D, rel)
    s = open(p, encoding="utf-8").read()
    puesto = INI in s
    if accion == "estado":
        print("%s: %s" % (rel, "puesto" if puesto else "sin poner"))
        continue
    if puesto:   # quitar el bloque (para deshacer o para ponerlo de nuevo actualizado)
        a = s.index(INI); b = s.index(FIN) + len(FIN)
        s = s[:a].rstrip("\n") + "\n" + s[b:].lstrip("\n")
    if accion == "aplicar":
        s = s.rstrip("\n") + "\n\n" + INI + "\n" + codigo() + FIN + "\n"
    open(p, "w", encoding="utf-8").write(s)
PY
}

reiniciar() {
  if systemctl is-active --quiet openwebrx; then
    systemctl restart openwebrx && say "OpenWebRX reiniciado."
  fi
}

case "$ACCION" in
  aplicar)
    [ "$(id -u)" = 0 ] || { echo "Usa: sudo bash $0 aplicar"; exit 1; }
    if ! echo " $PROBADAS " | grep -q " $VER " && [ -z "$FORZAR" ]; then
      if [ -n "$SILENCIOSO" ]; then
        logger -t tetra-mejorado "OpenWebRX $VER no probado: no se aplica tetra-mejorado" 2>/dev/null || true
        exit 0
      fi
      echo "OpenWebRX+ $VER no está probado con tetra-mejorado (probado en: $PROBADAS)."
      echo "No se toca nada. (Para probar bajo tu responsabilidad: aplicar --forzar)"
      exit 1
    fi
    YA=1
    [ -d "$D/owrx_tetraea7cl" ] || YA=0
    for f in $ARCHIVOS; do grep -q "tetra-mejorado (EA7CL)" "$D/$f" || YA=0; done
    if [ -n "$SILENCIOSO" ] && [ "$YA" = 1 ]; then exit 0; fi
    if [ ! -d "$COPIAS" ]; then
      mkdir -p "$COPIAS"
      for f in $ARCHIVOS; do
        [ -f "$D/$f" ] && ! grep -q "tetra-mejorado (EA7CL)" "$D/$f" && install -D -m 644 "$D/$f" "$COPIAS/$f"
      done
      say "Copia de seguridad en $COPIAS"
    fi
    if [ "$ORIGEN" != /usr/local/share/owrx-tetramejorado ]; then
      rm -rf /usr/local/share/owrx-tetramejorado; mkdir -p /usr/local/share/owrx-tetramejorado
      cp -r "$ORIGEN/owrx_tetraea7cl" /usr/local/share/owrx-tetramejorado/
      rm -rf /usr/local/share/owrx-tetramejorado/owrx_tetraea7cl/__pycache__
      [ -f "$ORIGEN/LEEME.md" ] && cp "$ORIGEN/LEEME.md" /usr/local/share/owrx-tetramejorado/
      install -m 755 "$ORIGEN/tetra-mejorado.sh" /usr/local/sbin/tetra-mejorado
    fi
    rm -rf "$D/owrx_tetraea7cl"; cp -r "$ORIGEN/owrx_tetraea7cl" "$D/owrx_tetraea7cl"
    rm -rf "$D/owrx_tetraea7cl/__pycache__"
    find "$D/owrx_tetraea7cl" -type f -exec chmod 644 {} +
    parches aplicar
    python3 -m py_compile "$D/owrx/tetra.py" "$D"/owrx_tetraea7cl/*.py
    echo 'DPkg::Post-Invoke { "if [ -x /usr/local/sbin/tetra-mejorado ]; then /usr/local/sbin/tetra-mejorado aplicar --silencioso || true; fi"; };' \
      > /etc/apt/apt.conf.d/99owrx-tetramejorado
    if [ "$YA" = 1 ]; then say "tetra-mejorado ya estaba puesto (archivos actualizados)."; else say "tetra-mejorado puesto."; fi
    reiniciar
    ;;
  deshacer)
    [ "$(id -u)" = 0 ] || { echo "Usa: sudo bash $0 deshacer"; exit 1; }
    parches deshacer
    rm -rf "$D/owrx_tetraea7cl"
    rm -f /etc/apt/apt.conf.d/99owrx-tetramejorado
    python3 -m py_compile "$D/owrx/tetra.py"
    say "tetra-mejorado quitado. OpenWebRX queda como estaba (copias en /var/backups/owrx-tetramejorado)."
    reiniciar
    ;;
  estado)
    echo "OpenWebRX $VER en $D"
    echo " $PROBADAS " | grep -q " $VER " && echo "versión probada: sí" || echo "versión probada: NO (probado en $PROBADAS)"
    [ -d "$D/owrx_tetraea7cl" ] && echo "paquete owrx_tetraea7cl: instalado" || echo "paquete owrx_tetraea7cl: no"
    parches estado
    command -v tetrarx >/dev/null && echo "tetrarx: instalado" || echo "tetrarx: NO instalado (sin él no hay modo TETRA)"
    [ -f /etc/apt/apt.conf.d/99owrx-tetramejorado ] && echo "reaplicado tras actualizaciones: sí" || echo "reaplicado tras actualizaciones: no"
    ;;
  *) echo "Uso: sudo bash $0 aplicar | deshacer | estado"; exit 1;;
esac
