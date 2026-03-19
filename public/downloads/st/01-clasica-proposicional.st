// ST — Clásica proposicional
logic classical.propositional

// === TAUTOLOGÍAS Y FORMAS DERIVADAS ===
check valid (P -> P)
check valid (P | !P)
check valid !(P & !P)
check valid ((P -> Q) -> (!Q -> !P))
check valid (((P -> Q) & (Q -> R)) -> (P -> R))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((!P -> !Q) -> (Q -> P))

// === EQUIVALENCIAS Y OPERADORES EXTENDIDOS ===
check equivalent (!(P & Q)), (!P | !Q)
check equivalent (!(P | Q)), (!P & !Q)
check equivalent (P -> Q), (!P | Q)
check equivalent (P <-> Q), ((P -> Q) & (Q -> P))
check equivalent (P !& Q), (!(P & Q))
check equivalent (P !| Q), (!(P | Q))
check equivalent (P ^ Q), ((P | Q) & !(P & Q))

// === SATISFACIBILIDAD ===
check satisfiable (P & Q)
check satisfiable ((P -> Q) & P & !Q)
check satisfiable (!P & !Q)

// === DERIVACIÓN Y PRUEBA ===
axiom mp1 = P -> Q
axiom mp2 = Q -> R
axiom mp3 = P
derive Q from {mp1, mp3}
derive R from {mp1, mp2, mp3}
prove R from {mp1, mp2, mp3}

// === ANÁLISIS DE INFERENCIAS ===
analyze {P, P -> Q} -> Q
analyze {P -> Q, Q} -> P

// === EXPLICACIÓN, TABLAS Y CONTRAMODELOS ===
explain ((P ^ Q) -> (P | Q))
truth_table (P -> Q)
truth_table ((P ^ Q) <-> ((P | Q) & !(P & Q)))
countermodel (P -> Q)
countermodel (((P -> Q) & Q) -> P)
render theory
