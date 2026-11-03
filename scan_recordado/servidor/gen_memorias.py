#!/usr/bin/env python3
"""Genera memorias.json para el buscador de la ventana MEM (scan_recordado, EA7CL).

Junta los marcadores del servidor igual que OpenWebRX+ (owrx/bookmarks.py):
primero los de /etc/openwebrx/bookmarks.d, luego los de la region y del
pais configurados y por ultimo bookmarks.json, el que se edita en Ajustes;
uno posterior sustituye a otro en la misma frecuencia. Escribe solo nombre,
frecuencia, modo, descripcion y scan, que ya se ven en el waterfall.

Lo vuelve a ejecutar scan-recordado-memorias.path cada vez que cambian los
marcadores. Uso: gen_memorias.py [archivo de salida]
"""
import json
import os
import sys

SETTINGS = "/var/lib/openwebrx/settings.json"
MAIN_FILE = "/var/lib/openwebrx/bookmarks.json"
MAIN_DIR = "/etc/openwebrx/bookmarks.d"
OUT = "/usr/lib/python3/dist-packages/htdocs/plugins/receiver/scan_recordado/memorias.json"

CAMPOS = ("name", "frequency", "modulation", "underlying", "description", "scannable")


def json_files(path):
    try:
        return sorted(os.path.join(path, f) for f in os.listdir(path) if f.endswith(".json"))
    except OSError:
        return []


def bookmark_files():
    try:
        with open(SETTINGS, encoding="utf-8") as fh:
            settings = json.load(fh)
    except (OSError, ValueError):
        settings = {}
    files = json_files(MAIN_DIR)
    region = settings.get("bandplan_region") or 0
    if region > 0:
        files += json_files("%s/r%d" % (MAIN_DIR, region))
    country = str(settings.get("receiver_country") or "").lower()
    if country:
        files += json_files("%s/%s" % (MAIN_DIR, country))
    return files + [MAIN_FILE]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else OUT
    result = {}
    for path in bookmark_files():
        try:
            with open(path, encoding="utf-8") as fh:
                content = fh.read()
            for b in json.loads(content) if content else []:
                if b.get("name") and (b.get("frequency") or 0) > 0:
                    result[b["frequency"]] = {k: b[k] for k in CAMPOS if k in b}
        except OSError:
            pass
        except ValueError as e:
            print("Aviso: %s no se puede leer: %s" % (path, e), file=sys.stderr)
    memorias = sorted(result.values(), key=lambda b: b["frequency"])

    # escribir en un temporal y renombrar, para no servir nunca un archivo a medias
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(memorias, fh, ensure_ascii=False, separators=(",", ":"))
    os.chmod(tmp, 0o644)
    os.replace(tmp, out)
    print("Memorias escritas: %d en %s" % (len(memorias), out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
