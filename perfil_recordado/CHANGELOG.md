# Historial de perfil_recordado

## v0.3 — 21-nov-2026
- Si el enlace pide una frecuencia que no está en el perfil inicial, salta al perfil que la cubre
  (lista de profile_jump) con la frecuencia y el modo del enlace.
- Arreglo: la primera apertura de la página ya no cuenta como reconexión (solo si antes hubo un corte).
  Sin esto, el arreglo de la 0.2 podía no actuar nunca.
- Probada en la Pi (enlace a otro perfil, F5 y corte de conexión) e instalada en el receptor.

## v0.2 — 21-nov-2026
- Al entrar por un enlace con `#freq=` que se diferencia más de 50 Hz de lo recordado, no se vuelve
  al último perfil. Las recargas (F5) y las reconexiones siguen igual.

## v0.1 — 3-nov-2026
- Guardado en el repositorio tal como funciona en el servidor, con instalador y desinstalador.
