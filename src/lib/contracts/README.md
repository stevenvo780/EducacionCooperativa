# `src/lib/contracts/`

Parsers de borde. Cada función exportada toma `unknown` y devuelve una unión
`{ ok: true; value: T } | { ok: false; error: string }`. Cero dependencias
externas.

Reglas:
- Nunca se hace `as T` en endpoints; siempre se pasa por un parser.
- El parser falla con un mensaje claro que cita el campo problemático.
- Cualquier bug "legacy" (datos viejos en Firestore con shape distinto) se
  documenta como rama del parser con el commit hash que lo originó.
