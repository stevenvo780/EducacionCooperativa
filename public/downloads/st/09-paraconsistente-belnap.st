// ST — Paraconsistente Belnap
logic paraconsistent.belnap

set verbose = on

// === SATISFACIBILIDAD E INCONSISTENCIA TOLERADA ===
check satisfiable (P & !P)
check satisfiable (P)
check satisfiable (!P)
check satisfiable (P & !P & Q)

// === FÓRMULAS CLÁSICAS QUE FALLAN EN BELNAP ===
check valid ((P & !P) -> Q)
check valid (P | !P)
check valid (P -> P)
check valid ((P & Q) -> P)

// === EQUIVALENCIAS CUATRO-VALORADAS ===
check equivalent (P -> Q), (!P | Q)
check equivalent !(P & Q), (!P | !Q)
check equivalent !(P | Q), (!P & !Q)
check equivalent !!P, P

// === DERIVACIÓN, PRUEBA Y ANÁLISIS ===
axiom b1 = P -> Q
axiom b2 = P
derive Q from {b1, b2}
prove Q from {b1, b2}
analyze {P, P -> Q} -> Q
analyze {P & !P} -> Q

// === EXPLICACIÓN Y CONTRAMODELOS ===
explain (P & !P)
explain (P -> P)
countermodel (P | !P)
countermodel ((P & !P) -> Q)
render theory
