# owrx-estereo (EA7CL) · FM comercial y DAB+ en estéreo real para OpenWebRX+

Probado en OpenWebRX+ **1.2.128** (Raspberry Pi 5, Debian 12).

Instalar: `sudo bash estereo_fm-install.sh` · Quitar: `sudo bash estereo_fm-uninstall.sh` · Estado: `bash owrx-estereo.sh estado`.
Cambios: [CHANGELOG.md](CHANGELOG.md).

## Qué hace

- **FM comercial (WFM):** decodifica el estéreo de la emisora como una radio: se engancha al
  piloto de 19 kHz y recupera L−R de la subportadora de 38 kHz. Separación medida con una señal
  de prueba: **119 dB**. Si la emisora no manda piloto (o la señal es floja), sale en mono.
- **DAB+:** OpenWebRX mezclaba a mono el estéreo de `dablin`; ahora llega tal cual.
- **En la página:** en la sección MODOS (a la derecha del selector de modo; si la página muestra
  los modos como botones, en una línea debajo de ellos; nunca tapa nada), un
  **botón ESTÉREO / MONO** y medidores de nivel de los canales **L** y **R**. Pulsando el botón se
  escucha en mono (letrero MONO en ámbar; se recuerda en el navegador); otra pulsación, estéreo.
  El MONO gris indica que la emisora llega sin piloto estéreo.
  Funciona por **http** y por **https** (por http el navegador no deja usar AudioWorklet y se usa
  el procesador antiguo, también de dos canales).
- El RDS, la grabación (se graba la mezcla en mono) y los demás modos siguen igual.

## Cómo se instala, se reaplica y se quita

En la máquina con OpenWebRX+ (con esta carpeta copiada):

```bash
sudo bash owrx-estereo.sh aplicar
```

```bash
sudo bash owrx-estereo.sh deshacer
```

```bash
bash owrx-estereo.sh estado
```

Al aplicar:

- se guarda copia de los archivos que se tocan en `/var/backups/owrx-estereo/<versión>/`;
- se instala el script en `/usr/local/sbin/owrx-estereo` y sus archivos en `/usr/local/share/owrx-estereo/`;
- se deja `/etc/apt/apt.conf.d/99owrx-estereo`: **tras cada actualización con apt se vuelve a
  aplicar solo** si una actualización de OpenWebRX lo hubiera borrado (y solo entonces reinicia).

No toca la configuración de OpenWebRX (`/etc/openwebrx`, `/var/lib/openwebrx`).

## Llevarlo a otro servidor (por ejemplo, un Ubuntu)

Sirve para OpenWebRX+ **instalado con apt** (paquete `openwebrx`), no para la versión en Docker.

1. Copiar esta carpeta al servidor (por ejemplo, a `/tmp/owrx-estereo`).
2. `bash owrx-estereo.sh estado` → debe decir dónde está OpenWebRX y "sin poner".
3. `sudo bash owrx-estereo.sh aplicar` → guarda copias, lo pone y reinicia OpenWebRX.
   - Si sale `AVISO: owrx/dsp.py ha cambiado`, esa versión de OpenWebRX es distinta: no se toca
     ese archivo (sin él la página no sabe que hay estéreo). Hay que revisar el ancla en el script.
4. Comprobar el registro: `journalctl -u openwebrx -n 50` sin errores `owrx_estereo`.
5. En el navegador, **Ctrl+F5**, poner una emisora de FM comercial y mirar la caja de MODOS.
6. Si algo va mal: `sudo bash owrx-estereo.sh deshacer` (lo deja como estaba).

No hace falta configurar nada: respeta `audio_compression` (ADPCM o sin comprimir) de cada servidor.

## Árbol de lo que se añade o modifica en OpenWebRX

```
/usr/lib/python3/dist-packages/            (<dist-packages>, lo busca el script)
├── owrx_estereo/                          NUEVO
│   ├── __init__.py                        versión
│   ├── fm.py                              decodificador estéreo de FM (piloto 19 kHz, L−R a 38 kHz)
│   ├── dab.py                             DAB: deja de mezclar a mono la salida de dablin
│   ├── emisor.py                          envío L/R a la página (ADPCM propio o PCM)
│   └── enganche.py                        lo que llaman los archivos modificados
├── htdocs/plugins/receiver/
│   ├── estereo_fm/                        NUEVO (complemento de la página)
│   │   ├── estereo_fm.js                  recibe L/R, botón ESTÉREO/MONO, medidores
│   │   ├── estereo_fm.css                 aspecto de la caja
│   │   └── procesador.js                  reproductor de 2 canales (AudioWorklet)
│   └── init.js                            MODIFICADO: + Plugins.load('estereo_fm')
├── csdr/chain/
│   ├── analog.py                          MODIFICADO: + 6 líneas al final (WFm → estéreo)
│   └── dablin.py                          MODIFICADO: + 6 líneas al final (Dablin → estéreo)
└── owrx/
    └── dsp.py                             MODIFICADO: + 5 líneas en setDemodulator

/usr/local/sbin/owrx-estereo               NUEVO: el script, para aplicar/deshacer/estado
/usr/local/share/owrx-estereo/             NUEVO: copia de los archivos para reaplicar
/etc/apt/apt.conf.d/99owrx-estereo         NUEVO: reaplica tras actualizar con apt
/var/backups/owrx-estereo/<versión>/       NUEVO: copia de los 4 archivos originales
```

