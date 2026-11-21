"""Banco AM: cadena ORIGINAL real de csdr (AmDemod -> DcBlock -> Agc Slow, ganancia inicial 200)
frente a la nueva (AmDemod real -> AudioAm de am-calidad). Señal sintetica a 12 kHz:
  0-1 s   squelch cerrado (ceros)
  1-3,5 s portadora FUERTE que abre de golpe, voz al 80 % + graves de 120 Hz al 40 %
  3,5-4 s portadora sola
  4-5 s   squelch cerrado
  5-7 s   portadora DEBIL (1/50), voz al 80 %
  7-8 s   portadora media con desvanecimiento lento (onda corta)."""
import sys, time, threading
import numpy as np
sys.path.insert(0, sys.argv[1])
from pycsdr.modules import AmDemod, DcBlock, Agc, Buffer
from pycsdr.types import Format, AgcProfile
from owrx_amcalidad.am import AudioAm

fs = 12000
T = 8.0
n = int(T * fs)
t = np.arange(n) / fs
rng = np.random.default_rng(3)
r = rng.standard_normal(n)
S = np.fft.rfft(r); f = np.fft.rfftfreq(n, 1 / fs)
S[(f < 300) | (f > 3000)] = 0
voz = np.fft.irfft(S, n); voz /= np.max(np.abs(voz))
silabas = 0.3 + 0.7 * np.abs(np.sin(2 * np.pi * 3.1 * t))
m = 0.8 * voz * silabas + 0.4 * np.sin(2 * np.pi * 120 * t)
m = np.clip(m, -1, 3)
A = np.zeros(n)
A[(t >= 1) & (t < 4)] = 0.05
A[(t >= 5) & (t < 7)] = 0.001
seg = (t >= 7)
A[seg] = 0.01 * (0.55 + 0.45 * np.sin(2 * np.pi * 0.7 * t[seg]))
mod = np.where((t >= 3.5) & (t < 4), 0, m)
iq = A * (1 + mod) * np.exp(1j * 2 * np.pi * rng.random())
iq = iq + (A > 0) * 0.00005 * (rng.standard_normal(n) + 1j * rng.standard_normal(n))
iq = iq.astype(np.complex64)
cerrado = A == 0
iq[cerrado] = 0

def tuberia(modulos, datos, n_salida):
    entrada = Buffer(Format.COMPLEX_FLOAT)
    actual = entrada
    bufs = []
    for mo in modulos:
        mo.setReader(actual.getReader())
        b = Buffer(mo.getOutputFormat()); mo.setWriter(b); bufs.append(b); actual = b
    lector = actual.getReader()
    salida = []; total = [0]
    def leer():
        while total[0] < n_salida:
            d = lector.read()
            if d is None: break
            a = np.frombuffer(d, dtype=np.float32).copy(); salida.append(a); total[0] += len(a)
    th = threading.Thread(target=leer); th.start()
    for i in range(0, len(datos), 1024):
        entrada.write(datos[i:i + 1024].tobytes())
    # relleno para vaciar los retardos internos
    entrada.write(np.zeros(4096, dtype=np.complex64).tobytes())
    th.join(20)
    for mo in modulos: mo.stop()
    return np.concatenate(salida)[:n_salida]

agc = Agc(Format.FLOAT); agc.setProfile(AgcProfile.SLOW); agc.setInitialGain(200)
orig = tuberia([AmDemod(), DcBlock(), agc], iq, n)
env = tuberia([AmDemod()], iq, n)
A2 = AudioAm.__new__(AudioAm)
try:
    AudioAm.__init__(A2, fs, 123850000)
except Exception:
    pass
t0 = time.perf_counter()
nueva = np.concatenate([A2.procesar(env[i:i + 1024].copy()) for i in range(0, len(env), 1024)])
cpu = (time.perf_counter() - t0) / T

def informe(nombre, o, cpu=None):
    s16 = np.clip(np.round(o * 32767), -32768, 32767)
    sat = np.abs(s16) >= 32700
    def tramo(a, b):
        return o[int(a * fs):int(b * fs)]
    def espectro(x):
        F = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; ff = np.fft.rfftfreq(len(x), 1 / fs)
        g = np.sum(F[(ff >= 50) & (ff < 300)]); v = np.sum(F[(ff >= 300) & (ff <= 3500)])
        return 10 * np.log10(v / max(g, 1e-30))
    golpe = tramo(1.0, 1.1)
    print("%s" % nombre)
    print("   saturadas: total %d (%.2f %%), en los 100 ms tras abrir: %d" %
          (sat.sum(), 100 * sat.mean(), int(np.sum(np.abs(np.clip(np.round(golpe * 32767), -32768, 32767)) >= 32700))))
    print("   pico %.3f (%.1f dBFS)   continua media en voz fuerte %.4f" %
          (np.max(np.abs(o)), 20 * np.log10(np.max(np.abs(o)) + 1e-12), np.mean(tramo(1.5, 3.5))))
    for (a, b, txt) in [(1.5, 3.5, "fuerte"), (5.3, 7.0, "debil"), (7.0, 8.0, "desvanec.")]:
        x = tramo(a, b)
        print("   %-9s voz rms %6.1f dBFS   voz/graves(50-300) %5.1f dB" %
              (txt, 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12), espectro(x)))
    if cpu is not None:
        print("   CPU %.1f %% de un nucleo" % (100 * cpu))

informe("ORIGINAL (csdr real)", orig)
informe("NUEVA am-calidad", nueva, cpu)
