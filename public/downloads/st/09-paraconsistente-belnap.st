// ST — Paraconsistente Belnap
// Script canónico exhaustivo del perfil paraconsistent.belnap
logic paraconsistent.belnap

set verbose = off

// === SATISFACIBILIDAD E INCONSISTENCIA TOLERADA ===
check satisfiable (P)
check satisfiable (!P)
check satisfiable (P & !P)
check satisfiable (P & !P & Q)

// === LEYES CLÁSICAS QUE FALLAN EN BELNAP ===
check valid (P -> P)
check valid (P | !P)
check valid !(P & !P)
check valid ((P & !P) -> Q)
check valid ((P & Q) -> P)

// === LEYES QUE SÍ SOBREVIVEN ===
check equivalent (P -> Q), (!P | Q)
check equivalent !(P & Q), (!P | !Q)
check equivalent !(P | Q), (!P & !Q)
check equivalent !!P, P
check equivalent (P & P), P
check equivalent (P | P), P

// === TABLAS CUATRO-VALORADAS ===
truth_table (P & !P)
truth_table (P -> P)

// === EXPLICACIÓN Y CONTRAMODELOS ===
set verbose = on
explain (P & !P)
explain (P -> P)
countermodel (P | !P)
countermodel ((P & !P) -> Q)
render theory
