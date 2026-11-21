# fm-calidad (EA7CL) · enganches que llaman las líneas añadidas a analog.py, dsp.py y modes.py
import logging

logger = logging.getLogger("owrx_fmcalidad")


def aplicar_analog(g):
    """Al final de csdr/chain/analog.py: cambia NFm por la versión de alta calidad."""
    from owrx_fmcalidad.nfm import crear_clase
    if getattr(g["NFm"], "_fmcalidad", False):
        return
    g["NFm_original"] = g["NFm"]
    g["NFm"] = crear_clase(g["NFm"])


def _es_hq(demod):
    return getattr(demod, "_fmcalidad", False)


def aplicar_dsp(g):
    """Al final de owrx/dsp.py: el selector entrega 48 kHz a la NFm de cada oyente
    cuando no hay decodificador secundario."""
    from owrx_fmcalidad.nfm import IF_HQ
    C = g["ClientDemodulatorChain"]
    if getattr(C, "_fmcalidad", False):
        return
    C._fmcalidad = True
    orig_sel = C._getSelectorOutputRate

    def _getSelectorOutputRate(self):
        if _es_hq(self.demodulator) and self.secondaryDemodulator is None:
            return IF_HQ
        return orig_sel(self)

    def _sincronizar(self):
        d = self.demodulator
        if not _es_hq(d) or getattr(self, "selector", None) is None:
            return
        rate = self._getSelectorOutputRate()
        self.selector.setOutputRate(rate)
        d.setIfRate(rate)

    def envolver(nombre, antes=None):
        orig = getattr(C, nombre)

        def f(self, *a, **k):
            if antes is not None:
                try:
                    antes(self, *a, **k)
                except Exception:
                    logger.exception("fm-calidad: antes de %s", nombre)
            r = orig(self, *a, **k)
            try:
                _sincronizar(self)
            except Exception:
                logger.exception("fm-calidad: %s", nombre)
            return r
        f.__name__ = nombre
        setattr(C, nombre, f)

    def antes_demod(self, demodulator, *a, **k):
        # la NFm nueva ya entra en alta calidad, para no oír un instante la cadena vieja a 48 kHz
        if _es_hq(demodulator) and self.secondaryDemodulator is None:
            demodulator.setIfRate(IF_HQ)

    C._getSelectorOutputRate = _getSelectorOutputRate
    envolver("__init__")
    envolver("setDemodulator", antes_demod)
    envolver("setSecondaryDemodulator")
    envolver("_updateDemodulatorOutputRate")


def aplicar_modes(g):
    """Al final de owrx/modes.py: filtro FM por defecto de ±6 kHz (antes ±4 kHz).
    Los modos digitales que heredaban el de la FM se quedan con el de antes."""
    Modes, Bandpass, DigitalMode = g["Modes"], g["Bandpass"], g["DigitalMode"]
    nfm = [m for m in Modes.mappings if m.modulation == "nfm" and not isinstance(m, DigitalMode)]
    if not nfm or getattr(nfm[0], "_fmcalidad", False):
        return
    viejo = nfm[0].bandpass
    for m in Modes.mappings:
        if isinstance(m, DigitalMode) and m.bandpass is None and getattr(m, "underlying", None) \
                and m.underlying[0] == "nfm":
            m.bandpass = viejo
    nfm[0].bandpass = Bandpass(-6000, 6000)
    nfm[0]._fmcalidad = True
