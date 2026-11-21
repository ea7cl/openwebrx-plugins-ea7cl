#!/bin/bash
# fm-calidad (EA7CL) · FM estrecha (NFM, V-UHF) de mejor calidad para OpenWebRX+.
#
#   sudo bash fm-calidad.sh aplicar     la pone (copia de seguridad de cada archivo que toca;
#                                       si ya estaba puesta, solo actualiza)
#   sudo bash fm-calidad.sh deshacer    la quita y deja OpenWebRX como estaba
#   bash fm-calidad.sh estado           dice si está puesta
#
# Al aplicar se instala también en /usr/local/sbin/fm-calidad y se deja un aviso de apt
# (/etc/apt/apt.conf.d/99owrx-fmcalidad) para que, tras CADA actualización de paquetes, se vuelva
# a aplicar solo si una actualización de OpenWebRX la hubiera borrado.
#
# Qué toca (nada de la configuración de OpenWebRX):
#   · añade el paquete Python  <dist-packages>/owrx_fmcalidad/
#   · añade unas líneas de enganche (entre marcas "fm-calidad") al final de
#     csdr/chain/analog.py, owrx/dsp.py y owrx/modes.py
#   · en htdocs/lib/Demodulator.js deja abrir el filtro FM hasta ±12,5 kHz (antes ±6 kHz)
# Copias de seguridad: /var/backups/owrx-fmcalidad/<versión de OpenWebRX>/
set -e
ACCION="${1:-estado}"
SILENCIOSO=""; FORZAR=""
for a in "${@:2}"; do
  case "$a" in --silencioso) SILENCIOSO=1;; --forzar) FORZAR=1;; esac
done
# Versiones de OpenWebRX+ en las que se ha probado. En otras NO se aplica (--forzar: solo pruebas).
PROBADAS="1.2.130"
ORIGEN="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
[ -d "$ORIGEN/owrx_fmcalidad" ] || ORIGEN=/usr/local/share/owrx-fmcalidad
say() { [ -n "$SILENCIOSO" ] || echo "$@"; }

D="$(cd / && python3 -I -c 'import csdr.chain.analog as m, os; print(os.path.dirname(os.path.dirname(os.path.dirname(m.__file__))))' 2>/dev/null || true)"
[ -n "$FC_D" ] && D="$FC_D"          # solo para pruebas sobre una copia
if [ -z "$D" ] || [ ! -f "$D/csdr/chain/analog.py" ]; then
  say "No encuentro OpenWebRX+ (paquete owrx/csdr de Python)."; exit 1
fi
VER="$(dpkg-query -W -f='${Version}' openwebrx 2>/dev/null || echo desconocida)"
COPIAS="/var/backups/owrx-fmcalidad/$VER"
ARCHIVOS="csdr/chain/analog.py owrx/dsp.py owrx/modes.py htdocs/lib/Demodulator.js"

