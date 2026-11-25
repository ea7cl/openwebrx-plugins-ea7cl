#!/bin/bash
# owrx-estereo (EA7CL) · FM comercial, DAB y DRM en ESTÉREO REAL para OpenWebRX+.
#
#   sudo bash owrx-estereo.sh aplicar     pone el estéreo (copia de seguridad de cada archivo
#                                         que toca; si ya estaba puesto, no hace nada)
#   sudo bash owrx-estereo.sh deshacer    lo quita y deja OpenWebRX como estaba
#   bash owrx-estereo.sh estado           dice si está puesto
#
# Al aplicar se instala también en /usr/local/sbin/owrx-estereo y se deja un aviso de apt
# (/etc/apt/apt.conf.d/99owrx-estereo) para que, tras CADA actualización de paquetes, se vuelva
# a aplicar solo si una actualización de OpenWebRX lo hubiera borrado.
#
# Qué toca (nada de la configuración de OpenWebRX):
#   · añade el paquete Python  <dist-packages>/owrx_estereo/
#   · añade el complemento     <dist-packages>/htdocs/plugins/receiver/estereo_fm/
#   · añade unas líneas de enganche (entre marcas "owrx-estereo") al final de
#     csdr/chain/analog.py, csdr/chain/dablin.py y csdr/chain/drm.py, y dentro de owrx/dsp.py
#   · añade  Plugins.load('estereo_fm')  al final de htdocs/plugins/receiver/init.js
# Copias de seguridad: /var/backups/owrx-estereo/<versión de OpenWebRX>/
set -e
ACCION="${1:-estado}"
SILENCIOSO=""; FORZAR=""
for a in "${@:2}"; do
  case "$a" in --silencioso) SILENCIOSO=1;; --forzar) FORZAR=1;; esac
done
# Versiones de OpenWebRX+ en las que se ha probado. En otras NO se aplica. --forzar lo aplica
# igualmente (solo para pruebas).
PROBADAS="1.2.128 1.2.130"
ORIGEN="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
# si se ejecuta la copia instalada, los archivos están en /usr/local/share/owrx-estereo
[ -d "$ORIGEN/owrx_estereo" ] || ORIGEN=/usr/local/share/owrx-estereo
say() { [ -n "$SILENCIOSO" ] || echo "$@"; }

D="$(cd / && python3 -I -c 'import csdr.chain.analog as m, os; print(os.path.dirname(os.path.dirname(os.path.dirname(m.__file__))))' 2>/dev/null || true)"
if [ -z "$D" ] || [ ! -f "$D/csdr/chain/analog.py" ]; then
  say "No encuentro OpenWebRX+ (paquete owrx/csdr de Python)."; exit 1
fi
VER="$(dpkg-query -W -f='${Version}' openwebrx 2>/dev/null || echo desconocida)"
COPIAS="/var/backups/owrx-estereo/$VER"
INIT="$D/htdocs/plugins/receiver/init.js"
# 1.2.130 o posterior ya trae estéreo propio (HdStereo y el modo BCFM para la FM): entonces solo se
# enganchan el DAB (dablin.py) y el DRM (drm.py); la FM es la BCFM de OpenWebRX. En la 1.2.128: FM, DAB y dsp.py.
MODO=antiguo
grep -q "class HdStereo" "$D/csdr/chain/demodulator.py" 2>/dev/null && MODO=nativo

