# Banco de pruebas de FM estrecha: pasa señales sintéticas por los módulos reales de pycsdr
import sys, time, threading
import numpy as np
sys.path.insert(0, "/usr/lib/python3/dist-packages")
from pycsdr.modules import Buffer
from pycsdr.types import Format

def run(chain, x, infmt, outfmt, dtype_in=np.complex64):
    """Pasa x por 'chain' (objeto con setReader/setWriter) y devuelve la salida float32."""
    inb = Buffer(infmt)
    outb = Buffer(outfmt)
    chain.setReader(inb.getReader())
    chain.setWriter(outb)
    rd = outb.getReader()
    out = []
    data = x.astype(dtype_in).tobytes()
    def feed():
        step = 1 << 16
        for i in range(0, len(data), step):
            inb.write(data[i:i+step])
            time.sleep(0.001)
    t = threading.Thread(target=feed); t.start()
    last = time.time()
    res = []
    def reader():
        while True:
            d = rd.read()
            if d is None: break
            res.append(np.frombuffer(bytes(d), dtype=np.float32).copy())
    tr = threading.Thread(target=reader, daemon=True); tr.start()
    t.join()
    n = -1
    while True:
        time.sleep(0.5)
        m = sum(len(a) for a in res)
        if m == n: break
        n = m
    chain.stop()
    return np.concatenate(res) if res else np.zeros(0, np.float32)

def fmsig(fs, dur, mod, dev_scale, cnr_db=None, bw_ruido=12500, seed=1):
    t = np.arange(int(fs*dur)) / fs
    m = mod(t)
    ph = 2*np.pi*np.cumsum(m*dev_scale)/fs
    z = np.exp(1j*ph).astype(np.complex64)
    if cnr_db is not None:
        rng = np.random.default_rng(seed)
        # ruido blanco: potencia en bw_ruido = portadora / CNR
        p = 10**(-cnr_db/10) * fs / bw_ruido
        z = z + (np.sqrt(p/2)*(rng.standard_normal(len(z)) + 1j*rng.standard_normal(len(z)))).astype(np.complex64)
    return z * 0.3

def sinad(y, fs, f0, skip=0.4):
    y = y[int(skip*fs):].astype(np.float64)
    n = len(y); t = np.arange(n)/fs
    A = np.stack([np.sin(2*np.pi*f0*t), np.cos(2*np.pi*f0*t), np.ones(n)], 1)
    c, *_ = np.linalg.lstsq(A, y, rcond=None)
    fit = A[:, :2] @ c[:2]
    res = y - fit - c[2]
    # residuo solo en banda vocal 250-3500 Hz (lo que se oye)
    R = np.fft.rfft(res * np.hanning(n)); f = np.fft.rfftfreq(n, 1/fs)
    F = np.fft.rfft(fit * np.hanning(n))
    band = (f > 250) & (f < 3500)
    pr = np.sum(np.abs(R[band])**2); ps = np.sum(np.abs(F)**2)
    return 10*np.log10(ps/pr), np.sqrt(np.mean(fit**2))*np.sqrt(2)

def nivel(y, fs, f0, skip=0.4):
    y = y[int(skip*fs):].astype(np.float64)
    n = len(y); t = np.arange(n)/fs
    A = np.stack([np.sin(2*np.pi*f0*t), np.cos(2*np.pi*f0*t)], 1)
    c, *_ = np.linalg.lstsq(A, y, rcond=None)
    return np.hypot(*c)
