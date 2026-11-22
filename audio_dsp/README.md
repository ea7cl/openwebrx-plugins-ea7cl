# audio_dsp (v2.4 + botón IA de EA7CL)

Analizador de espectro de audio en tiempo real, ecualizador paramétrico y filtros para OpenWebRX+, con el
botón **IA** de EA7CL dentro de "Noise Reduction": reducción de ruido con la red neuronal **RNNoise**
(Jitsi rnnoise-wasm 0.2.1, 112 KB). Se ejecuta en el navegador de cada oyente: no carga el servidor.

Es la versión instalada en el servidor desde el 16-11-2026 (la "v2" de la IA).

## Archivos

| Archivo | Qué es |
|---|---|
| `audio_dsp.js`, `audio_dsp.css` | El plugin, con el botón IA |
| `rnnoise.wasm` | La red neuronal RNNoise compilada para el navegador |
| `RNNOISE-LICENSE.txt` | Su licencia (BSD) |
| `scripts/audio_dsp-install.sh` | Instalador con copia de seguridad |
| `scripts/audio_dsp-uninstall.sh` | Lo quita o vuelve a una copia |

La 2.4 sin IA sigue en el historial de git (commits anteriores a la etiqueta `audio_dsp-v2.4-ia2`).

## Importante: necesita https

El navegador solo deja usar AudioWorklet en una página segura. Por `http://IP:8073` no funcionan ni la IA
ni el NR, NB o LMS. Por `https://ea7cl-sdr.duckdns.org:8443` sí (ver la carpeta [`https/`](../https/)).

## Instalar o reinstalar

```bash
scp audio_dsp/audio_dsp.js audio_dsp/audio_dsp.css audio_dsp/rnnoise.wasm audio_dsp/RNNOISE-LICENSE.txt audio_dsp/scripts/audio_dsp-*.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/audio_dsp-install.sh'
```

- Guarda antes `init.js` y la carpeta `audio_dsp` en `/var/backups/audio_dsp/FECHA/`.
- Si `init.js` no cargaba audio_dsp, lo añade dentro del bloque de `utils` (audio_dsp necesita utils).
- Después, Ctrl+F5 en el navegador.

## Uso

1. Encender DSP ENGINE.
2. Pulsar **IA** en Noise Reduction. Se enciende en verde y la barrita de al lado marca cuándo detecta voz.
3. **Level**: cuánto ruido se quita. Con 50 % quita unos 16 dB de ruido en las pausas.
4. En CW, WFM, DAB, DRM y modos digitales se aparta sola y vuelve al NR normal. RNNoise confunde el FT8 con voz.
5. Si también está el NB, va antes que la IA.

## Desinstalar o volver atrás

```bash
ssh -t openwebrx 'sudo bash ~/audio_dsp-uninstall.sh'                                   # quitarlo
ssh -t openwebrx 'sudo bash ~/audio_dsp-uninstall.sh /var/backups/audio_dsp/FECHA'      # volver a esa copia
```

No borra nada: lo que había queda en `/home/ea7cl/desinstalado-audio_dsp-FECHA`.
