// ST — Clásica proposicional
logic classical.propositional

set verbose = on

// === TAUTOLOGÍAS Y ESQUEMAS CLÁSICOS ===
check valid (P -> P)
check valid (P | !P)
check valid !(P & !P)
check valid ((P -> Q) -> (!Q -> !P))
check valid (((P -> Q) & (Q -> R)) -> (P -> R))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((P & Q) -> P)
check valid (P -> (P | Q))

// === EQUIVALENCIAS Y OPERADORES EXTENDIDOS ===
check equivalent (!(P & Q)), (!P | !Q)
check equivalent (!(P | Q)), (!P & !Q)
check equivalent (P -> Q), (!P | Q)
check equivalent (P <-> Q), ((P -> Q) & (Q -> P))
check equivalent (P !& Q), (!(P & Q))
check equivalent (P !| Q), (!(P | Q))
check equivalent (P ^ Q), ((P | Q) & !(P & Q))

// === SATISFACIBILIDAD Y CLASIFICACIÓN ===
check satisfiable (P & Q)
check satisfiable ((P -> Q) & P & !Q)
check satisfiable (!P & !Q)
check satisfiable (P & !P)

// === DERIVACIÓN, PRUEBA Y LATEX ===
set verbose = proof
set output = latex
axiom mp1 = P -> Q
axiom mp2 = Q -> R
axiom mp3 = P
derive Q from {mp1, mp3}
derive R from {mp1, mp2, mp3}
prove R from {mp1, mp2, mp3}

// === ANÁLISIS DE INFERENCIAS Y FALACIAS ===
set verbose = on
analyze {P, P -> Q} -> Q
analyze {P -> Q, Q} -> P
analyze {P -> Q, !P} -> !Q

// === EXPLAIN, TABLAS Y CONTRAMODELOS ===
explain (P -> Q)
explain ((P ^ Q) -> (P | Q))
set verbose = model
truth_table (P -> Q)
truth_table ((P ^ Q) <-> ((P | Q) & !(P & Q)))
countermodel (P -> Q)
countermodel (((P -> Q) & Q) -> P)
render theory