parches() {   # $1 = aplicar | deshacer | estado ; lo hace Python (marcas, sin duplicar)
python3 -I - "$1" "$D" "$MODO" <<'PY'
import os, sys
accion, D, modo = sys.argv[1], sys.argv[2], sys.argv[3]
INI, FIN = "# >>> owrx-estereo (EA7CL) >>>", "# <<< owrx-estereo (EA7CL) <<<"
JS = "Plugins.load('estereo_fm');   // EA7CL: FM y DAB en estéreo (owrx-estereo)"
archivos = {
    "csdr/chain/analog.py": ("fin", "try:\n    import owrx_estereo.enganche as _oe\n    _oe.aplicar_analog(globals())\nexcept Exception as _e:\n    import logging as _l\n    _l.getLogger('owrx_estereo').warning('FM estéreo desactivado: %s', _e)\n"),
    "csdr/chain/dablin.py": ("fin", "try:\n    import owrx_estereo.enganche as _oe\n    _oe.aplicar_dablin(globals())\nexcept Exception as _e:\n    import logging as _l\n    _l.getLogger('owrx_estereo').warning('DAB estéreo desactivado: %s', _e)\n"),
    "csdr/chain/drm.py": ("fin", "try:\n    import owrx_estereo.enganche as _oe\n    _oe.aplicar_drm(globals())\nexcept Exception as _e:\n    import logging as _l\n    _l.getLogger('owrx_estereo').warning('DRM estéreo desactivado: %s', _e)\n"),
    "owrx/dsp.py": ("antes:            # recreate secondary demodulator, if present\n",
                    "            try:\n                import owrx_estereo.enganche as _oe\n                _oe.avisar(self, demodulator)\n            except Exception:\n                logger.exception('owrx-estereo')\n"),
}
if modo == "nativo":            # solo DAB y DRM; la FM estéreo es la BCFM de OpenWebRX
    archivos = {k: v for k, v in archivos.items() if k in ("csdr/chain/dablin.py", "csdr/chain/drm.py")}
else:                           # el DRM estéreo solo existe en el modo nativo
    archivos.pop("csdr/chain/drm.py")
def bloque(texto, sangria=""):
    return sangria + INI + "\n" + texto + sangria + FIN + "\n"
estado = []
for rel, (donde, codigo) in archivos.items():
    p = os.path.join(D, rel)
    s = open(p, encoding="utf-8").read()
    puesto = INI in s
    if accion == "estado":
        estado.append("%s: %s" % (rel, "puesto" if puesto else "sin poner"))
        continue
    if accion == "aplicar" and not puesto:
        if donde == "fin":
            s = s.rstrip("\n") + "\n\n\n" + bloque(codigo)
        else:
            ancla = donde.split(":", 1)[1]
            if s.count(ancla) != 1:
                print("AVISO: %s ha cambiado (no encuentro dónde enganchar); no se toca." % rel)
                continue
            s = s.replace(ancla, bloque(codigo, "            ") + ancla, 1)
        open(p, "w", encoding="utf-8").write(s)
    elif accion == "deshacer" and puesto:
        a = s.index(INI); a = s.rfind("\n", 0, a) + 1
        b = s.index(FIN) + len(FIN) + 1
        s = s[:a] + s[b:]
        s = s.rstrip("\n") + "\n"
        open(p, "w", encoding="utf-8").write(s)
p = os.path.join(D, "htdocs/plugins/receiver/init.js")
if os.path.exists(p):
    s = open(p, encoding="utf-8").read()
    if accion == "estado":
        estado.append("init.js: %s" % ("carga estereo_fm" if JS in s else "sin estereo_fm"))
    elif accion == "aplicar" and JS not in s:
        open(p, "w", encoding="utf-8").write(s.rstrip("\n") + "\n" + JS + "\n")
    elif accion == "deshacer" and JS in s:
        open(p, "w", encoding="utf-8").write(s.replace(JS + "\n", "").replace(JS, ""))
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
        logger -t owrx-estereo "OpenWebRX $VER no probado: no se aplica el estéreo" 2>/dev/null || true
        exit 0
      fi
      echo "OpenWebRX+ $VER no está probado con owrx-estereo (probado en: $PROBADAS)."
      echo "No se toca nada. (Para probar bajo tu responsabilidad: aplicar --forzar)"
      exit 1
    fi
    YA=0
    [ -d "$D/owrx_estereo" ] && grep -q "owrx-estereo (EA7CL)" "$D/csdr/chain/dablin.py" \
      && grep -q "estereo_fm" "$INIT" 2>/dev/null && YA=1
    if [ "$MODO" = nativo ] && [ -f "$D/csdr/chain/drm.py" ]; then
      grep -q "owrx-estereo (EA7CL)" "$D/csdr/chain/drm.py" || YA=0
    fi
    if [ "$MODO" = antiguo ]; then
      grep -q "owrx-estereo (EA7CL)" "$D/csdr/chain/analog.py" && grep -q "owrx-estereo (EA7CL)" "$D/owrx/dsp.py" || YA=0
    fi
    # copia de seguridad de los originales (una vez por versión de OpenWebRX, antes de tocarlos)
    # (archivo a archivo: si una versión nueva del script toca un archivo más, también se copia)
    for f in csdr/chain/analog.py csdr/chain/dablin.py csdr/chain/drm.py owrx/dsp.py htdocs/plugins/receiver/init.js; do
      if [ -f "$D/$f" ] && [ ! -f "$COPIAS/$f" ] && ! grep -q "owrx-estereo" "$D/$f"; then
        install -D -m 644 "$D/$f" "$COPIAS/$f" && say "Copia de seguridad: $COPIAS/$f"
      fi
    done
    rm -rf "$D/owrx_estereo"; cp -r "$ORIGEN/owrx_estereo" "$D/owrx_estereo"
    rm -rf "$D/htdocs/plugins/receiver/estereo_fm"; cp -r "$ORIGEN/plugin/estereo_fm" "$D/htdocs/plugins/receiver/estereo_fm"
    find "$D/owrx_estereo" "$D/htdocs/plugins/receiver/estereo_fm" -type f -exec chmod 644 {} +
    parches aplicar
    python3 -m py_compile "$D/csdr/chain/analog.py" "$D/csdr/chain/dablin.py" "$D/csdr/chain/drm.py" "$D/owrx/dsp.py" "$D"/owrx_estereo/*.py
    # instalar el propio script y el reaplicado automático tras actualizaciones
    if [ "$ORIGEN" != /usr/local/share/owrx-estereo ]; then
      rm -rf /usr/local/share/owrx-estereo; mkdir -p /usr/local/share/owrx-estereo
      cp -r "$ORIGEN/owrx_estereo" "$ORIGEN/plugin" /usr/local/share/owrx-estereo/
      [ -f "$ORIGEN/LEEME.md" ] && cp "$ORIGEN/LEEME.md" /usr/local/share/owrx-estereo/
      install -m 755 "$ORIGEN/owrx-estereo.sh" /usr/local/sbin/owrx-estereo
    fi
    echo 'DPkg::Post-Invoke { "if [ -x /usr/local/sbin/owrx-estereo ]; then /usr/local/sbin/owrx-estereo aplicar --silencioso || true; fi"; };' \
      > /etc/apt/apt.conf.d/99owrx-estereo
    if [ "$YA" = 1 ]; then say "El estéreo ya estaba puesto (archivos actualizados)."; else say "Estéreo puesto."; fi
    # tras una actualización de apt solo se reinicia si de verdad hacía falta volver a ponerlo
    if [ -z "$SILENCIOSO" ] || [ "$YA" = 0 ]; then reiniciar; fi
    ;;
  deshacer)
    [ "$(id -u)" = 0 ] || { echo "Usa: sudo bash $0 deshacer"; exit 1; }
    parches deshacer
    rm -rf "$D/owrx_estereo" "$D/htdocs/plugins/receiver/estereo_fm"
    rm -f /etc/apt/apt.conf.d/99owrx-estereo
    python3 -m py_compile "$D/csdr/chain/analog.py" "$D/csdr/chain/dablin.py" "$D/csdr/chain/drm.py" "$D/owrx/dsp.py"
    say "Estéreo quitado. OpenWebRX queda como estaba (copias en /var/backups/owrx-estereo)."
    say "El script sigue en /usr/local/sbin/owrx-estereo por si quieres volver a ponerlo."
    reiniciar
    ;;
  estado)
    echo "OpenWebRX $VER en $D"
    [ "$MODO" = nativo ] && echo "modo: nativo (FM estéreo = modo BCFM de OpenWebRX; se enganchan DAB y DRM)" \
      || echo "modo: antiguo (FM, DAB y dsp.py)"
    echo " $PROBADAS " | grep -q " $VER " && echo "versión probada: sí" || echo "versión probada: NO (probado en $PROBADAS; no se aplicaría)"
    [ -d "$D/owrx_estereo" ] && echo "paquete owrx_estereo: instalado" || echo "paquete owrx_estereo: no"
    parches estado
    [ -f /etc/apt/apt.conf.d/99owrx-estereo ] && echo "reaplicado tras actualizaciones: sí" || echo "reaplicado tras actualizaciones: no"
    ;;
  *) echo "Uso: sudo bash $0 aplicar | deshacer | estado"; exit 1;;
esac
