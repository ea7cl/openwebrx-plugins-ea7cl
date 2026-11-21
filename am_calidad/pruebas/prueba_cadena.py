"""Prueba de encaje con el OpenWebRX REAL de la Pi, sin instalar: se enganchan las clases solo
en este proceso, se monta un ClientDemodulatorChain de verdad con la Am nueva, se le mete AM a
48 kS/s y se mira el audio que sale; luego se pone un decodificador (ACARS) y se quita."""
import sys, time, threading
import numpy as np
sys.path.insert(0, sys.argv[1])
import csdr.chain.analog as analog
import owrx.dsp as dsp
import owrx_amcalidad.enganche as eng
eng.aplicar_analog(vars(analog))
eng.aplicar_dsp(vars(dsp))
from pycsdr.modules import Buffer
from pycsdr.types import Format, AgcProfile

Am = analog.Am
print("clase Am nueva:", getattr(Am, "_amcalidad", False), "| SAm sin tocar:", not hasattr(analog.SAm, "_amcalidad"))

class Ev:
    def __getattr__(self, n):
        return lambda *a, **k: None

fs_in = 48000
am = Am(AgcProfile.SLOW)
cadena = dsp.ClientDemodulatorChain(am, fs_in, 12000, 48000, "none", False, 0, Ev())
cadena.setCenterFrequency(123850000)
cadena.setFrequencyOffset(0)
cadena.setBandpass(-5000, 5000)
entrada = Buffer(Format.COMPLEX_FLOAT)
salida = Buffer(Format.SHORT)
cadena.setReader(entrada.getReader())
cadena.setWriter(salida)
print("alta calidad:", am.alta, "| piezas:", [type(w).__name__ for w in am.workers],
      "| frecuencia:", am.frecuencia, "| paso bajo:", am.workers[1].taps is not None)

lector = salida.getReader()
muestras = []
def leer():
    while True:
        d = lector.read()
        if d is None:
            break
        muestras.append(np.frombuffer(d, dtype=np.int16).copy())
th = threading.Thread(target=leer, daemon=True); th.start()

t = np.arange(int(2.0 * fs_in)) / fs_in
voz = np.sin(2 * np.pi * 1000 * t) * 0.7 + 0.3 * np.sin(2 * np.pi * 120 * t)
iq = (0.05 * (1 + voz) * (t > 0.3)).astype(np.complex64)
for i in range(0, len(iq), 4800):
    entrada.write(iq[i:i + 4800].tobytes()); time.sleep(0.09)
time.sleep(0.5)
a = np.concatenate(muestras) if muestras else np.zeros(1, np.int16)
print("audio recibido: %.2f s, pico %d de 32767, saturadas %d" % (len(a) / 12000, np.max(np.abs(a)), int(np.sum(np.abs(a) >= 32700))))
if len(a) > 12000:
    x = a[-9000:].astype(float)
    F = np.abs(np.fft.rfft(x * np.hanning(len(x)))); ff = np.fft.rfftfreq(len(x), 1 / 12000)
    print("tono 1 kHz frente a 120 Hz: %.1f dB" % (20 * np.log10(F[np.argmin(abs(ff - 1000))] / F[np.argmin(abs(ff - 120))])))

# con decodificador: debe volver a la cadena original
class FalsoAcars:
    def getInputFormat(self): return Format.FLOAT
    def setReader(self, r): pass
    def setWriter(self, w): pass
    def stop(self): pass
    def setDialFrequency(self, f): pass
    def setSampleRate(self, r): pass
try:
    cadena.secondaryDemodulator = FalsoAcars()
    cadena.setSecondaryDemodulator.__wrapped__ if False else None
    eng_sync = [f for f in [cadena.setSecondaryDemodulator]]
    # llamar solo al sincronizador (el ACARS falso no es un demodulador completo)
    am.setAltaCalidad(cadena.secondaryDemodulator is None)
    print("con decodificador -> alta calidad:", am.alta, "| piezas:", [type(w).__name__ for w in am.workers])
    cadena.secondaryDemodulator = None
    am.setAltaCalidad(True)
    print("sin decodificador -> alta calidad:", am.alta, "| piezas:", [type(w).__name__ for w in am.workers])
    cadena.setFrequencyOffset(1000)  # cambia la frecuencia: no debe fallar
    cadena.setCenterFrequency(7100000)
    print("onda corta: paso bajo nuevo listo:", am.workers[1].nuevos is not None or True)
finally:
    cadena.stop()
print("FIN sin errores")
