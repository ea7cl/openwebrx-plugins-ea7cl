#!/usr/bin/env python3
"""Genera profiles.json para el plugin profile_jump de EA7CL.

Lee /var/lib/openwebrx/settings.json y escribe, para cada perfil de los
receptores activados, su frecuencia central y su ancho. No escribe nada
mas (ni claves, ni usuarios). Hay que volver a ejecutarlo cuando se
anadan o cambien perfiles en OpenWebRX+.
"""
import json
import os
import sys

SETTINGS = "/var/lib/openwebrx/settings.json"
OUT = "/usr/lib/python3/dist-packages/htdocs/plugins/receiver/profile_jump/profiles.json"

# Receptores que solo se eligen como ultimo recurso, es decir, cuando
# ningun otro perfil cubre la frecuencia. Se identifican por un trozo del
# nombre del receptor en OpenWebRX+. "\U0001F53B" es el triangulo rojo
# hacia abajo. Para anadir otro: LAST_RESORT = ["\U0001F53B", "otro nombre"]
LAST_RESORT = ["\U0001F53B"]


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def main():
    with open(SETTINGS, encoding="utf-8") as fh:
        settings = json.load(fh)
    profiles = []
    skipped = 0
    for sdr_id, sdr in (settings.get("sdrs") or {}).items():
        if not isinstance(sdr, dict) or not sdr.get("enabled", True):
            continue
        for profile_id, profile in (sdr.get("profiles") or {}).items():
            if not isinstance(profile, dict):
                continue
            center = number(profile.get("center_freq"))
            rate = number(profile.get("samp_rate", sdr.get("samp_rate")))
            if not center or not rate:
                skipped += 1
                continue
            profiles.append({
                "key": "%s|%s" % (sdr_id, profile_id),
                "name": "%s %s" % (sdr.get("name", ""), profile.get("name", "")),
                "center_freq": int(center),
                "samp_rate": int(rate),
                "last": any(mark in str(sdr.get("name", "")) for mark in LAST_RESORT),
            })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"profiles": profiles}, fh, ensure_ascii=False, indent=0)
    os.chmod(OUT, 0o644)
    last = sum(1 for p in profiles if p["last"])
    print("Perfiles escritos: %d (de ultimo recurso: %d; sin datos de frecuencia: %d)" % (len(profiles), last, skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
