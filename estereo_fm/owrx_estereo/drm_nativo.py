"""DRM en estéreo para OpenWebRX+ 1.2.130 o posterior (las que ya traen estéreo propio, HdStereo).

Dream ya saca estéreo (L,R,L,R… en 16 bits a 48 kHz), pero la cadena Drm de OpenWebRX lo mezcla a
mono con un Downmix al final. Aquí se cambia ese Downmix por un módulo que deja pasar L y R tal
cual, marcados como COMPLEX_SHORT (el formato "estéreo" de OpenWebRX), y la cadena se marca
HdStereo. A partir de ahí todo es de OpenWebRX: remuestreo de dos canales, ADPCM estéreo, mensaje
de audio estéreo y reproducción en la página (el complemento estereo_fm pone el botón y la barra L/R).

Es lo mismo que intentó la 1.2.131 (commit e5e4526), pero allí la cadena sigue declarando la salida
de Dream como SHORT (mono): OpenWebRX la trata como un solo canal y el estéreo llega mal. Aquí la
salida se declara bien. Si una versión futura ya lo hace bien (salida COMPLEX_SHORT), no se toca.
"""

import logging

import numpy as np
from pycsdr.types import Format

from csdr.module import ThreadModule

logger = logging.getLogger("owrx_estereo")


class ShortAEstereo(ThreadModule):
    """SHORT intercalado L,R → COMPLEX_SHORT (mismos bytes; solo se cuida de no partir un par)."""

    def getInputFormat(self) -> Format:
        return Format.SHORT

    def getOutputFormat(self) -> Format:
        return Format.COMPLEX_SHORT

    def run(self):
        resto = b""
        while self.doRun:
            data = self.reader.read()
            if data is None:
                self.doRun = False
                break
            datos = resto + data.tobytes()
            entero = len(datos) // 4 * 4          # pares L,R completos (2 shorts = 4 bytes)
            resto = datos[entero:]
            if not entero:
                continue
            writer = self.writer                  # OpenWebRX puede quitarlo un momento al recablear
            if writer is None:
                continue
            try:
                writer.write(np.frombuffer(datos[:entero], np.int16).tobytes())
            except Exception:
                continue


def _dream_tiene_estado():
    """¿Este Dream admite --status-socket (Dream 2.2)? Lee TODA la ayuda, sin carreras."""
    import subprocess
    try:
        r = subprocess.run(["dream", "--help"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           stdin=subprocess.DEVNULL, timeout=10)
        return b"--status-socket" in r.stdout
    except Exception:
        return False


def arreglar_deteccion_dream():
    """OpenWebRX (FeatureDetector.has_dream_2_2) deja de leer la ayuda de Dream en cuanto el
    proceso termina, aunque queden líneas por leer: a veces no llega a ver --status-socket, cree
    que Dream es antiguo y lo guarda 2 horas. Sin eso no hay estado DRM (el panel IO/Time/Frame/
    FAC/SDC/MSC no se colorea). Aquí se cambia por una comprobación que lee toda la ayuda."""
    try:
        from owrx.feature import FeatureDetector, FeatureCache
    except Exception:
        return
    if getattr(FeatureDetector, "_oe_dream", False):
        return
    FeatureDetector.has_dream_2_2 = lambda self: _dream_tiene_estado()
    FeatureDetector._oe_dream = True
    cache = FeatureCache.getSharedInstance()
    if cache.has("dream_2_2") and not cache.get("dream_2_2"):
        cache.cache.pop("dream_2_2", None)       # el "no" guardado se vuelve a comprobar
        logger.info("owrx-estereo: se vuelve a comprobar si Dream admite estado (2.2)")


def clase_drm_nativa(DrmOriginal, HdStereo):
    bases = (DrmOriginal,) if issubclass(DrmOriginal, HdStereo) else (DrmOriginal, HdStereo)

    class DrmEstereo(*bases):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            ultimo = self.workers[-1] if self.workers else None
            if type(ultimo).__name__ == "Downmix":                  # 1.2.130: mezcla a mono al final
                self.replace(len(self.workers) - 1, ShortAEstereo())
            elif ultimo is not None and ultimo.getOutputFormat() == Format.SHORT:
                self.append(ShortAEstereo())                        # 1.2.131: estéreo mal declarado
            # si ya sale COMPLEX_SHORT (versión arreglada), se deja tal cual

    DrmEstereo.__name__ = "Drm"
    DrmEstereo.__qualname__ = "Drm"
    return DrmEstereo
