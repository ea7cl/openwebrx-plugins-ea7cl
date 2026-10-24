# Muestra los perfiles cuyo nombre contiene un texto y las bandas de la cinta que tocan.
# Uso en el servidor: python3 ver-perfil.py "80"
import json, sys

texto = sys.argv[1] if len(sys.argv) > 1 else ""
bands = json.load(open("/etc/openwebrx/bands.json"))
settings = json.load(open("/var/lib/openwebrx/settings.json"))

for sdr in settings.get("sdrs", {}).values():
    for p in sdr.get("profiles", {}).values():
        if texto not in p.get("name", ""):
            continue
        c, sr = p.get("center_freq", 0), p.get("samp_rate", 0)
        lo, hi = c - sr / 2, c + sr / 2
        print(sdr.get("name"), "|", p.get("name"), "| de", lo, "a", hi,
              "| ancho", sr, "| frec inicial", p.get("start_freq"))
        for b in bands:
            if b.get("upper_bound", 0) > lo and b.get("lower_bound", 0) < hi:
                print("    banda:", b.get("name"), b.get("lower_bound"), b.get("upper_bound"), b.get("tags"))
