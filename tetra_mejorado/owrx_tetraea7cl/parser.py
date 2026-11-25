# tetra-mejorado (EA7CL) · intérprete de los datos JSON de tetrarx (dxlAPRS, OE5DXL)
#
# El original (owrx/tetra.py de OpenWebRX+ 1.2.130) solo mandaba datos con AUDIO=1, así que en
# las redes cifradas o sin conversaciones el panel quedaba vacío, y mandaba el tipo de trama (FTYP)
# que el panel enseñaba como "TS". Este:
#   · manda los datos de la red siempre (como mucho una vez por segundo, o al cambiar algo),
#   · lleva la cuenta de los 4 intervalos de tiempo TS1..TS4 (TN 0..3 de tetrarx) y marca los que
#     tienen voz,
#   · recoge GSSI (grupo), SSI, USSI y SMI, que el original no leía (salvo "ssi" con voz),
#   · pone nombre a la red (país por MCC y, si existe, /etc/openwebrx/tetra_redes.txt).
#
# Datos reales de tetrarx (grabación de 422,6 MHz en la Pi, 25-11-2026):
# {"TN":2,"FN":13,"MN":45,"CC":"214,30,3","TX":420.0250,"RX":410.0250,"Po":35,"LA":3,"VOICE":1,
#  "ENC":1,"FTYP":3,"AFC":571,"EYE":75,"dB":52.17,"len":510,"AUDIO":0}

import logging
import os
import time

logger = logging.getLogger("owrx_tetraea7cl")

INTERVALO = 1.0      # s entre envíos al navegador si nada cambia
VOZ_RETEN = 2.0      # s que un TS sigue marcado "con voz" tras su última trama de audio
IDENT_RETEN = 60.0   # s que se recuerda una identidad (SSI, GSSI...) vista
IDENT_MAX = 6        # identidades de cada tipo que se mandan, las más recientes primero
FICHERO_REDES = "/etc/openwebrx/tetra_redes.txt"   # líneas "mcc mnc texto" (opcional)
DEPURAR = False      # True: escribe cada trama en /tmp/tetra-mejorado-depurar.log (solo pruebas)
CLAVES_RED = {"TN", "FN", "MN", "CC", "TX", "RX", "Po", "LA", "VOICE", "ENC", "FTYP", "AFC",
              "EYE", "dB", "len", "AUDIO"}

PAISES = {
    202: "Grecia", 204: "Países Bajos", 206: "Bélgica", 208: "Francia", 212: "Mónaco",
    213: "Andorra", 214: "España", 222: "Italia", 228: "Suiza", 232: "Austria",
    234: "Reino Unido", 235: "Reino Unido", 238: "Dinamarca", 240: "Suecia", 242: "Noruega",
    244: "Finlandia", 260: "Polonia", 262: "Alemania", 266: "Gibraltar", 268: "Portugal",
    270: "Luxemburgo", 272: "Irlanda", 278: "Malta", 280: "Chipre", 284: "Bulgaria",
    293: "Eslovenia", 297: "Montenegro", 302: "Canadá", 310: "EE. UU.", 334: "México",
    604: "Marruecos", 603: "Argelia", 901: "Internacional",
}

# claves de tetrarx con identidades -> nombre que se manda.
# OJO: "ssi" en minúsculas NO es un abonado (en la prueba real vale 2, 4, 6...); el original de
# OpenWebRX lo enseñaba como SSI. El abonado es "SSI" en mayúsculas (con ADRTYP 1).
IDENTIDADES = (("GSSI", "gssi"), ("SSI", "ssi"), ("USSI", "ussi"), ("SMI", "smi"))
TODOS = 16777215     # 0xFFFFFF: dirección "a todos" (difusión), no es un abonado

_redes = None
_redes_mtime = None


def _leer_redes():
    global _redes, _redes_mtime
    try:
        m = os.path.getmtime(FICHERO_REDES)
    except OSError:
        _redes, _redes_mtime = {}, None
        return _redes
    if _redes is not None and m == _redes_mtime:
        return _redes
    redes = {}
    try:
        with open(FICHERO_REDES, encoding="utf-8", errors="replace") as f:
            for linea in f:
                partes = linea.strip().split(None, 2)
                if len(partes) == 3 and not partes[0].startswith("#"):
                    try:
                        redes[(int(partes[0]), int(partes[1]))] = partes[2][:60]
                    except ValueError:
                        pass
    except OSError as e:
        logger.warning("No puedo leer %s: %s", FICHERO_REDES, e)
    _redes, _redes_mtime = redes, m
    return redes


