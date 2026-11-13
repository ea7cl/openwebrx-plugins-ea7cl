"""¿Mete ruido el ADPCM con L,R intercalados? Se toma IQ real del rtl_connector de OpenWebRX
(puerto local), se demodula FM y se decodifica el estéreo con owrx_estereo, y se compara el ADPCM
intercalado (como va ahora) con un ADPCM para cada canal, contra el audio limpio."""
import socket
import sys
import threading
import time

import numpy as np

sys.path.insert(0, sys.argv[1])
from pycsdr.modules import Buffer, Shift, FirDecimate, FractionalDecimator, FmDemod   # noqa: E402
from pycsdr.types import Format                                                      # noqa: E402
from owrx_estereo.fm import EstereoFM                                                 # noqa: E402

puerto, centro, f = int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
fs = 2400000
s = socket.create_connection(("127.0.0.1", puerto))
datos = bytearray()
while len(datos) < fs * 8 * 4:
    d = s.recv(1 << 20)
    if not d:
        break
    datos += d
s.close()
x = np.frombuffer(bytes(datos[: len(datos) // 8 * 8]), np.complex64)

mods = [Shift(-(f - centro) / fs), FirDecimate(12, 0.15 * 200000 / fs, 0.5 * 200000 / fs * 12 / 12),
        FmDemod(), EstereoFM(48000, 50e-6)]
# FirDecimate(12): 2,4 MS/s / 12 = 200 kS/s (lo que espera EstereoFM)
ent = Buffer(Format.COMPLEX_FLOAT, size=4194304)
mods[0].setReader(ent.getReader())
for a, b in zip(mods, mods[1:]):
    buf = Buffer(a.getOutputFormat(), size=1048576)
    a.setWriter(buf)
    b.setReader(buf.getReader())
sal = Buffer(Format.FLOAT, size=1048576)
mods[-1].setWriter(sal)
out = []


def leer():
    r = sal.getReader()
    while True:
        d = r.read()
        if d is None:
            break
        out.append(np.frombuffer(d.tobytes(), np.float32))


threading.Thread(target=leer, daemon=True).start()
paso = 240000
for i in range(0, len(x), paso):
    ent.write(x[i:i + paso].tobytes())
    time.sleep(paso / fs)
time.sleep(1.5)
y = np.concatenate(out)
y = y[len(y) // 4:]                               # sin el principio (enganche del piloto)
l = np.clip(y[0::2] * 32767, -32768, 32767).astype(np.int32)
r = np.clip(y[1::2] * 32767, -32768, 32767).astype(np.int32)
n = min(len(l), len(r)); l, r = l[:n], r[:n]

IDX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8]
ST = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97,
      107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
      876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428,
      4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350,
      22385, 24623, 27086, 29794, 32767]


def ima(xs):
    pred, si = 0, 0
    o = np.empty(len(xs), np.int32)
    for i, v in enumerate(xs.tolist()):
        step = ST[si]
        diff = v - pred
        nib = 0
        if diff < 0:
            nib, diff = 8, -diff
        dq = step >> 3
        if diff >= step:
            nib |= 4; diff -= step; dq += step
        if diff >= step >> 1:
            nib |= 2; diff -= step >> 1; dq += step >> 1
        if diff >= step >> 2:
            nib |= 1; dq += step >> 2
        pred = max(-32768, min(32767, pred - dq if nib & 8 else pred + dq))
        si = max(0, min(88, si + IDX[nib]))
        o[i] = pred
    return o


def snr(a, b):
    return 10 * np.log10(np.sum(a.astype(float) ** 2) / max(1.0, np.sum((a - b).astype(float) ** 2)))


k = min(n, 48000 * 2)
l, r = l[:k], r[:k]
inter = np.empty(2 * k, np.int32); inter[0::2] = l; inter[1::2] = r
di = ima(inter)
li, ri = di[0::2], di[1::2]
lc, rc = ima(l), ima(r)
m = (l + r) // 2
mc = ima(m)
cor = float(np.corrcoef(l, r)[0, 1])
print("segundos %.1f · correlación L-R %.2f" % (k / 48000, cor))
print("INTERCALADO (como ahora): SNR L %.1f dB, R %.1f dB" % (snr(l, li), snr(r, ri)))
print("UN ADPCM POR CANAL:       SNR L %.1f dB, R %.1f dB" % (snr(l, lc), snr(r, rc)))
print("MONO (OpenWebRX normal):  SNR %.1f dB" % snr(m, mc))
