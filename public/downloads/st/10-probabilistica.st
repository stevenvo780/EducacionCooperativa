// ST — Probabilística básica
logic probabilistic.basic

set verbose = on

// === VALIDEZ Y EQUIVALENCIA PROBABILÍSTICA ===
check valid (P | !P)
check valid (P -> P)
check valid ((P & Q) -> P)
check valid ((P & !P) -> Q)
check equivalent (P -> Q), (!P | Q)
check equivalent !(P & Q), (!P | !Q)
check equivalent (P <-> Q), ((P -> Q) & (Q -> P))

// === SATISFACIBILIDAD ===
check satisfiable P
check satisfiable (P & Q)
check satisfiable (P -> Q)
check satisfiable !(P & Q)

// === DERIVACIÓN Y PRUEBA ===
axiom p1 = P -> Q
axiom p2 = Q -> R
axiom p3 = P
derive Q from {p1, p3}
derive R from {p1, p2, p3}
prove R from {p1, p2, p3}

// === ANÁLISIS DE INFERENCIAS ===
analyze {P, P -> Q} -> Q
analyze {Q, P -> Q} -> P

// === EXPLICACIÓN, TABLAS Y CONTRAMODELOS ===
explain (P & Q)
explain (P -> Q)
truth_table (P -> Q)
truth_table (P & !P)
truth_table (P | !P)
countermodel P
countermodel (P & Q)
render theory