def _entero(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None


def _real(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _lista(v):
    if isinstance(v, (list, tuple)):
        valores = v
    elif isinstance(v, str):
        valores = v.replace(";", ",").split(",")
    else:
        valores = [v]
    salida = []
    for x in valores:
        n = _entero(x)
        if n is not None and 0 < n < TODOS:
            salida.append(n)
    return salida


class TetraParser(object):
    def __init__(self):
        self.frequency = 0
        self._reiniciar()

    def _reiniciar(self):
        self.red = {}
        self.senal = {}
        self.voz_ts = [0.0, 0.0, 0.0, 0.0]
        self.ultima_voz = 0.0
        self.ids = {}            # (tipo, valor) -> (momento, ts)
        self.ultimo_envio = 0.0
        self.ultima_firma = None
        self.ultimo_tn = None    # para deducir el TS de las tramas que no lo traen
        self.lineas_depurar = 0

    def setDialFrequency(self, frequency: int) -> None:
        if frequency != self.frequency:
            self._reiniciar()
        self.frequency = frequency

    def parse(self, data: dict):
        if not isinstance(data, dict) or "FTYP" not in data:
            return None
        ahora = time.monotonic()

        # TS (TN 0..3 de tetrarx). Solo lo traen las tramas de control; las de tráfico y voz no.
        # tetrarx manda una línea por ráfaga y las ráfagas van seguidas TN 0,1,2,3,0..., así que
        # a una trama sin TN le toca el siguiente al de la anterior.
        tn = _entero(data.get("TN"))
        if tn is not None and not 0 <= tn <= 3:
            tn = None
        deducido = False
        if tn is None and self.ultimo_tn is not None:
            tn = (self.ultimo_tn + 1) % 4
            deducido = True
        self.ultimo_tn = tn
        audio = _entero(data.get("AUDIO")) == 1

        if DEPURAR and self.lineas_depurar < 40000:
            self.lineas_depurar += 1
            try:
                with open("/tmp/tetra-mejorado-depurar.log", "a") as f:
                    f.write("%s TN%s %s\n" % (round(ahora, 3), "~%d" % tn if deducido else tn, data))
            except OSError:
                pass
        if audio:
            self.ultima_voz = ahora
            if tn is not None:
                self.voz_ts[tn] = ahora

        # datos de la red (llegan en las tramas de control; se guardan entre trama y trama)
        if "CC" in data:
            partes = str(data["CC"]).split(",")
            if len(partes) == 3:
                mcc, mnc, bcc = (_entero(p) for p in partes)
                if None not in (mcc, mnc, bcc):
                    self.red.update(mcc=mcc, mnc=mnc, bcc=bcc)
        for clave, nombre, conv in (("TX", "tx_mhz", _real), ("RX", "rx_mhz", _real),
                                    ("LA", "la", _entero), ("Po", "power_dbm", _entero)):
            if clave in data:
                v = conv(data[clave])
                if v is not None:
                    self.red[nombre] = v
        if "VOICE" in data:
            self.red["voice_service"] = _entero(data["VOICE"]) == 1
        if "ENC" in data:
            self.red["air_encrypted"] = _entero(data["ENC"]) == 1

        # señal
        for clave, nombre, conv in (("dB", "rfdb", _real), ("AFC", "offset", _entero),
                                    ("EYE", "eye", _entero)):
            if clave in data:
                v = conv(data[clave])
                if v is not None:
                    self.senal[nombre] = v

        # identidades
        for clave, tipo in IDENTIDADES:
            if clave in data:
                for v in _lista(data[clave]):
                    self.ids[(tipo, v)] = (ahora, tn)
        for k in [k for k, (t, _) in self.ids.items() if ahora - t > IDENT_RETEN]:
            del self.ids[k]

        # qué se manda
        out = {"mode": "TETRA", "ft": _entero(data.get("FTYP")), "tn": tn, "audio": audio}
        if self.frequency:
            out["freq"] = self.frequency
        out.update(self.red)
        out.update(self.senal)
        for k in ("FN", "MN"):
            v = _entero(data.get(k))
            if v is not None:
                out[k.lower()] = v
        if "ADRTYP" in data:
            out["adr_type"] = _entero(data["ADRTYP"])
        if "MAC" in data:
            out["mac"] = _entero(data["MAC"])

        if "mcc" in self.red:
            mcc, mnc = self.red["mcc"], self.red["mnc"]
            pais = PAISES.get(mcc)
            if pais:
                out["country"] = pais
            nombre = _leer_redes().get((mcc, mnc))
            if nombre:
                out["network"] = nombre

        out["slots"] = [1 if ahora - t < VOZ_RETEN else 0 for t in self.voz_ts]
        if self.ultima_voz:
            out["last_voice_s"] = int(ahora - self.ultima_voz)

        recientes = sorted(self.ids.items(), key=lambda kv: kv[1][0], reverse=True)
        for tipo in ("gssi", "ssi", "ussi", "smi"):
            vals = [{"id": v, "ts": ts} for (t, v), (_, ts) in recientes if t == tipo][:IDENT_MAX]
            if vals:
                out[tipo + "_list"] = vals
        # compatibilidad con el panel original: "ssi" como lista de números
        if "ssi_list" in out:
            out["ssi"] = [x["id"] for x in out["ssi_list"]]

        # se manda al cambiar algo importante o, si no, una vez por segundo
        firma = (tuple(sorted(self.red.items())), tuple(out["slots"]),
                 tuple(sorted(k for k in self.ids)))
        if firma != self.ultima_firma or ahora - self.ultimo_envio >= INTERVALO:
            self.ultima_firma = firma
            self.ultimo_envio = ahora
            return out
        return None
