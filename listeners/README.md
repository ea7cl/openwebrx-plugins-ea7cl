# listeners (LST) — versión EA7CL

Plugin de receptor para OpenWebRX+ que muestra en directo quién está escuchando y en qué
frecuencia y modo, en este receptor y en los demás de la misma red. Botón **LST** de la columna
de plugins; al pulsar una fila de este receptor se sintoniza esa frecuencia.

Autor del original: **0xAF (LZ2SLL)**, licencia MIT
(<https://0xaf.github.io/openwebrxplus-plugins/receiver/listeners/>). Esta carpeta guarda
**la versión EA7CL**, que es la instalada en el servidor `openwebrx`.

## Cómo funciona (comprobado en el servidor)

1. Cada segundo lee la sintonía del navegador: perfil, frecuencia, modo y filtro.
2. Si ha cambiado, la envía a **Supabase Realtime Presence**, que la reparte a todos los oyentes conectados.
3. Supabase limita los envíos, así que no se manda más de uno cada **6,5 s**; los cambios
   rápidos se agrupan y se manda el último.
4. Cada oyente dibuja la lista con lo que recibe de Supabase.
5. El país y la localidad se averiguan por IP en el navegador del oyente (geojs, ipwho.is,
   country.is o Cloudflare, por ese orden). Solo se envía el código del país y la ciudad, nunca la IP.

## Modificaciones EA7CL

Todas están dentro de `plugin/listeners.js` y `plugin/listeners.css`, marcadas con `EA7CL`.

- Interfaz en español.
- País y localidad aproximada de cada oyente, con su bandera (`MOSTRAR_LOCALIDAD = false` → solo bandera).
- Cada modo con su color, como en el DX cluster (CW amarillo, USB rosa, LSB verde lima, FT8 cian,
  FT4 azul, digitales violeta, NFM rojo, WFM ocre, AM naranja).
- Ventana con ancho mínimo y siempre dentro de la pantalla.
- **Frecuencias en MHz con precisión de 10 Hz (v1.3):** 432.275<sub>25</sub> MHz, 10489.540<sub>00</sub> MHz.
  Los dos últimos dígitos (centenas y decenas de Hz) van más pequeños y en un azul más apagado
  (`.owrx-listeners__decimals`).
- **Frecuencia estable (v1.1):** solo publica cuando la frecuencia lleva 1,5 s quieta
  (`ESPERA_ESTABLE_MS`). Antes se publicaba una frecuencia intermedia (al arrastrar, girar la
  rueda o teclear) y la buena tardaba hasta 6,5 s en aparecer.

El aspecto del botón (LED, número dentro) lo pone [`botones_ea7cl`](../botones_ea7cl/), no este plugin.

## Control de cambios con git

El primer commit de esta carpeta es el **original de 0xAF sin tocar**; los siguientes son los
cambios EA7CL. Para ver todas nuestras modificaciones:

```bash
git diff d25b643 -- listeners/plugin
```

Si 0xAF publica una versión nueva: se copia encima de `plugin/`, se vuelven a aplicar los cambios
EA7CL (git muestra cuáles son) y se instala. Los ficheros siguen siendo solo esos dos.

## Por qué no se pierde con las actualizaciones de OpenWebRX

La carpeta `listeners/` del servidor **no pertenece al paquete de OpenWebRX** (`dpkg -S` no la
reconoce), así que actualizar OpenWebRX no la toca. Se carga en local (`Plugins.load('listeners')`),
no desde internet, así que tampoco cambia sola si 0xAF publica otra versión.

## Archivos

| Archivo | Para qué |
|---|---|
| `plugin/listeners.js` | El plugin. |
| `plugin/listeners.css` | Sus estilos. |
| `scripts/listeners-install.sh` | Instala o actualiza: copia de seguridad de la carpeta del servidor y copia los dos ficheros. |

## Configuración en `init.js` del servidor

Va dentro del bloque `Plugins.load('utils').then(async function () { … })`:

```js
await Plugins.load('listeners');
await Plugins.listeners.setup({
    supabaseUrl: 'https://rqqmkiaoykaohxegyheq.supabase.co',
    supabaseKey: 'sb_publishable_Asl5b4Sj7-XDrikwWJQT0Q_uEfIvTg-',
    receiverId: 'ea7cl-openwebrx',
    network: 'ea7cl-openwebrx'
});
```

La clave es la «publishable» de Supabase, pensada para ir en el navegador.

## Instalar o reinstalar

```bash
scp listeners/plugin/listeners.js listeners/plugin/listeners.css listeners/scripts/listeners-install.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/listeners-install.sh'
```

Después, recarga la página del receptor (Ctrl+F5).
