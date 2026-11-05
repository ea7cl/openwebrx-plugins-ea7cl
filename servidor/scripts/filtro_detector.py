#!/usr/bin/env python3
# EA7CL: filtro delante de parse2ban.
# Lee los avisos "detectado: ip=..." del registro de openwebrx y solo deja
# pasar (para que parse2ban los bloquee) los que cumplen:
#   - IP de VPN, proxy o centro de datos: se bloquea con el primer aviso (10 min)
#   - linea domestica espanola: NUNCA se bloquea
#   - linea domestica de un pais de PAISES_INMEDIATO (Belgica): con el primer aviso (10 min)
#   - linea domestica de otro pais: solo con racha de 30 min o mas
# El tipo de IP se consulta una vez en ip-api.com y se guarda 30 dias.
# Cada decision se anota en /var/log/filtro_detector.log
#
# Uso: filtro_detector.py [-s "15 minutes ago"] | parse2ban -w /etc/parse2ban.whitelist -f -
import sys, re, json, os, time, subprocess, urllib.request

RACHA_LARGA = 30 * 60            # segundos para lineas domesticas de otro pais
PAISES_INMEDIATO = ["BE"]        # paises bloqueados con el primer aviso (codigos de 2 letras)
CACHE = "/var/lib/parse2ban/tipos_ip.json"
CACHE_DIAS = 30
REGISTRO = "/var/log/filtro_detector.log"

desde = "15 minutes ago"
if len(sys.argv) == 3 and sys.argv[1] == "-s":
    desde = sys.argv[2]

def anotar(texto):
    if clave in anotadas:
        return
    anotadas.append(clave)
    try:
        with open(REGISTRO, "a") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + texto + "\n")
    except OSError:
        pass

def leer_cache():
    try:
        return json.load(open(CACHE))
    except (OSError, ValueError):
        return {}

def guardar_cache(cache):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    tmp = CACHE + ".tmp"
    json.dump(cache, open(tmp, "w"))
    os.replace(tmp, CACHE)

def tipo_ip(ip, cache):
    dato = cache.get(ip)
    if dato and time.time() - dato.get("cuando", 0) < CACHE_DIAS * 86400:
        return dato
    url = "http://ip-api.com/json/%s?fields=status,countryCode,isp,org,as,proxy,hosting" % ip
    try:
        r = json.load(urllib.request.urlopen(url, timeout=8))
    except Exception:
        return None
    if r.get("status") != "success":
        return None
    dato = {
        "pais": r.get("countryCode") or "?",
        "vpn": bool(r.get("proxy")) or bool(r.get("hosting")),
        "red": (r.get("isp") or r.get("org") or "?") + " / " + (r.get("as") or "?"),
        "cuando": time.time(),
    }
    cache[ip] = dato
    return dato

lineas = subprocess.run(
    ["journalctl", "-u", "openwebrx", "-S", desde, "-o", "cat", "--no-pager"],
    capture_output=True).stdout.decode("utf-8", "replace").splitlines()

cache = leer_cache()
anotadas = cache.get("_anotadas", [])   # avisos ya apuntados en el log
vistos = set()
for linea in lineas:
    m = re.search(r"detectado:.*?\bip=(\S+).*?racha_marcadores=(\d+)s", linea)
    if not m:
        continue
    ip, racha = m.group(1), int(m.group(2))
    clave = linea[:19] + " " + ip + " " + str(racha)
    if (ip, racha >= RACHA_LARGA) in vistos:
        continue
    vistos.add((ip, racha >= RACHA_LARGA))
    if ip.startswith(("192.168.", "10.", "127.")):
        continue
    dato = tipo_ip(ip, cache)
    if dato is None:
        anotar("%s racha=%ds: no se pudo saber el tipo de IP, no se bloquea" % (ip, racha))
        continue
    desc = "%s (%s, %s) racha=%ds" % (ip, dato["pais"], dato["red"], racha)
    if dato["vpn"]:
        anotar("BLOQUEAR %s: VPN o centro de datos" % desc)
        print(linea)
    elif dato["pais"] == "ES":
        anotar("dejar    %s: linea domestica espanola" % desc)
    elif dato["pais"] in PAISES_INMEDIATO:
        anotar("BLOQUEAR %s: linea domestica de pais vigilado" % desc)
        print(linea)
    elif racha >= RACHA_LARGA:
        anotar("BLOQUEAR %s: linea domestica extranjera con racha larga" % desc)
        print(linea)
    else:
        anotar("dejar    %s: linea domestica extranjera, racha corta" % desc)

cache["_anotadas"] = anotadas[-1000:]
guardar_cache(cache)