Todas las líneas añadidas a archivos de OpenWebRX van entre las marcas
`# >>> owrx-estereo (EA7CL) >>>` y `# <<< owrx-estereo (EA7CL) <<<`.

## Qué archivos toca

| Archivo | Cambio |
|---|---|
| `<dist-packages>/owrx_estereo/` | paquete nuevo (decodificador estéreo, separador DAB, enganches) |
| `<dist-packages>/htdocs/plugins/receiver/estereo_fm/` | complemento nuevo de la página |
| `csdr/chain/analog.py` | al final, 6 líneas entre marcas `owrx-estereo`: cambia WFm por la versión estéreo |
| `csdr/chain/dablin.py` | al final, 6 líneas entre marcas: cambia Dablin por la versión estéreo |
| `owrx/dsp.py` | 5 líneas entre marcas en `setDemodulator`: avisa a la página de los canales |
| `htdocs/plugins/receiver/init.js` | una línea al final: `Plugins.load('estereo_fm')` |

## Cómo funciona por dentro

- Por el canal de audio de siempre (mensaje 4) va el **mono normal de OpenWebRX**: una página sin
  el complemento, o si algo falla, lo oye en mono como antes (nunca distorsionado).
- El estéreo va en un **mensaje aparte (tipo 5)** con L y R en el mismo paquete (siempre
  alineados) y **un compresor ADPCM para cada canal** (`owrx_estereo/emisor.py`). Al principio se
  intercalaban L,R en un solo ADPCM y eso metía "fritura" (SNR 19-21 dB con canales poco
  parecidos); por separado da 34-36 dB, igual que el mono normal.
- El compresor ADPCM es **propio y sin hilos** (desde la 1.2). El `AdpcmEncoder` de pycsdr, usado
  bloque a bloque, a veces se quedaba esperando para siempre y paraba toda la cadena de FM (el
  audio "empezaba y se cortaba"). El propio da el mismo formato y gasta ~5 % de un núcleo.
- Si OpenWebRX tiene la **compresión de audio desactivada** (`audio_compression: none`), el
  estéreo también va **sin comprimir** (PCM de 16 bits, sin ninguna pérdida; ~4 veces más datos).
- El servidor avisa a la página `{"type":"ea7cl_estereo","canales":1|2}` al cambiar de modo y lo
  repite cada 2 s. Mientras llega estéreo, la página no reproduce el mono (para no oírlo doble).
- DAB solo va en estéreo si el navegador usa 48 kHz (el remuestreador de OpenWebRX es de un
  canal); si no, se mezcla a mono en el servidor.
- Limitación: con la reducción de ruido (NR) de OpenWebRX encendida, en FM/DAB estéreo se oye
  raro (ese filtro es de un canal).
- CPU en la Pi 5: ~36 % de un núcleo con un oyente en FM estéreo.
- Pruebas incluidas: `prueba_fm.py` (separación, 119 dB), `prueba_emisor.py` (calidad del envío;
  `pcm` para sin comprimir) y `prueba_cadena.py` (la cadena WFM parcheada de OpenWebRX con una
  emisora sintética: no se atasca).
- Con un solo SDR, el perfil es de todos: si un oyente (o un complemento que recuerda el perfil)
  cambia de perfil al reconectar, cambia para todos.

## Al cambiar el complemento de la página

Los navegadores guardan en caché `estereo_fm.js`: tras actualizarlo, recargar con **Ctrl+F5**.

## DAB: cortes que no son del estéreo

Si el DAB se corta, mirar el registro: `Lock lost, resetting ringbuffer` o `FIBs with CRC mismatch`
son pérdidas de señal del desmodulador DAB de OpenWebRX (antena, ganancia), no del estéreo.
La página guarda una reserva de ~0,3 s para que la llegada a golpes del DAB no corte.

## Licencia

OpenWebRX+ es software libre con licencia **AGPL-3.0**. Como esto modifica OpenWebRX y se
ejecuta dentro de él, si se publica conviene usar también la AGPL-3.0.

## Historial

- **1.2** · Compresor ADPCM propio (el de pycsdr se colgaba y cortaba la FM). Caja siempre en
  MODOS (también con los modos en botones). Reserva de 0,3 s en la reproducción.
- **1.1** · Un ADPCM por canal (quita la "fritura"); PCM si la compresión está desactivada;
  botón ESTÉREO/MONO.
- **1.0** · Primera versión: FM y DAB en estéreo, medidores L/R, reaplicado tras apt.
