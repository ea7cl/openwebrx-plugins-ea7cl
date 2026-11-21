# am-calidad (EA7CL) · AM de mejor calidad para OpenWebRX+ (no toca la SAM)
#
# La AM original es:  AmDemod -> DcBlock -> AGC (perfil "Slow", ganancia inicial 200)
#   · al abrir el squelch con una portadora fuerte, el AGC viene con la ganancia alta y tarda
#     en bajarla: los primeros milisegundos saturan (el "golpe");
#   · DcBlock tarda en quitar el escalon de continua de la portadora;
#   · no hay filtro de audio: pasan los graves (50-300 Hz) y algo de continua.
#
# Aqui, en la cadena de cada oyente sin decodificador:
#   AmDemod -> AudioAm:
#     · AGC por PORTADORA: la ganancia sale del nivel medio de la envolvente (la portadora),
#       medido sobre el mismo tramo que se va a sacar, asi que baja en el acto (sin golpe) y
#       no "bombea" con la modulacion; sube despacio cuando la portadora baja (desvanecimientos);
#     · paso banda FIR: quita del todo la continua y los graves por debajo de PASO_ALTO, y el
#       soplido por encima del paso bajo, que depende de la frecuencia sintonizada:
#         >= 30 MHz (Airband, VHF/UHF) ... 3500 Hz
#         1,8 - 30 MHz (onda corta) ...... 4500 Hz
#         < 1,8 MHz (onda media y larga) . 5000 Hz
#     · limitador blando igual que en fm-calidad 1.1 (desde 0,6, nunca pasa de 0,75).
# Con un decodificador (ACARS...) o en los servicios de fondo: la cadena original tal cual.
import logging
import threading
import numpy as np
from csdr.module import ThreadModule
from csdr.chain.demodulator import DialFrequencyReceiver
from pycsdr.modules import DcBlock, Agc, Gain
from pycsdr.types import Format, AgcProfile

PASO_ALTO = 250.0
PASO_BAJO = [(30e6, 3500.0), (1.8e6, 4500.0), (0.0, 5000.0)]   # (desde Hz, paso bajo Hz)
TAPS = 401             # a 12 kHz: 17 ms de retardo
NIVEL = 1.0            # audio con modulacion al 100 % (por encima del 60 % actua el limitador blando)
GANANCIA_MAX = 50000.0 # tope de ganancia (portadora muy debil o sin portadora); el AGC original llega a 65535
SUBIDA_S = 0.3         # constante de tiempo con la que se recupera la ganancia al bajar la portadora
LIM_RODILLA = 0.6
LIM_TECHO = 0.75
TRAMO_S = 0.01         # tramos de 10 ms
DEPURAR = False        # True: cada 5 s apunta en el registro el pico y la ganancia (solo pruebas)


def paso_bajo_para(frecuencia):
    for desde, pb in PASO_BAJO:
        if frecuencia is not None and frecuencia >= desde:
            return pb
    return PASO_BAJO[-1][1]


def paso_banda(fs, f1, f2, n=TAPS):
    """FIR paso banda f1..f2 Hz (ventana de Kaiser), ganancia 1 en la banda, cero en continua."""
    f2 = min(f2, 0.45 * fs)
    k = np.arange(n) - (n - 1) / 2

    def lp(fc):
        return 2 * fc / fs * np.sinc(2 * fc / fs * k)

    h = (lp(f2) - lp(f1)) * np.kaiser(n, 7.0)
    h -= np.mean(h) * np.kaiser(n, 7.0) / np.mean(np.kaiser(n, 7.0))   # continua exactamente 0
    fm = np.sqrt(f1 * f2)
    g = abs(np.sum(h * np.exp(-2j * np.pi * fm / fs * np.arange(n))))
    return (h / g).astype(np.float32)


