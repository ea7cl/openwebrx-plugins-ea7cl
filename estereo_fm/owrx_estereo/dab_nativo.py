"""DAB en estéreo para OpenWebRX+ 1.2.130 o posterior (las que ya traen estéreo propio, HdStereo).

La cadena Dablin original termina en Downmix (mezcla a mono). Aquí se cambia por un módulo que
deja pasar el estéreo de dablin tal cual (L,R,L,R… en float = el formato "complejo" que OpenWebRX
usa para el estéreo) y la cadena se marca como HdStereo. A partir de ahí todo es de OpenWebRX:
remuestreo de dos canales, ADPCM estéreo, mensaje de audio estéreo y reproducción en la página.
"""

import numpy as np
from pycsdr.types import Format

from csdr.module import ThreadModule


class AEstereo(ThreadModule):
    """FLOAT intercalado L,R → COMPLEX_FLOAT (mismos bytes; solo se cuida de no partir un par)."""

    def getInputFormat(self) -> Format:
        return Format.FLOAT

    def getOutputFormat(self) -> Format:
        return Format.COMPLEX_FLOAT

    def run(self):
        resto = b""
        while self.doRun:
            data = self.reader.read()
            if data is None:
                self.doRun = False
                break
            datos = resto + data.tobytes()
            entero = len(datos) // 8 * 8          # pares L,R completos (2 floats = 8 bytes)
            resto = datos[entero:]
            if not entero:
                continue
            writer = self.writer                  # OpenWebRX puede quitarlo un momento al recablear
            if writer is None:
                continue
            try:
                writer.write(np.frombuffer(datos[:entero], np.float32).tobytes())
            except Exception:
                continue


def clase_dablin_nativa(DablinOriginal, HdStereo):
    class DablinEstereo(DablinOriginal, HdStereo):
        def __init__(self, outputRate: int = 48000):
            super().__init__(outputRate)
            self.replace(len(self.workers) - 1, AEstereo())     # el Downmix del final

    DablinEstereo.__name__ = "Dablin"
    DablinEstereo.__qualname__ = "Dablin"
    return DablinEstereo
