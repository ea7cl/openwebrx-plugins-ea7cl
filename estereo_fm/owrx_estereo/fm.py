"""Decodificador estéreo de FM comercial para la cadena de OpenWebRX+ (módulo de pycsdr en Python).

Entrada: salida de FmDemod a 200 000 m/s (el múltiplex; 1,0 = 100 kHz de desviación).
Salida : el MONO de siempre (L+R) para la cadena de OpenWebRX, a la frecuencia de audio "HD" del
         oyente; el estéreo (L y R) va aparte a la página con un ADPCM por canal (emisor.py).

MPX = (L+R) + piloto de 19 kHz + (L−R) en doble banda lateral a 38 kHz (+ RDS a 57 kHz):
  · el piloto se mide en cada bloque con un oscilador de 19 kHz que se corrige solo (lazo de
    frecuencia): da su amplitud (¿hay estéreo?) y su fase;
  · la subportadora de 38 kHz se regenera al doble de la fase del piloto y se saca L−R;
  · L+R y L−R pasan por el mismo filtro de 15 kHz (mismo retardo: buena separación);
  · de-énfasis (50 µs en Europa) en cada canal y cambio a la frecuencia de salida.
Es el mismo método que el de OndaWebSDR (medido: más de 100 dB de separación).
"""

import math
import threading

import numpy as np
from pycsdr.types import Format

from csdr.module import ThreadModule

R_MPX = 200000.0


def _paso_bajo(ntaps, corte, fs):
    n = np.arange(ntaps) - (ntaps - 1) / 2
    h = np.sinc(2 * corte / fs * n) * np.blackman(ntaps)
    return (h / h.sum()).astype(np.float32)


class _FIR:
    """Filtro FIR continuo entre bloques."""

    def __init__(self, h):
        self.h = h
        self.estado = np.zeros(len(h) - 1, np.float32)

    def __call__(self, x):
        z = np.concatenate((self.estado, x))
        self.estado = z[len(z) - (len(self.h) - 1):]
        return np.convolve(z, self.h, mode="valid").astype(np.float32)


class _Remuestreo:
    """Interpolación lineal continua entre bloques (la señal ya viene filtrada a 15 kHz)."""

    def __init__(self, fin, fout):
        self.paso = fin / fout
        self.pos = 0.0
        self.prev = np.float32(0)

    def __call__(self, x):
        if not len(x):
            return x
        z = np.concatenate(([self.prev], x))
        disp = len(z) - 1
        idx = np.arange(self.pos, disp, self.paso)
        out = np.interp(idx, np.arange(len(z)), z).astype(np.float32)
        self.pos = (idx[-1] + self.paso - disp) if len(idx) else (self.pos - disp)
        self.prev = z[-1]
        return out


class _Deenfasis:
    """De-énfasis de 1.er orden (FIR exponencial truncado, continuo entre bloques)."""

    def __init__(self, fs, tau):
        a = 1.0 - math.exp(-1.0 / (fs * tau))
        n = int(6 * tau * fs) + 2
        h = a * (1 - a) ** np.arange(n)
        self.fir = _FIR((h / h.sum()).astype(np.float32))

    def __call__(self, x):
        return self.fir(x)


