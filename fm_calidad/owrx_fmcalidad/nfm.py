# fm-calidad (EA7CL) · cadena NFM de alta calidad para OpenWebRX+
#
# La NFM original demodula a la velocidad de audio del oyente (12 kHz): el canal se recorta
# a ±4 kHz (máximo ±6 kHz) y la FM se deforma, sobre todo con 5 kHz de desviación y en los
# agudos. Además el AGC cambia la ganancia muestra a muestra y mete distorsión.
#
# Aquí, en la cadena de cada oyente (sin decodificador digital):
#   selector a 48 kHz -> FmDemod (atan2) -> de-énfasis NFM a 48 kHz -> 48k->12k
#   -> paso banda 290-4000 Hz (quita CTCSS y soplido) -> nivelador suave -> limitador blando
# 1.1: paso alto a 290 Hz con filtro mas largo (todos los subtonos hasta 210 Hz < -78 dB),
#      nivelador a 0,5 que baja de golpe y limitador que no pasa de 0,75 (unos 2,5 dB de margen).
# Con un decodificador (packet, POCSAG, AIS...) o en los servicios de fondo se usa la cadena
# original tal cual (mismas velocidades), para no cambiar nada a los decodificadores.
import logging
import numpy as np
from csdr.module import ThreadModule
from pycsdr.modules import NfmDeemphasis, FractionalDecimator, Agc, Limit
from pycsdr.types import Format, AgcProfile

IF_HQ = 48000          # velocidad de la FI para demodular
AUDIO_LO = 290.0       # paso banda del audio (Hz); 1.0: 200
AUDIO_HI = 4000.0
AUDIO_TAPS = 511       # largo del filtro (a 12 kHz, 21 ms de retardo); 1.0: 201
NIVEL = 0.5            # pico que busca el nivelador; 1.0: 0,6
LIM_RODILLA = 0.6      # el limitador empieza a actuar aqui; 1.0: 0,9
LIM_TECHO = 0.75       # y nunca pasa de aqui (-2,5 dB del maximo); 1.0: 1,0


def paso_banda(fs, f1, f2, n=201):
    """FIR paso banda f1..f2 Hz (ventana de Kaiser), ganancia 1 en la banda."""
    f2 = min(f2, 0.45 * fs)
    k = np.arange(n) - (n - 1) / 2

    def lp(fc):
        return 2 * fc / fs * np.sinc(2 * fc / fs * k)

    h = (lp(f2) - lp(f1)) * np.kaiser(n, 7.0)
    fm = np.sqrt(f1 * f2)
    g = abs(np.sum(h * np.exp(-2j * np.pi * fm / fs * np.arange(n))))
    return (h / g).astype(np.float32)


class AudioNfm(ThreadModule):
    """Filtro de audio + nivelador suave (sin distorsión) + limitador blando."""

    def __init__(self, rate, gain=2.0, nivel=NIVEL, subida_db=3.0, rango_db=(-14.0, 4.0)):
        self.taps = paso_banda(rate, AUDIO_LO, AUDIO_HI, AUDIO_TAPS)
        self.hist = np.zeros(len(self.taps) - 1, dtype=np.float32)
        self.g0 = float(gain)                          # ganancia nominal
        self.g = self.g0
        self.gmin = self.g0 * 10 ** (rango_db[0] / 20)
        self.gmax = self.g0 * 10 ** (rango_db[1] / 20)
        self.nivel = nivel                              # pico que se busca
        self.sub = max(1, int(rate * 0.02))             # tramos de 20 ms
        self.paso = 10 ** (subida_db * 0.02 / 20)       # sube despacio (subida_db por segundo)
        super().__init__()

    def getInputFormat(self) -> Format:
        return Format.FLOAT

    def getOutputFormat(self) -> Format:
        return Format.FLOAT

    def procesar(self, x):
        z = np.concatenate((self.hist, x))
        y = np.convolve(z, self.taps, mode="valid").astype(np.float32)
        self.hist = z[-(len(self.taps) - 1):]
        out = np.empty_like(y)
        for i in range(0, len(y), self.sub):
            b = y[i:i + self.sub]
            pico = float(np.max(np.abs(b)))
            # sube despacio solo si el pico queda por debajo del nivel; si no, se mantiene
            g1 = min(self.g * self.paso, self.gmax) if pico * self.g * self.paso < self.nivel else self.g
            if pico * g1 > self.nivel * 1.4:            # demasiado fuerte: baja ya
                g1 = max(self.gmin, self.nivel * 1.4 / max(pico, 1e-9))
                out[i:i + len(b)] = b * g1              # 1.1: de golpe, sin rampa (no se escapa el pico)
            else:
                out[i:i + len(b)] = b * np.linspace(self.g, g1, len(b), endpoint=False, dtype=np.float32)
            self.g = g1
        # limitador blando: desde LIM_RODILLA se curva y nunca pasa de LIM_TECHO
        a = np.abs(out)
        m = a > LIM_RODILLA
        if np.any(m):
            k = LIM_TECHO - LIM_RODILLA
            out[m] = np.sign(out[m]) * (LIM_RODILLA + k * np.tanh((a[m] - LIM_RODILLA) / k))
        return out

    def run(self):
        while self.doRun:
            data = self.reader.read()
            if data is None:
                self.doRun = False
                break
            x = np.frombuffer(data, dtype=np.float32)
            if len(x) == 0:
                continue
            try:
                y = self.procesar(x)
            except Exception:
                logging.getLogger("owrx_fmcalidad").exception("error en el audio NFM")
                y = np.clip(x, -1, 1)                   # que no se corte el audio
            try:
                self.writer.write(y.tobytes())
            except BrokenPipeError:
                break


def crear_clase(NFmBase):
    """Devuelve la NFm nueva, hija de la original de csdr.chain.analog."""

    class NFm(NFmBase):
        _fmcalidad = True

        def __init__(self, sampleRate: int, agcProfile: AgcProfile = AgcProfile.SLOW):
            self.agcProfile = agcProfile
            self.ifRate = sampleRate                    # al nacer: cadena original
            super().__init__(sampleRate, agcProfile)

        def esAltaCalidad(self):
            return self.ifRate > self.sampleRate

        def setIfRate(self, ifRate: int) -> None:
            if ifRate == self.ifRate:
                return
            self.ifRate = ifRate
            self._rehacer()

        def setSampleRate(self, sampleRate: int) -> None:
            if sampleRate == self.sampleRate:
                return
            self.sampleRate = sampleRate
            self._rehacer()

        def _rehacer(self):
            if self.esAltaCalidad():
                nuevos = [
                    NfmDeemphasis(self.ifRate),
                    FractionalDecimator(Format.FLOAT, self.ifRate / self.sampleRate, prefilter=True),
                    AudioNfm(self.sampleRate),
                ]
            else:                                       # igual que la NFm original
                agc = Agc(Format.FLOAT)
                agc.setProfile(self.agcProfile)
                agc.setMaxGain(3)
                nuevos = [Limit(Format.FLOAT), NfmDeemphasis(self.sampleRate), agc]
            for i, w in enumerate(nuevos, 1):
                self.replace(i, w)

    NFm.__qualname__ = NFmBase.__qualname__
    NFm.__module__ = NFmBase.__module__
    return NFm
