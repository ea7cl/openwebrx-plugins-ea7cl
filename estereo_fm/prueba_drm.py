"""Prueba de la cadena DRM estéreo sin OpenWebRX en marcha y sin emisora DRM.

Se pone un "dream" falso delante en el PATH (solo para esta prueba) que ignora el IQ y saca 48 kHz
estéreo en 16 bits: L = tono de 1000 Hz, R = tono de 2500 Hz. Se comprueba que la cadena Drm
parcheada declara la salida como estéreo (COMPLEX_SHORT, HdStereo) y que L y R llegan separados.

Uso (en la máquina con OpenWebRX, desde la carpeta del paquete):  python3 prueba_drm.py
"""
import os
import stat
import sys
import tempfile
import threading
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

FALSO = r'''#!/usr/bin/env python3
import sys, threading, time
import numpy as np
if "--help" in sys.argv:
    print("dream falso"); sys.exit(0)
def tragar():
    while sys.stdin.buffer.read(65536):
        pass
threading.Thread(target=tragar, daemon=True).start()
fs, n, k = 48000, 4800, 0
while True:
    t = (np.arange(n) + k) / fs
    s = np.empty(2 * n, np.int16)
    s[0::2] = (12000 * np.sin(2 * np.pi * 1000 * t)).astype(np.int16)
    s[1::2] = (6000 * np.sin(2 * np.pi * 2500 * t)).astype(np.int16)
    try:
        sys.stdout.buffer.write(s.tobytes()); sys.stdout.buffer.flush()
    except BrokenPipeError:
        break
    k += n
    time.sleep(n / fs)
'''

carpeta = tempfile.mkdtemp(prefix="dream_falso_")
ruta = os.path.join(carpeta, "dream")
with open(ruta, "w") as f:
    f.write(FALSO)
os.chmod(ruta, stat.S_IRWXU)
os.environ["PATH"] = carpeta + os.pathsep + os.environ["PATH"]

from pycsdr.modules import Buffer
from pycsdr.types import Format
import csdr.chain.drm as modulo
from csdr.chain.demodulator import HdStereo
import owrx_estereo.enganche as oe

if not getattr(modulo.Drm, "__module__", "").startswith("owrx_estereo"):
    oe.aplicar_drm(vars(modulo))          # si drm.py aún no está parcheado, se aplica aquí
Drm = modulo.Drm

cadena = Drm()
print("clase:", Drm.__module__, "· HdStereo:", isinstance(cadena, HdStereo))
print("trabajadores:", [type(w).__name__ for w in cadena.workers])
print("salida declarada:", cadena.getOutputFormat())
assert isinstance(cadena, HdStereo), "no es HdStereo"
assert cadena.getOutputFormat() == Format.COMPLEX_SHORT, "la salida no es estéreo"

ent, sal = Buffer(Format.COMPLEX_FLOAT), Buffer(cadena.getOutputFormat())
cadena.setReader(ent.getReader())
cadena.setWriter(sal)
recibido = bytearray()


def leer():
    r = sal.getReader()
    while True:
        d = r.read()
        if d is None:
            break
        recibido.extend(d.tobytes())


threading.Thread(target=leer, daemon=True).start()
ruido = (np.random.randn(4800) + 1j * np.random.randn(4800)).astype(np.complex64) * 0.01
for _ in range(30):                      # 3 s de "IQ" a 48 kS/s
    ent.write(ruido.tobytes())
    time.sleep(0.1)
time.sleep(0.5)
cadena.stop()

s = np.frombuffer(bytes(recibido[: len(recibido) // 4 * 4]), np.int16)
L, R = s[0::2].astype(float), s[1::2].astype(float)
print("recibido: %.2f s de estéreo" % (len(L) / 48000))
assert len(L) > 48000, "llega muy poco audio"


def tono(x):
    f = np.abs(np.fft.rfft(x[-32768:] * np.hanning(32768)))
    return np.fft.rfftfreq(32768, 1 / 48000)[np.argmax(f)]


fl, fr = tono(L), tono(R)
print("L: %.0f Hz (pico %.0f) · R: %.0f Hz (pico %.0f)" % (fl, np.abs(L).max(), fr, np.abs(R).max()))
assert abs(fl - 1000) < 20 and abs(fr - 2500) < 20, "L y R no son los que manda Dream"
print("OK: el DRM llega en estéreo, con L y R separados")