class AudioAm(ThreadModule):
    def __init__(self, rate, frecuencia=None):
        self.rate = rate
        self.frecuencia = frecuencia
        self.taps = paso_banda(rate, PASO_ALTO, paso_bajo_para(frecuencia))
        self.nuevos = None
        self.cerrojo = threading.Lock()
        self.hist = np.zeros(TAPS - 1, dtype=np.float32)
        self.retardo = (TAPS - 1) // 2
        self.portadora = 0.0
        self.g = 0.0
        self.tramo = max(1, int(rate * TRAMO_S))
        self.suelta = float(np.exp(-TRAMO_S / SUBIDA_S))
        self.n = 0
        self.pico = 0.0
        self.dc = 0.0
        self.suma = 0.0
        if DEPURAR:
            logging.getLogger("owrx_amcalidad").info(
                "AM nueva activa: %s Hz, audio %d Hz, filtro %d-%d Hz",
                frecuencia, rate, PASO_ALTO, paso_bajo_para(frecuencia))
        super().__init__()

    def setFrecuencia(self, frecuencia):
        pb = paso_bajo_para(frecuencia)
        if pb == paso_bajo_para(self.frecuencia) and self.frecuencia is not None:
            self.frecuencia = frecuencia
            return
        self.frecuencia = frecuencia
        with self.cerrojo:
            self.nuevos = paso_banda(self.rate, PASO_ALTO, pb)

    def getInputFormat(self) -> Format:
        return Format.FLOAT

    def getOutputFormat(self) -> Format:
        return Format.FLOAT

    def procesar(self, x):
        with self.cerrojo:
            if self.nuevos is not None:
                self.taps, self.nuevos = self.nuevos, None
        z = np.concatenate((self.hist, x))
        y = np.convolve(z, self.taps, mode="valid").astype(np.float32)
        self.hist = z[-(TAPS - 1):]
        # envolvente alineada con la salida del filtro (mismo retardo)
        env = z[self.retardo:self.retardo + len(y)]
        out = np.empty_like(y)
        for i in range(0, len(y), self.tramo):
            b = y[i:i + self.tramo]
            c = float(np.mean(np.abs(env[i:i + self.tramo])))
            if c >= self.portadora:
                self.portadora = c                                   # sube la portadora: en el acto
            else:
                self.portadora = self.portadora * self.suelta + c * (1 - self.suelta)
            g1 = min(GANANCIA_MAX, NIVEL / max(self.portadora, 1e-12))
            if g1 <= self.g or self.g == 0.0:
                out[i:i + len(b)] = b * g1                           # bajar: de golpe
            else:
                out[i:i + len(b)] = b * np.linspace(self.g, g1, len(b), endpoint=False, dtype=np.float32)
            self.g = g1
        a = np.abs(out)
        m = a > LIM_RODILLA
        if np.any(m):
            k = LIM_TECHO - LIM_RODILLA
            out[m] = np.sign(out[m]) * (LIM_RODILLA + k * np.tanh((a[m] - LIM_RODILLA) / k))
        # quitacontinua lento (1 s): con señal muy debil el ruido recortado deja algo de continua
        if len(out):
            self.dc += (float(np.mean(out)) - self.dc) * min(1.0, len(out) / self.rate)
            out -= self.dc
        if DEPURAR:
            self.suma += float(np.sum(out))
            self.n += len(out)
            self.pico = max(self.pico, float(np.max(np.abs(out))) if len(out) else 0.0)
            if self.n >= self.rate * 5:
                logging.getLogger("owrx_amcalidad").info(
                    "AM 5 s: pico %.3f, continua %.4f, portadora %.6f, ganancia %.1f",
                    self.pico, self.suma / max(self.n, 1), self.portadora, self.g)
                self.suma = 0.0
                self.n = 0
                self.pico = 0.0
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
                logging.getLogger("owrx_amcalidad").exception("error en el audio AM")
                y = np.zeros_like(x)
            w = self.writer                         # al parar la cadena, OpenWebRX lo deja en None
            if w is None:
                break
            try:
                w.write(y.tobytes())
            except (BrokenPipeError, AttributeError, ValueError):
                break


def crear_clase(AmBase):
    """Devuelve la Am nueva, hija de la original de csdr.chain.analog."""

    class Am(AmBase, DialFrequencyReceiver):
        _amcalidad = True

        def __init__(self, agcProfile: AgcProfile = AgcProfile.SLOW):
            self.agcProfile = agcProfile
            self.sampleRate = 12000
            self.frecuencia = None
            self.alta = False                       # al nacer: cadena original
            super().__init__(agcProfile)

        def setSampleRate(self, sampleRate: int) -> None:
            if sampleRate == self.sampleRate:
                return
            self.sampleRate = sampleRate
            if self.alta:
                self._rehacer()

        def setDialFrequency(self, frequency: int) -> None:
            self.frecuencia = frequency
            if self.alta:
                try:
                    self.workers[1].setFrecuencia(frequency)
                except Exception:
                    logging.getLogger("owrx_amcalidad").exception("cambio de frecuencia")

        def setAltaCalidad(self, alta: bool) -> None:
            if alta == self.alta:
                return
            self.alta = alta
            self._rehacer()

        def _rehacer(self):
            if self.alta:
                self.replace(1, AudioAm(self.sampleRate, self.frecuencia))
                self.replace(2, Gain(Format.FLOAT, 1.0))   # ocupa el sitio del AGC sin tocar nada
            else:                                   # igual que la Am original
                agc = Agc(Format.FLOAT)
                agc.setProfile(self.agcProfile)
                agc.setInitialGain(200)
                self.replace(1, DcBlock())
                self.replace(2, agc)

    Am.__qualname__ = AmBase.__qualname__
    Am.__module__ = AmBase.__module__
    return Am


