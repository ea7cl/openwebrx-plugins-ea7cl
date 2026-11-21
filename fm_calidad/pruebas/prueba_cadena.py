# Prueba la ClientDemodulatorChain real con el parche (paquetes copiados en /tmp/fc-pkg)
import sys, time, threading
sys.path.insert(0, "/tmp/fc-pkg"); sys.path.insert(2, "/tmp/fmbanco")
import numpy as np
import csdr.chain.analog as an, owrx.dsp as dsp, owrx.modes as modes
print("analog de:", an.__file__)
from banco import fmsig, sinad
from pycsdr.modules import Buffer
from pycsdr.types import Format, AgcProfile
print("NFm parcheada:", getattr(an.NFm, "_fmcalidad", False), "| original guardada:", hasattr(an, "NFm_original"))
nfm = [m for m in modes.Modes.mappings if m.modulation == "nfm"][0]
print("filtro FM por defecto:", nfm.bandpass.low_cut, nfm.bandpass.high_cut)
print("filtros de digitales sobre FM:", {m.modulation: (m.get_bandpass().low_cut, m.get_bandpass().high_cut) for m in modes.Modes.mappings if isinstance(m, modes.DigitalMode) and m.underlying and m.underlying[0] == "nfm"})
class Ev:
    def __getattr__(self, n): return lambda *a, **k: None
FS = 2400000
d = an.NFm(12000, AgcProfile.SLOW)
c = dsp.ClientDemodulatorChain(d, FS, 12000, 48000, "none", False, 0, Ev())
c.setBandpass(-6000, 6000) if hasattr(c, "setBandpass") else None
c.setFrequencyOffset(0)
inb = Buffer(Format.COMPLEX_FLOAT); out = Buffer(Format.SHORT)
c.setReader(inb.getReader()); c.setWriter(out)
def estado(t): print("%-28s selector=%s ifRate=%s HQ=%s workers=%s" % (t, c.selector.outputRate, d.ifRate, d.esAltaCalidad(), [type(w).__name__ for w in d.workers]))
estado("al arrancar:")
res = []
rd = out.getReader()
threading.Thread(target=lambda: [res.append(np.frombuffer(bytes(x), np.int16).copy()) for x in iter(rd.read, None)], daemon=True).start()
x = fmsig(FS, 2.5, lambda t: np.sin(2*np.pi*1000*t), 2500).tobytes()
for i in range(0, len(x), 1 << 16): inb.write(x[i:i+(1 << 16)]); time.sleep(0.002)
time.sleep(1.5)
y = np.concatenate(res).astype(np.float32) / 32768
print("audio: %d muestras (%.2f s a 12 kHz), SINAD %.1f dB" % (len(y), len(y)/12000, sinad(y, 12000, 1000, skip=1.0)[0]))
# con un decodificador secundario (ej. packet): debe volver a la cadena original a su velocidad
from csdr.chain.demodulator import SecondaryDemodulator, FixedAudioRateChain
from pycsdr.modules import Limit
def falso(r):
    class Falso(SecondaryDemodulator, FixedAudioRateChain):
        def __init__(self): super().__init__([Limit(Format.FLOAT)])
        def getFixedAudioRate(self): return r
    return Falso()
c.setSecondaryDemodulator(falso(48000)); estado("con decod. a 48000:")
c.setSecondaryDemodulator(falso(12000)); estado("con decod. a 12000:")
c.setSecondaryDemodulator(None); estado("sin packet:")
c.setOutputRate(11025); estado("oyente a 11025:")
c.setOutputRate(12000); estado("oyente a 12000:")
c.setDemodulator(an.Am() if hasattr(an, "Am") else None); print("en AM: selector", c.selector.outputRate)
d2 = an.NFm(12000); c.setDemodulator(d2); d = d2; estado("vuelta a FM:")
c.stop(); print("OK")
