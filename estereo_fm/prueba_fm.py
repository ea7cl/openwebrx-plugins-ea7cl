"""Prueba del decodificador estéreo (sin OpenWebRX en marcha): MPX sintético con L = 1 kHz y
R = 2,5 kHz → ¿cuánto de cada tono sale en el otro canal?"""
import sys
import threading
import time

import numpy as np

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
from pycsdr.modules import Buffer       # noqa: E402
from pycsdr.types import Format         # noqa: E402
from owrx_estereo.fm import EstereoFM   # noqa: E402

fs, fsal = 200000, 48000
t = np.arange(fs * 3) / fs
L = 0.4 * np.sin(2 * np.pi * 1000 * t)
R = 0.4 * np.sin(2 * np.pi * 2500 * t)
piloto = 0.09 * np.sin(2 * np.pi * 19000 * t + 0.3)
mpx = 0.75 * (0.5 * (L + R) + 0.5 * (L - R) * np.sin(2 * np.pi * 38000 * t + 0.6) + piloto)   # 1,0 = 100 kHz
mpx = mpx.astype(np.float32)

m = EstereoFM(fsal, 50e-6)
partes_i, partes_d = [], []
for i in range(0, len(mpx), 8192):
    a_, b_ = m._procesar(mpx[i:i + 8192])
    partes_i.append(a_); partes_d.append(b_)
izq, der = np.concatenate(partes_i)[fsal:], np.concatenate(partes_d)[fsal:]   # sin el primer segundo
y = np.concatenate([izq, der])


def nivel(x, f):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    k = int(round(f * len(x) / fsal))
    return 20 * np.log10(X[k - 2:k + 3].max() + 1e-12)


print("estéreo detectado:", m.estereo, "· piloto %.1f Hz" % m.f_piloto)
print("1 kHz (solo L):  en L %.1f dB, en R %.1f dB → separación %.1f dB" % (nivel(izq, 1000), nivel(der, 1000), nivel(izq, 1000) - nivel(der, 1000)))
print("2,5 kHz (solo R): en R %.1f dB, en L %.1f dB → separación %.1f dB" % (nivel(der, 2500), nivel(izq, 2500), nivel(der, 2500) - nivel(izq, 2500)))
print("nivel de pico de salida: %.2f" % float(np.abs(y).max()))
