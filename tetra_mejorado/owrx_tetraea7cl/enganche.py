# tetra-mejorado (EA7CL) · enganche: al final de owrx/tetra.py cambia TetraParser por el nuestro.
# csdr/chain/tetra.py hace "from owrx.tetra import TetraParser" después, así que toma este.
import logging

logger = logging.getLogger("owrx_tetraea7cl")


def aplicar_tetra(g):
    from owrx_tetraea7cl.parser import TetraParser
    g["TetraParserOriginal"] = g.get("TetraParser")
    g["TetraParser"] = TetraParser
    logger.info("tetra-mejorado activo (TS1-TS4, datos de red, GSSI/SSI)")
