#!/bin/bash
# am-calidad (EA7CL) · AM de mejor calidad para OpenWebRX+ (AGC por portadora, filtro, limitador; la SAM no se toca).
#
#   sudo bash am-calidad.sh aplicar     la pone (copia de seguridad de cada archivo que toca;
#                                       si ya estaba puesta, solo actualiza)
#   sudo bash am-calidad.sh deshacer    la quita y deja OpenWebRX como estaba
#   bash am-calidad.sh estado           dice si está puesta
#
# Al aplicar se instala también en /usr/local/sbin/am-calidad y se deja un aviso de apt
# (/etc/apt/apt.conf.d/99owrx-amcalidad) para que, tras CADA actualización de paquetes, se vuelva
# a aplicar solo si una actualización de OpenWebRX la hubiera borrado.
#
# Qué toca (nada de la configuración de OpenWebRX):
#   · añade el paquete Python  <dist-packages>/owrx_amcalidad/
#   · añade unas líneas de enganche (entre marcas "am-calidad") al final de
#     csdr/chain/analog.py y owrx/dsp.py
#   · no toca la SAM, ni la NFM (fm-calidad), ni ningún otro modo
# Copias de seguridad: /var/backups/owrx-amcalidad/<versión de OpenWebRX>/
set -e
ACCION="${1:-estado}"
SILENCIOSO=""; FORZAR=""
for a in "${@:2}"; do
  case "$a" in --silencioso) SILENCIOSO=1;; --forzar) FORZAR=1;; esac
done
# Versiones de OpenWebRX+ en las que se ha probado. En otras NO se aplica (--forzar: solo pruebas).
PROBADAS="1.2.130"
ORIGEN="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
[ -d "$ORIGEN/owrx_amcalidad" ] || ORIGEN=/usr/local/share/owrx-amcalidad
say() { [ -n "$SILENCIOSO" ] || echo "$@"; }

D="$(cd / && python3 -I -c 'import csdr.chain.analog as m, os; print(os.path.dirname(os.path.dirname(os.path.dirname(m.__file__))))' 2>/dev/null || true)"
[ -n "$FC_D" ] && D="$FC_D"          # solo para pruebas sobre una copia
if [ -z "$D" ] || [ ! -f "$D/csdr/chain/analog.py" ]; then
  say "No encuentro OpenWebRX+ (paquete owrx/csdr de Python)."; exit 1
fi
VER="$(dpkg-query -W -f='${Version}' openwebrx 2>/dev/null || echo desconocida)"
COPIAS="/var/backups/owrx-amcalidad/$VER"
ARCHIVOS="csdr/chain/analog.py owrx/dsp.py"

