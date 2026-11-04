#!/usr/bin/python3 -I
# meshtastic_narrow (EA7CL): añade o quita en OpenWebRX+ el modo "Meshtastic Narrow"
# (Meshtastic a 62,5 kHz, SF7-9, para los modos Narrow de la banda de 868 MHz).
#
# Toca tres archivos de OpenWebRX. Cada trozo añadido va entre dos marcas
# "# EA7CL meshtastic_narrow (inicio)" y "(fin)", así que quitarlo deja el archivo
# exactamente como estaba. Si ya está puesto, no lo vuelve a poner.
#
# Uso:  python3 -I meshtastic_narrow_parchear.py poner|quitar|ver [carpeta de dist-packages]
import os, sys

INI = "# EA7CL meshtastic_narrow (inicio)"
FIN = "# EA7CL meshtastic_narrow (fin)"

# archivo, texto delante del cual se inserta (o None = al final), trozo a insertar
CAMBIOS = [
    ("owrx/modes.py",
     '        DigitalMode(\n            "meshcore",\n',
     '''        DigitalMode(
            "meshtastic-narrow",
            "Meshtastic Narrow",
            underlying=["empty"],
            bandpass=None,
            ifRate=1000000,
            requirements=["meshtastic"],
            service=False,
            squelch=True
        ),
'''),
    ("owrx/dsp.py",
     '        elif mod == "meshcore":\n',
     '''        elif mod == "meshtastic-narrow":
            from csdr.chain.lora import MeshtasticNarrowDemodulator
            return MeshtasticNarrowDemodulator()
'''),
    ("csdr/chain/lora.py",
     None,
     '''
# Meshtastic en los modos Narrow de 868 MHz: 62,5 kHz (-b 6), SF7 a SF9
class MeshtasticNarrowDemodulator(LoraDemodulator):
    def __init__(self, sampleRate: int = 1000000, service: bool = False):
        super().__init__(sampleRate, [
            "-H", "5", "-W", "50", "-b", "6", "-s", "7", "-s", "8", "-s", "9"
        ], MeshtasticParser(service))
'''),
]


def sangria(antes):
    # las marcas llevan la sangría de la línea que sigue
    return antes[:len(antes) - len(antes.lstrip(" "))] if antes else ""


def poner(base):
    for rel, ancla, trozo in CAMBIOS:
        f = os.path.join(base, rel)
        t = open(f, encoding="utf-8").read()
        if INI in t:
            print(f"ya estaba: {rel}")
            continue
        if ancla is None:
            nuevo = t.rstrip("\n") + "\n\n" + INI + trozo + FIN + "\n"
        else:
            if t.count(ancla) != 1:
                sys.exit(f"ERROR: en {rel} no encuentro una sola vez el sitio donde insertar; no se toca nada más")
            s = sangria(ancla)
            nuevo = t.replace(ancla, s + INI + "\n" + trozo + s + FIN + "\n" + ancla)
        compile(nuevo, f, "exec")  # que siga siendo Python válido
        tmp = f + ".tmp-mn"
        with open(tmp, "w", encoding="utf-8") as o:
            o.write(nuevo)
        os.chmod(tmp, os.stat(f).st_mode)
        os.replace(tmp, f)
        print(f"añadido: {rel}")


def quitar(base):
    for rel, _, _ in CAMBIOS:
        f = os.path.join(base, rel)
        lineas = open(f, encoding="utf-8").read().split("\n")
        fuera, dentro = [], False
        for l in lineas:
            if l.strip() == INI:
                dentro = True
                continue
            if l.strip() == FIN and dentro:
                dentro = False
                continue
            if not dentro:
                fuera.append(l)
        nuevo = "\n".join(fuera)
        if rel.endswith("lora.py"):
            nuevo = nuevo.rstrip("\n") + "\n"
        if nuevo == "\n".join(lineas):
            print(f"no estaba: {rel}")
            continue
        compile(nuevo, f, "exec")
        tmp = f + ".tmp-mn"
        with open(tmp, "w", encoding="utf-8") as o:
            o.write(nuevo)
        os.chmod(tmp, os.stat(f).st_mode)
        os.replace(tmp, f)
        print(f"quitado: {rel}")


def ver(base):
    for rel, _, _ in CAMBIOS:
        t = open(os.path.join(base, rel), encoding="utf-8").read()
        print(("puesto:    " if INI in t else "no puesto: ") + rel)


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("poner", "quitar", "ver"):
        sys.exit(__doc__ or "uso: poner|quitar|ver [dist-packages]")
    base = sys.argv[2] if len(sys.argv) > 2 else "/usr/lib/python3/dist-packages"
    {"poner": poner, "quitar": quitar, "ver": ver}[sys.argv[1]](base)
