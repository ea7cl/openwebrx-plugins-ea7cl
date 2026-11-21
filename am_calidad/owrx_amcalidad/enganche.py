# am-calidad (EA7CL) · enganches que llaman las líneas añadidas a analog.py y dsp.py
import logging

logger = logging.getLogger("owrx_amcalidad")


def aplicar_analog(g):
    """Al final de csdr/chain/analog.py: cambia Am por la versión nueva (la SAm no se toca)."""
    from owrx_amcalidad.am import crear_clase
    if getattr(g["Am"], "_amcalidad", False):
        return
    g["Am_original"] = g["Am"]
    g["Am"] = crear_clase(g["Am"])


def aplicar_dsp(g):
    """Al final de owrx/dsp.py: la Am de cada oyente usa el audio nuevo si no hay decodificador."""
    C = g["ClientDemodulatorChain"]
    if getattr(C, "_amcalidad", False):
        return
    C._amcalidad = True

    def _sincronizar(self):
        d = getattr(self, "demodulator", None)
        if d is None or not getattr(d, "_amcalidad", False):
            return
        d.setAltaCalidad(self.secondaryDemodulator is None)

    def envolver(nombre):
        orig = getattr(C, nombre)

        def f(self, *a, **k):
            r = orig(self, *a, **k)
            try:
                _sincronizar(self)
            except Exception:
                logger.exception("am-calidad: %s", nombre)
            return r
        f.__name__ = nombre
        setattr(C, nombre, f)

    envolver("__init__")
    envolver("setDemodulator")
    envolver("setSecondaryDemodulator")
