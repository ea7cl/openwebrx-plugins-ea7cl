"""DAB en estéreo para OpenWebRX+: la cadena Dablin original termina en Downmix (mezcla a mono).
Aquí se cambia por un módulo que sigue dando ese mismo mono a la cadena de OpenWebRX y, además,
manda el estéreo de dablin a la página por su cuenta (un ADPCM por canal, ver emisor.py).
El estéreo solo se manda si el navegador del oyente usa la misma frecuencia que da dablin
(si no, el remuestreador de OpenWebRX, que es de un canal, no cuadraría con el estéreo)."""

import numpy as np
from pycsdr.types import Format

from csdr.module import ThreadModule


class Separador(ThreadModule):
    def __init__(self):
        self.emisor = None
        super().__init__()

    def getInputFormat(self) -> Format:
        return Format.FLOAT

    def getOutputFormat(self) -> Format:
        return Format.FLOAT

    def poner_salida(self, enviar, comprimir=True):
        from .emisor import EmisorEstereo
        viejo, self.emisor = self.emisor, (EmisorEstereo(enviar, comprimir) if enviar else None)
        if viejo is not None:
            viejo.parar()

    def stop(self):
        if self.emisor is not None:
            self.emisor.parar()
            self.emisor = None
        super().stop()

    def run(self):
        resto = np.zeros(0, np.float32)
        while self.doRun:
            data = self.reader.read()
            if data is None:
                self.doRun = False
                break
            x = np.concatenate((resto, np.frombuffer(data.tobytes(), np.float32)))
            par = len(x) // 2 * 2
            resto, x = x[par:], x[:par]
            if not len(x):
                continue
            izq, der = x[0::2], x[1::2]
            writer = self.writer          # OpenWebRX puede quitarlo un momento al recablear: no morir
            try:
                if writer is not None:
                    writer.write(((izq + der) * 0.5).astype(np.float32).tobytes())   # el mono de siempre
                emisor = self.emisor
                if emisor is not None:
                    emisor.mandar(izq, der)
            except Exception:
                continue


def clase_dablin(DablinOriginal):
    class DablinEstereo(DablinOriginal):
        canales_estereo = 2

        def __init__(self, outputRate: int = 48000):
            super().__init__(outputRate)
            self.separador = Separador()
            self.replace(len(self.workers) - 1, self.separador)    # el Downmix del final

        def poner_salida_estereo(self, enviar, comprimir=True):
            self.separador.poner_salida(enviar, comprimir)

        def poner_mono(self):
            self.separador.poner_salida(None)
            self.canales_estereo = 1

    DablinEstereo.__name__ = "Dablin"
    DablinEstereo.__qualname__ = "Dablin"
    return DablinEstereo
