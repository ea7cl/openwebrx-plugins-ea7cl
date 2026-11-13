"""Prueba del envío del estéreo (emisor.py) con el mismo descompresor que la página (IMA ADPCM):
se mandan dos canales "musicales" poco parecidos y se mide la calidad que llega."""
import struct
import sys

import numpy as np

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
from owrx_estereo.emisor import EmisorEstereo   # noqa: E402

IDX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8]
ST = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97,
      107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
      876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428,
      4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350,
      22385, 24623, 27086, 29794, 32767]


class Decod:                                   # copia del ImaAdpcmCodec.decode de OpenWebRX (JS)
    def __init__(self):
        self.si, self.pred, self.step = 0, 0, 0

    def nib(self, n):
        self.si = min(max(self.si + IDX[n], 0), 88)
        d = self.step >> 3
        if n & 1: d += self.step >> 2
        if n & 2: d += self.step >> 1
        if n & 4: d += self.step
        if n & 8: d = -d
        self.pred = min(max(self.pred + d, -32768), 32767)
        self.step = ST[self.si]
        return self.pred

    def decode(self, b):
        o = []
        for x in b:
            o.append(self.nib(x & 15)); o.append(self.nib(x >> 4))
        return np.array(o, np.int32)


rng = np.random.default_rng(3)
fs, n = 48000, 48000 * 2


def musica():
    x = np.cumsum(rng.normal(0, 1, n)); x = x - np.convolve(x, np.ones(200) / 200, "same")
    t = np.arange(n) / fs
    for f in (220, 330, 440, 660, 880, 1320, 2640):
        x += 30 * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (1 + np.sin(2 * np.pi * rng.uniform(.5, 3) * t))
    return x


a, b, c = musica(), musica(), musica()
L, R = a + 0.6 * c, b + 0.6 * c
s = 0.2 / np.std(np.concatenate([L, R]))
L, R = (L * s).astype(np.float32), (R * s).astype(np.float32)
paquetes = []
em = EmisorEstereo(paquetes.append, comprimir=(sys.argv[2] != "pcm") if len(sys.argv) > 2 else True)
for i in range(0, n, 1999):                     # bloques de tamaño impar a propósito
    em.mandar(L[i:i + 1999], R[i:i + 1999])
em.parar()
dl, dr, sl, sr = Decod(), Decod(), [], []
for p in paquetes:
    assert p[0] == 5
    k = struct.unpack("<I", p[2:6])[0]
    if p[1] & 1:
        dl, dr = Decod(), Decod()
    if p[1] & 2:
        sl.append(np.frombuffer(p[6:6 + 2 * k], "<i2").astype(np.int32)); sr.append(np.frombuffer(p[6 + 2 * k:6 + 4 * k], "<i2").astype(np.int32))
    else:
        sl.append(dl.decode(p[6:6 + k // 2])); sr.append(dr.decode(p[6 + k // 2:6 + k]))
yl, yr = np.concatenate(sl), np.concatenate(sr)
rl, rr = (L[:len(yl)] * 32767).astype(np.int32), (R[:len(yr)] * 32767).astype(np.int32)


def snr(a, b):
    return 10 * np.log10(np.sum(a.astype(float) ** 2) / np.sum((a - b).astype(float) ** 2))


print("paquetes %d · muestras recibidas L %d R %d de %d · correlación %.2f" % (len(paquetes), len(yl), len(yr), n, np.corrcoef(rl, rr)[0, 1]))
print("calidad que llega: SNR L %.1f dB, R %.1f dB" % (snr(rl, yl), snr(rr, yr)))
