# openwebrx-plugins-ea7cl

Desarrollos para el receptor OpenWebRX+ de EA7CL (Málaga). Cada desarrollo va en su carpeta.

| Carpeta | Qué es | Versión |
|---|---|---|
| [`autozoom/`](autozoom/) | Zoom automático del waterfall centrado en la frecuencia sintonizada, con botón AZ. | ver [CHANGELOG](autozoom/CHANGELOG.md) |
| [`botones_ea7cl/`](botones_ea7cl/) | Aspecto común, estilo LED, para todos los botones de la columna de plugins (AZ, DOP, LST…). | ver [CHANGELOG](botones_ea7cl/CHANGELOG.md) |

Las versiones estables se marcan con etiquetas `<carpeta>-vX.Y` (por ejemplo `autozoom-v1.0`).

`servir.ps1` sirve el repositorio en http://localhost:8765/ para abrir las simulaciones
(`powershell -ExecutionPolicy Bypass -File servir.ps1`).