parches() {   # $1 = aplicar | deshacer | estado ; lo hace Python (marcas, sin duplicar)
python3 -I - "$1" "$D" <<'PY'
import os, sys
accion, D = sys.argv[1], sys.argv[2]
INI, FIN = "# >>> fm-calidad (EA7CL) >>>", "# <<< fm-calidad (EA7CL) <<<"
JINI, JFIN = "// >>> fm-calidad (EA7CL) >>>", "// <<< fm-calidad (EA7CL) <<<"
def gancho(func, que):
    return ("try:\n    import owrx_fmcalidad.enganche as _fc\n    _fc.%s(globals())\n"
            "except Exception as _e:\n    import logging as _l\n"
            "    _l.getLogger('owrx_fmcalidad').warning('%s: %%s', _e)\n") % (func, que)
py = {
    "csdr/chain/analog.py": gancho("aplicar_analog", "NFM de alta calidad desactivada"),
    "owrx/dsp.py": gancho("aplicar_dsp", "NFM de alta calidad desactivada"),
    "owrx/modes.py": gancho("aplicar_modes", "filtro FM por defecto sin cambiar"),
}
JS_ANCLA = "        default:\n            max_bw = parseInt(audioEngine.getOutputRate() / 2);\n"
JS = ("        " + JINI + "\n"
      "        case 'nfm':\n"
      "            // sin decodificador, la FM se demodula a 48 kHz: el filtro puede llegar a ±12,5 kHz\n"
      "            max_bw = mod2 ? parseInt(audioEngine.getOutputRate() / 2) : 12500;\n"
      "            break;\n"
      "        " + JFIN + "\n")
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
p = os.path.join(D, "htdocs/lib/Demodulator.js")
s = open(p, encoding="utf-8").read()
puesto = JINI in s
if accion == "estado":
    estado.append("htdocs/lib/Demodulator.js: %s" % ("puesto" if puesto else "sin poner"))
elif accion == "aplicar" and not puesto:
    if s.count(JS_ANCLA) == 1:
        open(p, "w", encoding="utf-8").write(s.replace(JS_ANCLA, JS + JS_ANCLA, 1))
    else:
        print("AVISO: Demodulator.js ha cambiado; el filtro FM se queda en ±6 kHz como máximo.")
elif accion == "deshacer" and puesto:
    a = s.index("        " + JINI); b = s.index(JFIN) + len(JFIN) + 1
    open(p, "w", encoding="utf-8").write(s[:a] + s[b:])
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
        logger -t fm-calidad "OpenWebRX $VER no probado: no se aplica fm-calidad" 2>/dev/null || true
        exit 0
      fi
      echo "OpenWebRX+ $VER no está probado con fm-calidad (probado en: $PROBADAS)."
      echo "No se toca nada. (Para probar bajo tu responsabilidad: aplicar --forzar)"
      exit 1
    fi
    YA=1
    [ -d "$D/owrx_fmcalidad" ] || YA=0
    for f in csdr/chain/analog.py owrx/dsp.py owrx/modes.py; do grep -q "fm-calidad (EA7CL)" "$D/$f" || YA=0; done
    # copia de seguridad de los originales (una vez por versión de OpenWebRX, antes de tocarlos)
    if [ ! -d "$COPIAS" ]; then
      mkdir -p "$COPIAS"
      for f in $ARCHIVOS; do
        [ -f "$D/$f" ] && ! grep -q "fm-calidad (EA7CL)" "$D/$f" && install -D -m 644 "$D/$f" "$COPIAS/$f"
      done
      say "Copia de seguridad en $COPIAS"
    fi
    rm -rf "$D/owrx_fmcalidad"; cp -r "$ORIGEN/owrx_fmcalidad" "$D/owrx_fmcalidad"
    rm -rf "$D/owrx_fmcalidad/__pycache__"
    find "$D/owrx_fmcalidad" -type f -exec chmod 644 {} +
    parches aplicar
    python3 -m py_compile "$D/csdr/chain/analog.py" "$D/owrx/dsp.py" "$D/owrx/modes.py" "$D"/owrx_fmcalidad/*.py
    if [ "$ORIGEN" != /usr/local/share/owrx-fmcalidad ]; then
      rm -rf /usr/local/share/owrx-fmcalidad; mkdir -p /usr/local/share/owrx-fmcalidad
      cp -r "$ORIGEN/owrx_fmcalidad" /usr/local/share/owrx-fmcalidad/
      rm -rf /usr/local/share/owrx-fmcalidad/owrx_fmcalidad/__pycache__
      [ -f "$ORIGEN/LEEME.md" ] && cp "$ORIGEN/LEEME.md" /usr/local/share/owrx-fmcalidad/
      install -m 755 "$ORIGEN/fm-calidad.sh" /usr/local/sbin/fm-calidad
    fi
    echo 'DPkg::Post-Invoke { "if [ -x /usr/local/sbin/fm-calidad ]; then /usr/local/sbin/fm-calidad aplicar --silencioso || true; fi"; };' \
      > /etc/apt/apt.conf.d/99owrx-fmcalidad
    if [ "$YA" = 1 ]; then say "fm-calidad ya estaba puesta (archivos actualizados)."; else say "fm-calidad puesta."; fi
    if [ -z "$SILENCIOSO" ] || [ "$YA" = 0 ]; then reiniciar; fi
    ;;
  deshacer)
    [ "$(id -u)" = 0 ] || { echo "Usa: sudo bash $0 deshacer"; exit 1; }
    parches deshacer
    rm -rf "$D/owrx_fmcalidad"
    rm -f /etc/apt/apt.conf.d/99owrx-fmcalidad
    python3 -m py_compile "$D/csdr/chain/analog.py" "$D/owrx/dsp.py" "$D/owrx/modes.py"
    say "fm-calidad quitada. OpenWebRX queda como estaba (copias en /var/backups/owrx-fmcalidad)."
    say "El script sigue en /usr/local/sbin/fm-calidad por si quieres volver a ponerla."
    reiniciar
    ;;
  estado)
    echo "OpenWebRX $VER en $D"
    echo " $PROBADAS " | grep -q " $VER " && echo "versión probada: sí" || echo "versión probada: NO (probado en $PROBADAS; no se aplicaría)"
    [ -d "$D/owrx_fmcalidad" ] && echo "paquete owrx_fmcalidad: instalado" || echo "paquete owrx_fmcalidad: no"
    parches estado
    [ -f /etc/apt/apt.conf.d/99owrx-fmcalidad ] && echo "reaplicado tras actualizaciones: sí" || echo "reaplicado tras actualizaciones: no"
    ;;
  *) echo "Uso: sudo bash $0 aplicar | deshacer | estado"; exit 1;;
esac
