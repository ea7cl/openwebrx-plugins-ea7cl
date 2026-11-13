"""Prueba de la cadena WFM de OpenWebRX (ya parcheada) sin OpenWebRX en marcha: IQ sintético de una
emisora FM estéreo a 200 kS/s durante unos segundos → ¿sigue saliendo el mono y llegan los
paquetes estéreo todo el rato, sin atascarse?"""
import struct
import threading
import time

import numpy as np
from pycsdr.modules import Buffer
from pycsdr.types import Format

from csdr.chain.analog import WFm        # con el parche: la versión estéreo

fs, segundos = 200000, 12
t = np.arange(fs * segundos) / fs
L = 0.4 * np.sin(2 * np.pi * 1000 * t)
R = 0.4 * np.sin(2 * np.pi * 2500 * t)
mpx = 0.5 * (L + R) + 0.5 * (L - R) * np.sin(2 * np.pi * 38000 * t + 0.6) + 0.09 * np.sin(2 * np.pi * 19000 * t + 0.3)
iq = np.exp(1j * 2 * np.pi * 75000 * np.cumsum(mpx) / fs).astype(np.complex64)

cadena = WFm(48000, 50e-6, False)
print("clase:", type(cadena).__module__, "· trabajadores:", [type(w).__name__ for w in cadena.workers])
paquetes = []
cadena.poner_salida_estereo(paquetes.append, True)
ent, sal = Buffer(Format.COMPLEX_FLOAT), Buffer(Format.FLOAT)
cadena.setReader(ent.getReader())
cadena.setWriter(sal)
mono = [0]


def leer():
    r = sal.getReader()
    while True:
        d = r.read()
        if d is None:
            break
        mono[0] += len(d.tobytes()) // 4


threading.Thread(target=leer, daemon=True).start()
blk = 20000
for i in range(0, len(iq), blk):
    ent.write(iq[i:i + blk].tobytes())
    time.sleep(blk / fs)
    if i % (fs * 2) == 0:
        n_est = sum(struct.unpack("<I", p[2:6])[0] for p in paquetes)
        print("%4.1f s: mono %6d muestras · estéreo %6d muestras en %d paquetes" % (i / fs, mono[0], n_est, len(paquetes)), flush=True)
time.sleep(1)
n_est = sum(struct.unpack("<I", p[2:6])[0] for p in paquetes)
print("FIN %.0f s de señal: mono %d muestras (%.1f s) · estéreo %d (%.1f s)" % (segundos, mono[0], mono[0] / 48000, n_est, n_est / 48000))
cadena.stop()
