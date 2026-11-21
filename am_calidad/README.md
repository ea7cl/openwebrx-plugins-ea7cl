# am_calidad (am-calidad) · AM con mejor sonido en OpenWebRX+

Versión 1.0 (21-11-2026). Probada en OpenWebRX+ 1.2.130 e instalada en el receptor de EA7CL.
**No es un plugin de la web** (no va en `init.js`): cambia el procesado de audio del servidor.
La SAM no se toca. Convive con [`fm_calidad`](../fm_calidad/) (cada una pone su propio bloque de enganche).

## Qué fallaba en la AM original

OpenWebRX+ hace la AM así: `demodulador AM → quitar continua (DcBlock) → AGC "Slow"`.

- **Golpe al abrir el squelch**: con el squelch cerrado el AGC se queda con la ganancia alta; cuando
  entra una portadora fuerte tarda en bajarla y los primeros milisegundos saturan (medido en
  Airband 123,85 MHz: 1,6 % de muestras saturadas en una grabación).
- **Graves**: no hay filtro de audio; 50–300 Hz llegan casi al nivel de la voz.
- **Continua**: DcBlock tarda en quitar el escalón de la portadora al abrir.

## Qué hace

En la cadena de cada oyente **sin decodificador**:

```
demodulador AM → AudioAm:
   AGC por portadora (mide la portadora del mismo tramo que va a sacar: baja en el acto)
   → paso banda 250 Hz – paso bajo según la frecuencia → limitador blando (desde 0,6, tope 0,75)
   → quitacontinua lento (1 s)
```

| Frecuencia sintonizada              | Paso bajo |
|-------------------------------------|----------:|
| 30 MHz o más (Airband, VHF/UHF)     | 3500 Hz   |
| 1,8 – 30 MHz (onda corta)           | 4500 Hz   |
| menos de 1,8 MHz (onda media/larga) | 5000 Hz   |

- El AGC sigue a la **portadora**, no a la voz: no "bombea" con las palabras y, con desvanecimientos
  de onda corta, recupera la ganancia con una constante de 0,3 s (tope de ganancia 50000).
- Con un decodificador (ACARS…) y en los servicios de fondo se usa la cadena original **tal cual**.
- Los números están al principio de `owrx_amcalidad/am.py` (PASO_ALTO, PASO_BAJO, NIVEL…);
  `DEPURAR = True` apunta cada 5 s en el registro el pico, la continua y la ganancia.

## Medidas

Banco con la cadena original real de csdr frente a la nueva, señal sintética: squelch cerrado →
portadora fuerte que abre de golpe con voz al 80 % y graves de 120 Hz al 40 %; luego portadora
débil (1/50) y portadora con desvanecimiento.

|                                | Original       | am-calidad        |
|--------------------------------|---------------:|------------------:|
| Muestras saturadas             | 432            | **0**             |
| … en los 100 ms tras abrir     | 408            | **0**             |
| Pico máximo                    | 0 dBFS         | −2,5 dBFS         |
| Voz frente a graves 50–300 Hz  | −6 dB          | **+30 a +40 dB**  |
| Voz, portadora fuerte / débil  | −10 / −21 dBFS | −18 / −18 dBFS    |
| CPU                            | —              | 0,4 % de un núcleo de una Raspberry Pi 5 |

En vivo en la Pi (onda media, señal muy débil): picos de 0,79 como mucho, continua media 0,000 y
cambios AM → SAM → AM sin errores.

## Instalar y quitar

Copiar la carpeta `am_calidad/` al servidor y:

```
sudo bash am_calidad-install.sh      # = am-calidad.sh aplicar: copia de seguridad + parche + reinicio
sudo bash am_calidad-uninstall.sh    # = am-calidad.sh deshacer: lo deja como estaba (byte a byte)
bash am-calidad.sh estado
```

- Copias de seguridad: `/var/backups/owrx-amcalidad/<versión de OpenWebRX>/`.
- Se instala en `/usr/local/sbin/am-calidad` y deja `/etc/apt/apt.conf.d/99owrx-amcalidad` para
  reaplicarse sola tras actualizar paquetes, pero **solo en versiones probadas** (`PROBADAS` en
  `am-calidad.sh`; `aplicar --forzar` para probar en otra, bajo tu responsabilidad).
- No toca la configuración de OpenWebRX (`/etc/openwebrx`, `/var/lib/openwebrx`) ni la web.
- Con `copia_owrx`, `lib-owrx.sh` guarda también `owrx_amcalidad/` entre los archivos propios.

## Archivos que toca

- añade `<dist-packages>/owrx_amcalidad/` (`am.py` = audio nuevo, `enganche.py` = enganches)
- unas líneas entre marcas `am-calidad (EA7CL)` al final de `csdr/chain/analog.py` y `owrx/dsp.py`

Si el enganche falla al arrancar, OpenWebRX sigue con la AM original y deja un aviso en el registro.

## Pruebas

- `pruebas/banco.py <carpeta con owrx_amcalidad>`: compara la cadena original de csdr con la nueva.
- `pruebas/prueba_cadena.py <carpeta con owrx_amcalidad>`: monta una `ClientDemodulatorChain` real
  con la Am nueva enganchada solo en ese proceso (no toca lo instalado) y comprueba que con
  decodificador vuelve a la cadena original.