parches() {   # $1 = aplicar | deshacer | estado ; lo hace Python (marcas, sin duplicar)
python3 -I - "$1" "$D" <<'PY'
import os, sys
accion, D = sys.argv[1], sys.argv[2]
INI, FIN = "# >>> am-calidad (EA7CL) >>>", "# <<< am-calidad (EA7CL) <<<"
def gancho(func, que):
    return ("try:\n    import owrx_amcalidad.enganche as _ac\n    _ac.%s(globals())\n"
            "except Exception as _e:\n    import logging as _l\n"
            "    _l.getLogger('owrx_amcalidad').warning('%s: %%s', _e)\n") % (func, que)
py = {
    "csdr/chain/analog.py": gancho("aplicar_analog", "AM de alta calidad desactivada"),
    "owrx/dsp.py": gancho("aplicar_dsp", "AM de alta calidad desactivada"),
}
estado, fallos = [], 0
for rel, codigo in py.items():
    p = os.path.join(D, rel)
    s = open(p, encoding="utf-8").read()
    puesto = INI in s
    if accion == "estado":
        estado.append("%s: %s" % (rel, "puesto" if puesto else "sin poner"))
    elif accion == "aplicar" and not puesto:
        open(p, "w", encoding="utf-8").write(s.rstrip("\n") + "\n\n\n" + INI + "\n" + codigo + FIN + "\n")
    elif accion == "deshacer" and puesto:
        a = s.index(INI); b = s.index(FIN) + len(FIN) + 1
        open(p, "w", encoding="utf-8").write(s[:a].rstrip("\n") + "\n" + s[b:])
if estado:
    print("\n".join(estado))
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
        logger -t am-calidad "OpenWebRX $VER no probado: no se aplica am-calidad" 2>/dev/null || true
        exit 0
      fi
      echo "OpenWebRX+ $VER no está probado con am-calidad (probado en: $PROBADAS)."
      echo "No se toca nada. (Para probar bajo tu responsabilidad: aplicar --forzar)"
      exit 1
    fi
    YA=1
    [ -d "$D/owrx_amcalidad" ] || YA=0
    for f in csdr/chain/analog.py owrx/dsp.py; do grep -q "am-calidad (EA7CL)" "$D/$f" || YA=0; done
    # copia de seguridad de los originales (una vez por versión de OpenWebRX, antes de tocarlos)
    if [ ! -d "$COPIAS" ]; then
      mkdir -p "$COPIAS"
      for f in $ARCHIVOS; do
        [ -f "$D/$f" ] && ! grep -q "am-calidad (EA7CL)" "$D/$f" && install -D -m 644 "$D/$f" "$COPIAS/$f"
      done
      say "Copia de seguridad en $COPIAS"
    fi
    rm -rf "$D/owrx_amcalidad"; cp -r "$ORIGEN/owrx_amcalidad" "$D/owrx_amcalidad"
    rm -rf "$D/owrx_amcalidad/__pycache__"
    find "$D/owrx_amcalidad" -type f -exec chmod 644 {} +
    parches aplicar
    python3 -m py_compile "$D/csdr/chain/analog.py" "$D/owrx/dsp.py" "$D"/owrx_amcalidad/*.py
    if [ "$ORIGEN" != /usr/local/share/owrx-amcalidad ]; then
      rm -rf /usr/local/share/owrx-amcalidad; mkdir -p /usr/local/share/owrx-amcalidad
      cp -r "$ORIGEN/owrx_amcalidad" /usr/local/share/owrx-amcalidad/
      rm -rf /usr/local/share/owrx-amcalidad/owrx_amcalidad/__pycache__
      [ -f "$ORIGEN/LEEME.md" ] && cp "$ORIGEN/LEEME.md" /usr/local/share/owrx-amcalidad/
      install -m 755 "$ORIGEN/am-calidad.sh" /usr/local/sbin/am-calidad
    fi
    echo 'DPkg::Post-Invoke { "if [ -x /usr/local/sbin/am-calidad ]; then /usr/local/sbin/am-calidad aplicar --silencioso || true; fi"; };' \
      > /etc/apt/apt.conf.d/99owrx-amcalidad
    if [ "$YA" = 1 ]; then say "am-calidad ya estaba puesta (archivos actualizados)."; else say "am-calidad puesta."; fi
    if [ -z "$SILENCIOSO" ] || [ "$YA" = 0 ]; then reiniciar; fi
    ;;
  deshacer)
    [ "$(id -u)" = 0 ] || { echo "Usa: sudo bash $0 deshacer"; exit 1; }
    parches deshacer
    rm -rf "$D/owrx_amcalidad"
    rm -f /etc/apt/apt.conf.d/99owrx-amcalidad
    python3 -m py_compile "$D/csdr/chain/analog.py" "$D/owrx/dsp.py"
    say "am-calidad quitada. OpenWebRX queda como estaba (copias en /var/backups/owrx-amcalidad)."
    say "El script sigue en /usr/local/sbin/am-calidad por si quieres volver a ponerla."
    reiniciar
    ;;
  estado)
    echo "OpenWebRX $VER en $D"
    echo " $PROBADAS " | grep -q " $VER " && echo "versión probada: sí" || echo "versión probada: NO (probado en $PROBADAS; no se aplicaría)"
    [ -d "$D/owrx_amcalidad" ] && echo "paquete owrx_amcalidad: instalado" || echo "paquete owrx_amcalidad: no"
    parches estado
    [ -f /etc/apt/apt.conf.d/99owrx-amcalidad ] && echo "reaplicado tras actualizaciones: sí" || echo "reaplicado tras actualizaciones: no"
    ;;
  *) echo "Uso: sudo bash $0 aplicar | deshacer | estado"; exit 1;;
esac
