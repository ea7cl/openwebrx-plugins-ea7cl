# openwebrx-plugins-ea7cl

Desarrollos para el receptor OpenWebRX+ de EA7CL (Málaga). Cada desarrollo va en su carpeta.

| Carpeta | Qué es | Versión |
|---|---|---|
| [`autozoom/`](autozoom/) | Zoom automático del waterfall centrado en la frecuencia sintonizada, con botón AZ. | ver [CHANGELOG](autozoom/CHANGELOG.md) |
| [`botones_ea7cl/`](botones_ea7cl/) | Aspecto común, estilo LED, para todos los botones de la columna de plugins (AZ, DOP, LST…). | ver [CHANGELOG](botones_ea7cl/CHANGELOG.md) |
| [`listeners/`](listeners/) | LST: oyentes en directo (plugin de 0xAF) con las modificaciones EA7CL. | ver [CHANGELOG](listeners/CHANGELOG.md) |
| [`contador/`](contador/) | Contador de visitas propio (visitas, únicos y países) en la cabecera, sin servicios externos. Instalación genérica para cualquier OpenWebRX+ en su [README](contador/README.md). | ver [CHANGELOG](contador/CHANGELOG.md) |
| [`scan_recordado/`](scan_recordado/) | Botón MEM: cada oyente elige qué memorias ve y cuáles entran en el SCAN, y se recuerda al volver a abrir el SDR. | ver [CHANGELOG](scan_recordado/CHANGELOG.md) |
| [`meshtastic_narrow/`](meshtastic_narrow/) | Modo Meshtastic Narrow (62,5 kHz, SF7-9) para la red SFNarrow de 869,618 MHz, junto al Meshtastic normal: mensajes en su panel y nodos en el mapa. | ver [CHANGELOG](meshtastic_narrow/CHANGELOG.md) |
| [`rig_skin_es/`](rig_skin_es/) | Traduce al español los textos de rig_skin. | ver [CHANGELOG](rig_skin_es/CHANGELOG.md) |
| [`rig_colores_ea7cl/`](rig_colores_ea7cl/) | Colores y tamaños de letra propios del aspecto rig_skin. | ver [CHANGELOG](rig_colores_ea7cl/CHANGELOG.md) |
| [`rig_volumen_ea7cl/`](rig_volumen_ea7cl/) | Todo el volumen del receptor: barra VOL en el frontal de rig_skin, MUTE sin mover las barras y rueda del ratón. | ver [CHANGELOG](rig_volumen_ea7cl/CHANGELOG.md) |
| [`rig_fil_ea7cl/`](rig_fil_ea7cl/) | Letreros FIL y TS del panel rig como botones con desplegable (anchos, restaurar filtro, pasos). | ver [CHANGELOG](rig_fil_ea7cl/CHANGELOG.md) |
| [`scan_pausa_ea7cl/`](scan_pausa_ea7cl/) | El SCAN se para solo 5 s en cada memoria con señal y sigue con la siguiente. | ver [CHANGELOG](scan_pausa_ea7cl/CHANGELOG.md) |
| [`rig_dx_spotter/`](rig_dx_spotter/) | Mejoras de la ventana DX CLUSTER: quién anuncia, filtro Europa, banda, comentarios y colores por modo. | ver [CHANGELOG](rig_dx_spotter/CHANGELOG.md) |
| [`doppler_autostart/`](doppler_autostart/) | Doppler automático: elegir un satélite en SAT, en la pantalla de pases del panel o en DOP lo sintoniza y lo sigue; botón DOP encendido; TRACK sin enganches. | ver [CHANGELOG](doppler_autostart/CHANGELOG.md) |
| [`doble_receptor/`](doble_receptor/) | Doble receptor MAIN / SUB en pantalla dividida, sobre el mismo SDR. Con modos: solo con enlace `?dual` (el instalado), para todos o apagado. | ver [CHANGELOG](doble_receptor/CHANGELOG.md) |
| [`rig_skin/`](rig_skin/) | rig_skin 0.10.20 con los parches EA7CL, y sus scripts de actualización y parcheo. | 0.10.20 |
| [`audio_dsp/`](audio_dsp/) | Analizador de espectro de audio, ecualizador paramétrico y filtros. | 2.4 |
| [`servidor/`](servidor/) | `init.js` del servidor y scripts del sistema (dablin, filtro_detector, bloquear_redes). | — |
| [`rig_zoom/`](rig_zoom/) | Escala del panel de rig_skin (ahora no se carga). | ver [CHANGELOG](rig_zoom/CHANGELOG.md) |
| [`profile_jump/`](profile_jump/) | Cambia al perfil que cubre la frecuencia pedida (DX cluster, MEM…), con su generador de `profiles.json`. | ver [CHANGELOG](profile_jump/CHANGELOG.md) |
| [`perfil_recordado/`](perfil_recordado/) | Cada navegador vuelve a su último perfil, frecuencia y modo, también tras un corte. | ver [CHANGELOG](perfil_recordado/CHANGELOG.md) |
| [`smeter_bandas/`](smeter_bandas/) | Corrige la lectura del S-meter en perfiles que marcan de más (27, 28, 50 MHz…). | ver [CHANGELOG](smeter_bandas/CHANGELOG.md) |
| [`meteo_letrero/`](meteo_letrero/) | Letrero con el tiempo de la estación Davis, con su tarea de cada minuto. | ver [CHANGELOG](meteo_letrero/CHANGELOG.md) |
| [`mi_ip/`](mi_ip/) | Tarjeta en la cabecera con la IP, país, ciudad, navegador e idioma del oyente. | ver [CHANGELOG](mi_ip/CHANGELOG.md) |
| [`banderas_emoji/`](banderas_emoji/) | Banderas emoji en Chrome y Edge de Windows. | ver [CHANGELOG](banderas_emoji/CHANGELOG.md) |
| [`anti_iframe/`](anti_iframe/) | Aviso si otra web muestra el receptor incrustado sin permiso. | ver [CHANGELOG](anti_iframe/CHANGELOG.md) |
| [`https/`](https/) | El receptor también por https en el puerto 8443 (certificado gratuito de Let's Encrypt que se renueva solo); el 8073 sigue igual. | — |
| [`copia_owrx/`](copia_owrx/) | Copia completa de lo personalizado y actualización de OpenWebRX+ que lo conserva. Instrucciones en [LEEME.txt](copia_owrx/LEEME.txt). | — |
| [`estereo_fm/`](estereo_fm/) | FM comercial y DAB+ en estéreo real (en 1.2.130+ con el modo BCFM y el estéreo propio de OpenWebRX), botón ESTÉREO/MONO y medidores L/R en MODOS. Se vuelve a poner solo tras actualizar con apt. | ver [CHANGELOG](estereo_fm/CHANGELOG.md) |
| [`fm_calidad/`](fm_calidad/) | FM de V-UHF con mejor sonido: la FM estrecha se demodula a 48 kHz (no a 12), con filtro de ±6 kHz por defecto y sin la distorsión del AGC. Mismo ancho de banda de red. Se vuelve a poner sola tras actualizar con apt. | ver [CHANGELOG](fm_calidad/CHANGELOG.md) |
| [`am_calidad/`](am_calidad/) | AM con mejor sonido: AGC por portadora sin golpe al abrir el squelch, paso alto de 250 Hz y paso bajo según la banda (3,5 kHz en Airband), limitador blando. La SAM no se toca. Se vuelve a poner sola tras actualizar con apt. | ver [CHANGELOG](am_calidad/CHANGELOG.md) |

Cada carpeta tiene su **instalador**, su **explicación** (README) y su **desinstalador**. Los desinstaladores
no borran nada: guardan `init.js` y el plugin en `/home/ea7cl/desinstalado-<plugin>-FECHA` y al terminar
dicen la orden para volver a ponerlo.

Las versiones estables se marcan con etiquetas `<carpeta>-vX.Y` (por ejemplo `autozoom-v1.0`).

`servir.ps1` sirve el repositorio en http://localhost:8765/ para abrir las simulaciones
(`powershell -ExecutionPolicy Bypass -File servir.ps1`).
