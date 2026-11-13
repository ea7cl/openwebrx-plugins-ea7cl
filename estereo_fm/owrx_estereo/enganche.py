"""Enganches que llaman los archivos de OpenWebRX parcheados por owrx-estereo.sh."""

import json
import logging
import threading
import time

logger = logging.getLogger("owrx_estereo")


def aplicar_analog(g):
    """Al final de csdr/chain/analog.py: cambia WFm por la versión estéreo."""
    if "BaseWFm" in g or "BCFm" in g:
        # OpenWebRX+ 1.2.130 o posterior: otra cadena de FM (y ya trae el modo BCFM estéreo).
        # Esta versión no sabe engancharse ahí: se deja la FM original intacta.
        logger.warning("owrx-estereo: esta versión de OpenWebRX tiene otra cadena de FM; no se toca")
        return
    from .fm import clase_wfm
    g["WFm"] = clase_wfm(g["WFm"])


def aplicar_dablin(g):
    """Al final de csdr/chain/dablin.py: cambia Dablin por la versión estéreo."""
    from .dab import clase_dablin
    g["Dablin"] = clase_dablin(g["Dablin"])


def avisar(dsp, demodulator):
    """En DspManager.setDemodulator (owrx/dsp.py): conecta la salida estéreo del modo (FM, DAB)
    con la página del oyente y le dice cuántos canales van.
    DAB solo va en estéreo si el oyente usa la misma frecuencia que da dablin."""
    canales = getattr(demodulator, "canales_estereo", 1)
    try:
        if canales == 2 and hasattr(demodulator, "poner_mono"):
            hd = int(dsp.props["hd_output_rate"])
            dab = int(dsp.props["dab_output_rate"])
            if hd != dab:
                demodulator.poner_mono()
                canales = 1
    except Exception as e:
        logger.debug("owrx-estereo: %s", e)
    if canales == 2 and hasattr(demodulator, "poner_salida_estereo"):
        def enviar(datos, dsp=dsp):
            if _abierta(dsp):
                dsp.handler.send(datos)
        try:
            comprimir = dsp.props["audio_compression"] != "none"    # como tenga OpenWebRX el audio
        except Exception:
            comprimir = True
        demodulator.poner_salida_estereo(enviar, comprimir)
    dsp._oe_canales = canales
    _mandar(dsp)
    # se repite cada 2 s: así la página lo sabe aunque se cargue después
    if not getattr(dsp, "_oe_hilo", None):
        dsp._oe_hilo = threading.Thread(target=_repetir, args=(dsp,), daemon=True, name="owrx_estereo")
        dsp._oe_hilo.start()


def _abierta(dsp):
    conn = getattr(dsp.handler, "conn", None)
    return conn is None or getattr(conn, "open", True)


def _mandar(dsp):
    if not _abierta(dsp):
        return False
    try:
        dsp.handler.send(json.dumps({"type": "ea7cl_estereo", "canales": dsp._oe_canales}))
        return True
    except Exception:
        return False


def _repetir(dsp):
    while True:
        time.sleep(2)
        if not _mandar(dsp):          # el oyente se ha ido: se acaba el hilo
            dsp._oe_hilo = None
            return
