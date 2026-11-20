#!/usr/bin/env python3
import pathlib, shutil, sys

ROOT = pathlib.Path("/usr/lib/python3/dist-packages/htdocs/plugins/receiver")
RIG = ROOT / "rig_skin" / "rig_skin.js"
INIT = ROOT / "init.js"
UPDATER = ROOT / "update-rig-skin.sh"
BEGIN = "/* DOPPLER_AUTOSTART_HOOK_BEGIN */"
END = "/* DOPPLER_AUTOSTART_HOOK_END */"

def backup(path):
    target = path.with_name(path.name + ".doppler-autostart.bak")
    if not target.exists():
        shutil.copy2(path, target)

def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError("No se encontró el punto de integración: " + label)
    return text.replace(old, new, 1)

def apply():
    for p in (RIG, INIT, UPDATER):
        if not p.is_file():
            raise RuntimeError("Falta el archivo requerido: " + str(p))

    s = RIG.read_text()
    if BEGIN not in s:
        backup(RIG)
        hooks = [
            (
                "            Plugins.rig_skin.tuneTo(b[2].f, b[2].mode);",
                "            Plugins.rig_skin.tuneTo(b[2].f, b[2].mode);\n"
                "            " + BEGIN + "\n"
                "            $(document).trigger('owrxplus:satellite-tuned', [b[2]]);\n"
                "            " + END
            ),
            (
                "                    Plugins.rig_skin.tuneTo(x.f, x.mode);",
                "                    Plugins.rig_skin.tuneTo(x.f, x.mode);\n"
                "                    " + BEGIN + "\n"
                "                    $(document).trigger('owrxplus:satellite-tuned', [p.sat]);\n"
                "                    " + END
            ),
            (
                "          Plugins.rig_skin.tuneTo(p.sat.f, p.sat.mode);",
                "          Plugins.rig_skin.tuneTo(p.sat.f, p.sat.mode);\n"
                "          " + BEGIN + "\n"
                "          $(document).trigger('owrxplus:satellite-tuned', [p.sat]);\n"
                "          " + END
            )
        ]
        for old, new in hooks:
            s = replace_once(s, old, new, old.strip())
        RIG.write_text(s)

    s = INIT.read_text()
    load = "Plugins.load('doppler_autostart');"
    if load not in s:
        backup(INIT)
        doppler = "Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/doppler/doppler.js');"
        s = replace_once(s, doppler, doppler + "\n" + load, "carga Doppler en init.js")
        INIT.write_text(s)

    s = UPDATER.read_text()
    marker = "# DOPPLER_AUTOSTART_REAPPLY"
    if marker not in s:
        backup(UPDATER)
        anchor = 'cp -f "$TMP/stage/rig_skin/"* "$DIR/rig_skin/"'
        addition = (anchor + "\n" + marker +
                    '\nif [ -x "$DIR/doppler_autostart/reapply.sh" ]; then\n'
                    '    "$DIR/doppler_autostart/reapply.sh"\nfi')
        s = replace_once(s, anchor, addition, "copia de rig_skin en actualizador")
        UPDATER.write_text(s)

def main():
    apply()
    print("Integración Doppler instalada/reaplicada correctamente.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ERROR:", exc, file=sys.stderr)
        sys.exit(1)
