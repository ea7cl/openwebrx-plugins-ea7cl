# autozoom — plugin para OpenWebRX+ (EA7CL)

Plugin de receptor que hace zoom automático en el waterfall a la banda de la
frecuencia sintonizada. Cada oyente lo activa o desactiva desde su navegador.

Servidor `openwebrx` (192.168.1.115, OpenWebRX+ 1.2.126). Versión base: v1.0 (etiqueta `autozoom-v1.0`);
instalada ahora: **v1.2** (etiqueta `autozoom-v1.2`, SHA-256 `ad1daeb9bbddfbde23369b4b7be8cc9717181c3977b2066fd7a84c60f9dbbfa6`).

## Cómo funciona

- **Botón AZ** (columna de plugins, encima de DOP y LST).
  - Clic: activar / desactivar. **Por defecto desactivado** (0 % de zoom, como si no existiera).
  - Clic derecho (o mantener pulsado en el móvil): elegir **cuánto zoom**:
    5 % (mínimo), 10 %, **25 % (normal)**, 50 % (máximo). El circulito muestra el zoom que se usará al activarlo.

    | Zoom | Qué se ve |
    |---|---|
    | 5 % (mínimo) | La banda entera, ajustada a sus márgenes (si la banda ocupa todo el perfil: la mitad del perfil) |
    | 10 % | La mitad de esa vista, con la frecuencia en el centro aunque se salga de la banda |
    | 25 % (normal) | La cuarta parte, frecuencia en el centro |
    | 50 % (máximo) | La octava parte, frecuencia en el centro |

    Cada opción hace el doble de zoom que la anterior; solo coinciden al llegar al máximo zoom de OpenWebRX.
  - Gris = desactivado. Verde con raya = activado.
  - Cada navegador guarda su elección en `localStorage` (`autozoom_on`, `autozoom_zoom`).
    La v1.0 usaba `autozoom_pct` con el significado contrario; la v1.1 lo ignora.
- Con el autozoom activado:
  - **3 s** después de sintonizar una frecuencia hace el zoom elegido según la banda que la contiene
    (bandas de la cinta del servidor, `/etc/openwebrx/bands.json`; si no hay cinta, la tabla del plugin).
    Si la frecuencia está en dos bandas, se usa la más estrecha.
  - Tocar el waterfall/escala (clic, rueda o toque) abre el rango completo sin sintonizar.
    Si en 3 s no se elige otra frecuencia, vuelve el zoom.
  - El ancho real es algo mayor que el % porque OpenWebRX solo tiene niveles de zoom fijos.

## Archivos

Rutas relativas a esta carpeta `autozoom/` del repositorio `openwebrx-plugins-ea7cl`.
Cada versión estable queda marcada en Git con una etiqueta `autozoom-vX.Y`.

| Archivo | Para qué |
|---|---|
| `autozoom.js` | Código del plugin. |
| `init.js` | Línea que carga el plugin (ya añadida al `init.js` del servidor). |
| `scripts/autozoom-install.sh` | Primera instalación: copia de `init.js`, carpeta del plugin y línea en `init.js`. |
| `scripts/autozoom-update.sh` | Actualización: copia del plugin instalado en `~/autozoom.js.bak-FECHA` y sustitución. |
| `simulacion/index.html` | Simulación con tus perfiles y bandas reales, sin tocar el receptor. |
| `../servir.ps1` | Servidor local (localhost:8765) para abrir la simulación. |
| `CHANGELOG.md` | Historial de versiones. |

## En el servidor

- Plugin: `/usr/lib/python3/dist-packages/htdocs/plugins/receiver/autozoom/autozoom.js`
- Carga: última línea de `.../plugins/receiver/init.js` → `Plugins.load('autozoom');`
- Copia de `init.js` antes de añadir el plugin: `init.js.bak-2026-10-23-1917`
- Copias del plugin en `/home/ea7cl/`:
  - `autozoom.js.bak-2026-10-23-1944` — primera versión (5 s, sin re-zoom)
  - `autozoom.js.bak-2026-10-23-2007` — con re-zoom tras tocar
  - `autozoom.js.bak-2026-10-24-2021` — arreglo 128–138 MHz, con `DELAY_MS` cambiado a mano a 3000
  - `autozoom.js.bak-2026-10-24-2111` — v1.0 (`autozoom-v1.0`)
  - `autozoom.js.bak-2026-10-24-2139` — v1.1 (`autozoom-v1.1`)
- Instalada ahora: v1.2 (`autozoom-v1.2`).
- Los navegadores guardan los archivos 1 hora en caché (`max-age=3600`): Ctrl+F5 para ver un cambio al momento.

## Procedimiento para una mejora

1. Editar `autozoom.js`.
2. Probar: `simulacion/` para la lógica; en el receptor, cargando el código solo en una pestaña
   con otro nombre y apagando la versión instalada en esa pestaña.
3. Subir: `scp autozoom.js scripts/autozoom-update.sh openwebrx:~/` y comprobar `sha256sum`.
4. Instalar: `ssh -t openwebrx 'sudo bash ~/autozoom-update.sh'` (hace la copia de seguridad).
5. Comprobar en el navegador, anotarla en `CHANGELOG.md`, hacer commit, etiquetarla (`autozoom-vX.Y`) y subirla a GitHub.

## Volver atrás

```bash
# a la versión anterior del plugin (v1.1)
sudo cp /home/ea7cl/autozoom.js.bak-2026-10-24-2139 /usr/lib/python3/dist-packages/htdocs/plugins/receiver/autozoom/autozoom.js
# quitar el plugin del todo
sudo cp /usr/lib/python3/dist-packages/htdocs/plugins/receiver/init.js.bak-2026-10-23-1917 /usr/lib/python3/dist-packages/htdocs/plugins/receiver/init.js && sudo rm -r /usr/lib/python3/dist-packages/htdocs/plugins/receiver/autozoom
```

## Pendiente / ideas

- Perfiles 137,5–140 y 138–140 MHz: sin zoom por encima de 138 MHz porque la cinta no tiene banda ahí
  (añadirla a `bands.json` o usar la tabla del plugin cuando la cinta no tenga banda).
- Que el circulito diga «OFF» cuando está desactivado.
