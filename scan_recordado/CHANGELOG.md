# Historial de scan_recordado

## v1.2 — 3-nov-2026
- El buscador de MEM encuentra memorias de otros perfiles y, al pulsarlas, cambia de perfil
  y las sintoniza (con profile_jump). Una letra busca por inicial; más letras, por contenido.
- `gen_memorias.py` y el vigilante `scan-recordado-memorias.path` mantienen al día la lista
  completa cada vez que cambian los marcadores del servidor.

## v1.1 — 3-nov-2026
- Botón MEM con la ventana «Memorias»: casillas Ver y Scan por memoria, búsqueda,
  sintonizar pulsando el nombre, y botones Ver todas, Scan todas, Scan ninguna y Restaurar.
- Las memorias ocultas desaparecen del waterfall y del scan, y se recuerdan en el navegador.

## v1.0 — 3-nov-2026
- Cada navegador recuerda las memorias que activa o quita del scan con el clic derecho.
- Se aplica al abrir el SDR y al cambiar de perfil, en memorias del servidor y propias.
