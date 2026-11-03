# Cambios de contador

## v1.0 — 3-nov-2026

Primera versión genérica, para instalar en cualquier OpenWebRX+:

- El contador del servidor va en su propio módulo, `owrx/contador.py`, separado de las estadísticas
  de sesión del receptor de EA7CL, y sin la base de 350.000 visitas de Flag Counter (`COUNTER_BASE = 0`).
- La ruta de `datos.json` se calcula a partir de donde está instalado OpenWebRX.
- La tarjeta va al final de la cabecera, con alto automático (`DESPUES_DE` y `ALTO` para colocarla e igualarla).
- Textos en español o inglés según el navegador.
- Instalador que lo hace todo (dependencia, base de países con renovación mensual, `connection.py`,
  `init.js`, reinicio) y desinstalador.

Viene de la versión 0.2 instalada en el receptor de EA7CL el 27-oct-2026.
