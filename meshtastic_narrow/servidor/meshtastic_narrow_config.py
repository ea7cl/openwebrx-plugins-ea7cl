#!/usr/bin/python3 -I
# meshtastic_narrow (EA7CL): ajustes para decodificar Meshtastic Narrow en segundo plano,
# como AIS o VDL2, aunque no haya nadie escuchando.
#
#   poner   - plan de bandas: frecuencia de servicio "meshtastic-narrow" en la banda EU868
#           - ajustes: "meshtastic-narrow" en los decodificadores de segundo plano
#           - el receptor elegido: servicios activados y programado para volver solo
#             al perfil que cubre la frecuencia cuando no lo usa ningún oyente
#           Guarda cómo estaba el receptor en /var/lib/openwebrx/meshtastic_narrow-antes.json
#   quitar  - deshace todo lo anterior (el receptor vuelve a como estaba)
#   ver     - enseña cómo está
#
# Hay que usarlo con OpenWebRX parado (si no, OpenWebRX puede volver a escribir sus ajustes).
# Uso: python3 -I meshtastic_narrow_config.py poner|quitar|ver  [FREQ=869618000 RECEPTOR=00001001]
import json, os, re, sys, glob

MODO = "meshtastic-narrow"
FREQ = int(os.environ.get("FREQ", "869618000"))
RECEPTOR = os.environ.get("RECEPTOR", "00001001")      # número de serie de la RTL-SDR
AJUSTES = os.environ.get("AJUSTES", "/var/lib/openwebrx/settings.json")
BANDAS = os.environ.get("BANDAS", "/etc/openwebrx")
ANTES = os.environ.get("ANTES", "/var/lib/openwebrx/meshtastic_narrow-antes.json")
LINEA = re.compile(r'^\s*"' + MODO + r'"\s*:\s*\d+,?\s*\n', re.M)


def escribir(f, texto):
    st = os.stat(f)
    with open(f + ".tmp-mn", "w", encoding="utf-8") as o:
        o.write(texto)
    if os.geteuid() == 0:
        os.chown(f + ".tmp-mn", st.st_uid, st.st_gid)
    os.chmod(f + ".tmp-mn", st.st_mode)
    os.replace(f + ".tmp-mn", f)


# --- plan de bandas: se toca como texto para no cambiar el formato del archivo ---
def bandas(poner):
    for f in sorted(glob.glob(os.path.join(BANDAS, "bands*.json"))):
        t = open(f, encoding="utf-8").read()
        nuevo = LINEA.sub("", t)
        if poner:
            m = re.search(r'"name"\s*:\s*"EU868".*?"frequencies"\s*:\s*\{[ \t]*\n', nuevo, re.S)
            if not m:
                continue
            sig = nuevo[m.end():].split("\n", 1)[0]
            sangria = sig[:len(sig) - len(sig.lstrip())] or "      "
            nuevo = nuevo[:m.end()] + f'{sangria}"{MODO}": {FREQ},\n' + nuevo[m.end():]
        if nuevo != t:
            json.loads(nuevo)  # que siga siendo JSON válido
            escribir(f, nuevo)
            print(f"{'añadida' if poner else 'quitada'} la frecuencia de servicio en {f}")


def buscar_receptor(aj):
    for sid, s in aj.get("sdrs", {}).items():
        if s.get("device", "").replace("serial=", "") == RECEPTOR:
            return sid, s
    return None, None


def perfil_que_cubre(s):
    # el perfil del receptor que deja la frecuencia con al menos 0,5 MHz de margen
    mejor = None
    for pid, p in (s.get("profiles") or {}).items():
        c, sr = p.get("center_freq", 0), p.get("samp_rate", 0)
        hueco = sr / 2 - abs(FREQ - c)
        if hueco >= 500000 and (mejor is None or hueco > mejor[0]):
            mejor = (hueco, pid, p.get("name"))
    return mejor


def ajustes(poner):
    aj = json.load(open(AJUSTES, encoding="utf-8"))
    dec = aj.setdefault("services_decoders", [])
    sid, s = buscar_receptor(aj)
    if poner:
        if s is None:
            sys.exit(f"ERROR: no hay ningún receptor con número de serie {RECEPTOR}")
        mejor = perfil_que_cubre(s)
        if mejor is None:
            sys.exit(f"ERROR: el receptor {RECEPTOR} no tiene ningún perfil que cubra {FREQ/1e6:.3f} MHz con margen")
        if not os.path.exists(ANTES):
            guardado = {"sdr": sid, "services": s.get("services", "falta"), "scheduler": s.get("scheduler", "falta")}
            with open(ANTES, "w") as o:
                json.dump(guardado, o, indent=4)
            print(f"Guardado cómo estaba el receptor en {ANTES}")
        if MODO not in dec:
            dec.append(MODO)
        s["services"] = True
        s["scheduler"] = {"type": "static", "schedule": {"0000-0000": mejor[1]}}
        print(f"Receptor {s.get('name')} ({RECEPTOR}): segundo plano activado, vuelve solo al perfil '{mejor[2]}'")
    else:
        if MODO in dec:
            dec.remove(MODO)
        if os.path.exists(ANTES):
            g = json.load(open(ANTES))
            s = aj.get("sdrs", {}).get(g["sdr"])
            if s is not None:
                for k in ("services", "scheduler"):
                    if g[k] == "falta":
                        s.pop(k, None)
                    else:
                        s[k] = g[k]
                print(f"Receptor {s.get('name')} devuelto a como estaba")
            os.remove(ANTES)
    escribir(AJUSTES, json.dumps(aj, indent=4))
    print(f"Decodificadores de segundo plano: {', '.join(dec)}")


def ver():
    for f in sorted(glob.glob(os.path.join(BANDAS, "bands*.json"))):
        print(("con frecuencia de servicio: " if LINEA.search(open(f, encoding="utf-8").read()) else "sin frecuencia de servicio: ") + f)
    aj = json.load(open(AJUSTES, encoding="utf-8"))
    print("decodificadores de segundo plano:", ", ".join(aj.get("services_decoders", [])))
    sid, s = buscar_receptor(aj)
    if s:
        print(f"receptor {s.get('name')} ({RECEPTOR}): services={s.get('services')} scheduler={s.get('scheduler')}")


if __name__ == "__main__":
    accion = sys.argv[1] if len(sys.argv) > 1 else ""
    if accion == "poner":
        bandas(True); ajustes(True)
    elif accion == "quitar":
        bandas(False); ajustes(False)
    elif accion == "ver":
        ver()
    else:
        sys.exit("uso: meshtastic_narrow_config.py poner|quitar|ver")
