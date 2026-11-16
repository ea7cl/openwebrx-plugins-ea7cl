# scan_pausa_ea7cl — SCAN con pausa de 5 s (EA7CL)

Plugin de receptor para OpenWebRX+, versión **0.1**. Instalado en el servidor `openwebrx` el 16-nov-2026,
idéntico al de este repositorio (comprobado con SHA-256).

## Qué hace

- El SCAN de memorias (botón SCAN o clic derecho en SQL) se para en una memoria con señal **solo 5 s**
  y sigue con la siguiente que tenga señal. El original se quedaba en ella todo el tiempo que hubiera señal.
- Si no hay otra con señal, se queda en la misma (sin volver a sintonizarla) y vuelve a mirar a los 5 s.
- Si la señal se va antes, sigue enseguida, como el original.
- Solo cambia `Scanner.prototype.scan` (`lib/Scanner.js`); el resto del escáner es el de OpenWebRX.
- El tiempo se cambia en el plugin: `Plugins.scan_pausa_ea7cl.PAUSA = 5000;` (milisegundos).
- El SUB del doble receptor (1.13.5 o posterior) usa la misma pausa si este plugin está cargado.

Como el escáner comprueba cada segundo, en la práctica salta cada 5-6 s.

## Archivos

| Archivo | Para qué |
|---|---|
| `scan_pausa_ea7cl.js` | El plugin. |
| `scripts/scan_pausa_ea7cl-install.sh` | Instala o actualiza: copia de `init.js` (y del plugin si ya existía), copia el plugin y añade su carga al final de `init.js` si falta. |
| `scripts/scan_pausa_ea7cl-uninstall.sh` | Desinstala: quita su línea de `init.js` y aparta la carpeta, con copia de todo. |

## Instalar o reinstalar

```bash
scp scan_pausa_ea7cl/scan_pausa_ea7cl.js scan_pausa_ea7cl/scripts/scan_pausa_ea7cl-install.sh scan_pausa_ea7cl/scripts/scan_pausa_ea7cl-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/scan_pausa_ea7cl-install.sh'
```

Después, Ctrl+F5 en el navegador. El servidor deja que cada navegador guarde los plugins hasta una
hora, así que quien ya tuviera la página abierta puede ver la versión anterior durante ese tiempo.

## Desinstalar

```bash
scp scan_pausa_ea7cl/scripts/scan_pausa_ea7cl-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/scan_pausa_ea7cl-uninstall.sh'
```

No borra nada: guarda `init.js` y la carpeta del plugin en `/home/ea7cl/desinstalado-scan_pausa_ea7cl-FECHA`
y al terminar dice la orden para volver a ponerlo.
