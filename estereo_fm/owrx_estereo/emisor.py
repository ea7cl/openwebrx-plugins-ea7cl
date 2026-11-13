"""Envío del estéreo a la página: L y R juntos en el mismo paquete (así nunca se desalinean), cada
canal con su propio compresor ADPCM (intercalar L,R en un solo ADPCM metía "fritura" cuando los
canales se parecen poco) o sin comprimir, si OpenWebRX tiene la compresión de audio desactivada.

El compresor es propio (aquí abajo), sin hilos: el AdpcmEncoder de pycsdr lleva su hilo y, usado
bloque a bloque, a veces se quedaba esperando para siempre y paraba toda la cadena de FM (el audio
"empezaba y se cortaba"). Da exactamente el formato IMA ADPCM que descomprime la página.

Paquete binario (mensaje de websocket):
    byte 0     0x05 (tipo nuevo; OpenWebRX usa del 1 al 4)
    byte 1     marcas: bit 0 = primer paquete (la página reinicia sus descompresores)
                       bit 1 = sin comprimir (PCM de 16 bits)
    bytes 2-5  n = muestras por canal (entero de 32 bits, little endian; siempre par)
    canal L    n/2 bytes en ADPCM IMA (sin palabras de sincronía)  ·  o 2n bytes en PCM 16 bits
    canal R    igual
El audio de siempre (mensaje 4) sigue llevando el mono normal de OpenWebRX: una página sin el
complemento lo oye en mono, como antes.
"""

import struct

import numpy as np

_INDICE = [-1, -1, -1, -1, 2, 4, 6, 8] * 2
_PASOS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80,
          88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598,
          658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
          3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289,
          16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767]


class CompresorAdpcm:
    """IMA ADPCM de un canal. Cada llamada recibe un número par de muestras y da la mitad de bytes
    (nibble bajo = primera muestra, como el de OpenWebRX)."""

    def __init__(self):
        self.pred, self.indice = 0, 0

    def comprimir(self, muestras):
        pred, si = self.pred, self.indice
        pasos, indice = _PASOS, _INDICE
        out = bytearray(len(muestras) // 2)
        k, alto, b = 0, False, 0
        for s in muestras:
            paso = pasos[si]
            d = s - pred
            if d < 0:
                n, d = 8, -d
            else:
                n = 0
            dq = paso >> 3
            if d >= paso:
                n |= 4
                d -= paso
                dq += paso
            paso >>= 1
            if d >= paso:
                n |= 2
                d -= paso
                dq += paso
            paso >>= 1
            if d >= paso:
                n |= 1
                dq += paso
            pred = pred - dq if n & 8 else pred + dq
            if pred > 32767:
                pred = 32767
            elif pred < -32768:
                pred = -32768
            si += indice[n]
            if si < 0:
                si = 0
            elif si > 88:
                si = 88
            if alto:
                out[k] = b | (n << 4)
                k += 1
                alto = False
            else:
                b, alto = n, True
        self.pred, self.indice = pred, si
        return bytes(out)


class EmisorEstereo:
    def __init__(self, enviar, comprimir=True):
        self.enviar = enviar                    # función(bytes)
        self.comprimir = comprimir
        self.canales = [CompresorAdpcm(), CompresorAdpcm()] if comprimir else []
        self.primero = True
        self.resto = None                       # muestra suelta (los bloques van de 2 en 2)

    def mandar(self, izq, der):
        """izq, der: float32 −1…1 de la misma longitud."""
        if self.resto is not None:
            izq = np.concatenate(([self.resto[0]], izq))
            der = np.concatenate(([self.resto[1]], der))
            self.resto = None
        if len(izq) % 2:
            self.resto = (izq[-1], der[-1])
            izq, der = izq[:-1], der[:-1]
        n = len(izq)
        if not n:
            return
        enteros = [np.clip(x * 32767, -32768, 32767).astype("<i2") for x in (izq, der)]
        if self.comprimir:
            partes = [c.comprimir(e.tolist()) for c, e in zip(self.canales, enteros)]
        else:
            partes = [e.tobytes() for e in enteros]
        marcas = (1 if self.primero else 0) | (0 if self.comprimir else 2)
        self.primero = False
        try:
            self.enviar(bytes([0x05, marcas]) + struct.pack("<I", n) + partes[0] + partes[1])
        except Exception:
            pass

    def parar(self):
        pass
