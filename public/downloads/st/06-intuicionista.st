// ST — Intuicionista proposicional
// Script canónico exhaustivo del perfil intuitionistic.propositional
logic intuitionistic.propositional

set verbose = off

// === VÁLIDAS CONSTRUCTIVAS ===
check valid (P -> P)
check valid (P -> (Q -> P))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((P -> Q) -> (!Q -> !P))
check valid ((P & !P) -> Q)
check valid (P -> !!P)
check valid (!(P | Q) -> (!P & !Q))
check valid ((P & Q) -> P)
check valid (P -> (P | Q))
check valid (((P -> Q) & (Q -> R)) -> (P -> R))

// === LEYES CLÁSICAS QUE AQUÍ CAEN ===
check valid (P | !P)
check valid (!!P -> P)
check valid (((P -> Q) -> P) -> P)

// === ALIASES DEL PARSER TAMBIÉN DISPONIBLES EN IPC ===
check equivalent (P !& Q), !(P & Q)
check equivalent (P !| Q), !(P | Q)
check equivalent !(P | Q), (!P & !Q)
check equivalent (P & Q), (Q & P)

// === SATISFACIBILIDAD ===
check satisfiable (P & Q)
check satisfiable ((P -> Q) & P)
check satisfiable (P | !P)

// === DERIVACIÓN Y PRUEBA ===
set verbose = on
axiom i1 = P -> Q
axiom i2 = Q -> R
axiom i3 = P
derive Q from {i1, i3}
derive R from {i1, i2, i3}
prove R from {i1, i2, i3}

// === ANÁLISIS DE INFERENCIAS ===
analyze {P, P -> Q} -> Q
analyze {P -> Q, !P} -> !Q

// === EXPLICACIÓN Y CONTRAMODELOS ===
explain (P -> !!P)
explain ((P -> Q) -> (!Q -> !P))
countermodel (P | !P)
countermodel (!!P -> P)
render theory
