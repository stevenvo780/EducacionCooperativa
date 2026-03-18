// ST — Paraconsistente Belnap: exhaustiva
logic paraconsistent.belnap

// === VALORES DE VERDAD ===
// T: Verdadero, F: Falso, B: Ambos (inconsistente), N: Ninguno (indeterminado)
// Valores designados: T y B (aceptan contradicción)

// --- Contradicción satisfacible (B asigna T y F) ---
check satisfiable (P & !P)

// --- Ex falso quodlibet NO válido ---
check valid ((P & !P) -> Q)

// --- Tercero excluido NO válido (N no es designado) ---
check valid (P | !P)

// --- Doble negación: NO válida (N no se preserva) ---
check valid (P <-> !!P)

// --- Identidad P->P: NO válida en Belnap (N→N = N, no designado) ---
check valid (P -> P)

// --- Estas tampoco son válidas por el valor N ---
check valid ((P & Q) -> P)
check valid (P -> (P | Q))

// --- Equivalencias (comparación valor-a-valor, no material) ---
check equivalent (P -> Q), (!P | Q)
check equivalent (!(P & Q)), (!P | !Q)

// --- Satisfacibilidad general ---
check satisfiable (P)
check satisfiable (!P)
check satisfiable (P & Q)

// --- Contramodelo ---
countermodel ((P & !P) -> Q)
countermodel (P | !P)
