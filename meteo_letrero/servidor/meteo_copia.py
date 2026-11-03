#!/usr/bin/env python3
# EA7CL: cada minuto lee en la Raspberry el pie de foto que ya genera weewx
# (piedefoto.txt, el mismo que se pone en la foto de la camara), saca los
# valores y los deja en la carpeta del plugin meteo_letrero de OpenWebRX+.
# En la Raspberry no se toca nada: solo se lee ese archivo por la red local.
import json, os, re, time, urllib.request

ORIGENES = ['http://192.168.1.128/piedefoto.txt',
            'http://192.168.1.128/weewx/piedefoto.txt']
DESTINO = '/usr/lib/python3/dist-packages/htdocs/plugins/receiver/meteo_letrero/datos.json'


def leer():
    for url in ORIGENES:
        try:
            with urllib.request.urlopen(url + '?t=%d' % time.time(), timeout=10) as r:
                b = r.read()
            try:
                return b.decode('utf-8')
            except UnicodeDecodeError:
                return b.decode('latin-1')
        except Exception:
            continue
    return None


def num(rx, t):
    m = re.search(rx, t, re.I)
    return m.group(1).strip() if m else ''


def main():
    t = leer()
    if not t:
        return
    # el texto va entre comillas: text 0, 0 "..."
    m = re.search(r'"(.*)"', t, re.S)
    texto = ' '.join((m.group(1) if m else t).split())
    datos = {
        'texto': texto,
        'temp': num(r'Temp\.?:\s*(-?[\d.,]+)', texto),
        'hum': num(r'Hum\.?:\s*([\d.,]+)', texto),
        'viento': num(r'Viento:\s*([\d.,]+)', texto),
        'dir': num(r'Viento:[^,]*?-\s*([A-Za-z]{1,3})\b', texto),
        'lluvia': num(r'Lluvia hoy:\s*([\d.,]+)', texto),
        'uv': num(r'UV:\s*([\d.,]+)', texto),
        'racha': num(r'Racha[^:]*:\s*([\d.,]+)', texto),
        'racha_hora': num(r'Racha[^,]*?(\d{1,2}:\d{2})', texto),
        'hora': num(r'\b(\d{1,2}:\d{2})(?::\d{2})?\b', texto),
        'copiado': int(time.time()),
    }
    tmp = DESTINO + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False)
    os.chmod(tmp, 0o644)
    os.replace(tmp, DESTINO)


if __name__ == '__main__':
    main()