class EstereoFM(ThreadModule):
    def __init__(self, sampleRate: int, tau: float):
        self.lock = threading.Lock()
        self.tau = tau
        self.sampleRate = sampleRate
        self._montar()
        self.fase = 0.0
        self.f_piloto = 19000.0
        self.prev = None
        self.amp = 0.0
        self.estereo = False
        self.emisor = None          # envío del estéreo a la página (lo pone el enganche)
        super().__init__()

    def _montar(self):
        h = _paso_bajo(127, 15000, R_MPX)
        self.lp_suma, self.lp_dif = _FIR(h), _FIR(h.copy())
        self.res_i, self.res_d = _Remuestreo(R_MPX, self.sampleRate), _Remuestreo(R_MPX, self.sampleRate)
        self.de_i, self.de_d = _Deenfasis(self.sampleRate, self.tau), _Deenfasis(self.sampleRate, self.tau)
        self._tau_montado, self._rate_montado = self.tau, self.sampleRate

    def setSampleRate(self, sampleRate: int) -> None:
        with self.lock:
            self.sampleRate = sampleRate

    def setTau(self, tau: float) -> None:
        with self.lock:
            self.tau = tau

    def getInputFormat(self) -> Format:
        return Format.FLOAT

    def getOutputFormat(self) -> Format:
        return Format.FLOAT

    def run(self):
        while self.doRun:
            data = self.reader.read()
            if data is None:
                self.doRun = False
                break
            mpx = np.frombuffer(data.tobytes(), np.float32)
            if not len(mpx):
                continue
            try:
                izq, der = self._procesar(mpx)
            except Exception:
                continue
            if not len(izq):
                continue
            # a la cadena de OpenWebRX va el MONO de siempre (mismo nivel que el original);
            # el estéreo va aparte, con un ADPCM por canal (emisor.py)
            writer = self.writer          # OpenWebRX puede quitarlo un momento al recablear: no morir
            try:
                if writer is not None:
                    writer.write(((izq + der) * 0.5).astype(np.float32).tobytes())
                emisor = self.emisor
                if emisor is not None:
                    emisor.mandar(izq, der)
            except Exception:
                continue

    def poner_salida(self, enviar, comprimir=True):
        """La pone el enganche de dsp.py: función que manda bytes a la página del oyente."""
        from .emisor import EmisorEstereo
        viejo, self.emisor = self.emisor, (EmisorEstereo(enviar, comprimir) if enviar else None)
        if viejo is not None:
            viejo.parar()

    def stop(self):
        if self.emisor is not None:
            self.emisor.parar()
            self.emisor = None
        super().stop()

    def _procesar(self, mpx):
        with self.lock:
            if self.tau != self._tau_montado or self.sampleRate != self._rate_montado:
                self._montar()
        n = len(mpx)
        w = 2 * np.pi * self.f_piloto / R_MPX
        fase = self.fase + w * np.arange(n)
        self.fase = float((self.fase + w * n) % (2 * np.pi))
        p = complex(np.mean(mpx * np.exp(-1j * fase)))       # piloto: amplitud/2 · e^{j·fase}
        if self.prev is not None and abs(p) > 1e-4 and abs(self.prev) > 1e-4:
            d = p * self.prev.conjugate()
            self.f_piloto += 0.25 * math.atan2(d.imag, d.real) / (2 * np.pi * n / R_MPX)
            self.f_piloto = min(19010.0, max(18990.0, self.f_piloto))
        self.prev = p
        # piloto al 9 % de 75 kHz → |p| ≈ 0,034 en esta escala (1,0 = 100 kHz); histéresis
        self.amp = 0.7 * self.amp + 0.3 * abs(p)
        self.estereo = self.amp > (0.009 if self.estereo else 0.015)
        suma = self.lp_suma(mpx)                              # L+R
        if self.estereo:
            phi = math.atan2(p.imag, p.real)
            sub = (-2.0 * np.sin(2 * (fase + phi))).astype(np.float32)
            dif = self.lp_dif(mpx * sub)                      # L−R
        else:
            self.lp_dif(np.zeros(n, np.float32))              # mantiene el filtro al día
            dif = np.zeros_like(suma)
        izq = self.de_i(self.res_i(suma + dif))
        der = self.de_d(self.res_d(suma - dif))
        k = min(len(izq), len(der))
        # volumen parecido al mono de OpenWebRX
        return np.clip(izq[:k] * 0.7, -1.0, 1.0), np.clip(der[:k] * 0.7, -1.0, 1.0)


def clase_wfm(WFmOriginal):
    """Devuelve una WFm de OpenWebRX que da estéreo (misma interfaz, RDS incluido)."""
    from pycsdr.modules import FmDemod, Limit, Buffer

    class WFmEstereo(WFmOriginal):
        canales_estereo = 2

        def __init__(self, sampleRate: int, tau: float, rdsRbds: bool):
            self.sampleRate = sampleRate
            self.tau = tau
            self.rdsRbds = rdsRbds
            self.limit = Limit()
            self.metaTapBuffer = Buffer(Format.FLOAT)      # para el RDS, como en el original
            self.estereo = EstereoFM(sampleRate, tau)
            self.metaChain = None
            self.metaWriter = None
            super(WFmOriginal, self).__init__([FmDemod(), self.limit, self.estereo])

        def setDeemphasisTau(self, tau: float) -> None:
            self.tau = tau
            self.estereo.setTau(tau)

        def setSampleRate(self, sampleRate: int) -> None:
            self.sampleRate = sampleRate
            self.estereo.setSampleRate(sampleRate)

        def poner_salida_estereo(self, enviar, comprimir=True):
            self.estereo.poner_salida(enviar, comprimir)

    WFmEstereo.__name__ = "WFm"
    WFmEstereo.__qualname__ = "WFm"
    return WFmEstereo
