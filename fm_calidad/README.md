# fm_calidad (fm-calidad) · FM de V-UHF con mejor sonido en OpenWebRX+

Versión 1.0 (21-11-2026). Probada en OpenWebRX+ 1.2.130 e instalada en el receptor de EA7CL.

## Qué fallaba en la FM original

OpenWebRX+ demodula la FM estrecha (modo FM/NFM) a la misma velocidad que el audio del oyente,
**12 kHz**. Eso obliga a:

- recortar el canal a ±4 kHz (por defecto) o, como mucho, a ±6 kHz. Una FM con 2,5–5 kHz de
  desviación ocupa más, así que se deforma, sobre todo en los agudos y con 5 kHz (canales de 25 kHz);
- usar un AGC que cambia la ganancia muestra a muestra y mete distorsión (hasta un 10 %).

SDR#, SDR Console u OndaWebSDR demodulan a 32–48 kHz o más. Esa es la diferencia que se oye.

## Qué hace

En la cadena de cada oyente **sin decodificador digital**:

```
selector a 48 kHz → demodulador FM (atan2) → de-énfasis NFM a 48 kHz → 48k→12k
→ paso banda 200–4000 Hz (quita CTCSS y soplido) → nivelador suave → limitador blando
```

- El oyente recibe el mismo audio de 12 kHz de antes: **no gasta más ancho de banda de red**.
- Filtro FM por defecto ±6 kHz (antes ±4 kHz); en la web se puede abrir hasta ±12,5 kHz
  (antes ±6 kHz), útil en canales de 25 kHz (marina, repetidores con 5 kHz de desviación).
- Con un decodificador (packet, POCSAG, AIS, radiosondas…) y en los servicios de fondo se usa la
  cadena original **tal cual**, con sus velocidades y filtros de siempre.
- Los modos digitales que heredaban el filtro de la FM (selcall, zvei, eas) conservan ±4 kHz.

## Medidas

Banco de pruebas con los módulos reales de csdr y señal sintética. SINAD en dB (más alto = más
limpio). Original con filtro ±4 kHz; nueva con ±6 kHz.

| Señal                              | Original | Nueva |
|------------------------------------|---------:|------:|
| 1 kHz, desviación 2,5 kHz, limpia  | 33       | 97    |
| 500 Hz, desviación 2,5 kHz         | 45       | 76    |
| 1 kHz, desviación 1 kHz            | 59 (20 mientras se ajusta el AGC) | 91 |
| 1 kHz, desviación 5 kHz            | 31       | 39 (56 con filtro ±8 kHz) |
| 2,5 kHz, desviación 4 kHz          | 33       | 132   |
| 1 kHz, desv. 5 kHz, CNR 15 dB      | **10,5** | **31** |
| 1 kHz, desv. 2,5 kHz, CNR 10 dB    | 20       | 20    |

Con señal muy débil (solo ruido) las dos son iguales: ahí manda el ruido, no la cadena.
CTCSS de 88,5 Hz: −43 dB en la original, −66 dB en la nueva.
CPU: alrededor del 1 % de un núcleo de una Raspberry Pi 5 más por cada oyente en FM.

## Instalar y quitar

Copiar la carpeta `fm_calidad/` al servidor y:

```
sudo bash fm_calidad-install.sh      # = fm-calidad.sh aplicar: copia de seguridad + parche + reinicio
sudo bash fm_calidad-uninstall.sh    # = fm-calidad.sh deshacer: lo deja como estaba (byte a byte)
bash fm-calidad.sh estado
```

- Copias de seguridad: `/var/backups/owrx-fmcalidad/<versión de OpenWebRX>/`.
- Se instala en `/usr/local/sbin/fm-calidad` y deja `/etc/apt/apt.conf.d/99owrx-fmcalidad` para
  reaplicarse sola tras actualizar paquetes, pero **solo en versiones probadas** (`PROBADAS` en
  `fm-calidad.sh`; `aplicar --forzar` para probar en otra, bajo tu responsabilidad).
- No toca la configuración de OpenWebRX (`/etc/openwebrx`, `/var/lib/openwebrx`).
- Convive con `estereo_fm` (marcas distintas; en 1.2.130 owrx-estereo solo toca `dablin.py`).
- Con `copia_owrx`, `lib-owrx.sh` guarda también `owrx_fmcalidad/` entre los archivos propios.
- Después de instalar, Ctrl+F5 en el navegador (cambia `Demodulator.js`).

## Archivos que toca

- añade `<dist-packages>/owrx_fmcalidad/` (`nfm.py` = cadena nueva, `enganche.py` = enganches)
- unas líneas entre marcas `fm-calidad (EA7CL)` al final de `csdr/chain/analog.py`,
  `owrx/dsp.py` y `owrx/modes.py`
- un `case 'nfm'` entre marcas en `htdocs/lib/Demodulator.js` (ancho máximo del filtro)

Si el enganche falla al arrancar, OpenWebRX sigue con la FM original y deja un aviso en el registro.

## Pruebas

`pruebas/banco.py` genera señales FM y las pasa por módulos de pycsdr; `pruebas/prueba_cadena.py`
prueba la `ClientDemodulatorChain` real de OpenWebRX con el parche, sin tocar lo instalado. Para
usarla, copiar `owrx`, `csdr` y `htdocs/lib/Demodulator.js` de dist-packages y `owrx_fmcalidad/` a
`/tmp/fc-pkg`, aplicar allí los parches y dejar `banco.py` en `/tmp/fmbanco`.
