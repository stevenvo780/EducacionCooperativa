// ST — Clásica proposicional
// Script canónico exhaustivo del perfil classical.propositional
logic classical.propositional

set verbose = off

// === 27 LEYES CLASIFICADAS AUTOMÁTICAMENTE ===
check valid (P -> P)
check valid (P | !P)
check valid !(P & !P)
check valid (P -> (Q -> P))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((P -> Q) -> (!Q -> !P))
check valid ((!P -> !Q) -> (Q -> P))
check valid (!!P -> P)
check valid (P -> !!P)
check valid (((P -> Q) -> P) -> P)
check valid (!P -> (P -> Q))
check valid (((P -> Q) & (Q -> R)) -> (P -> R))
check valid ((P | Q) -> (Q | P))
check valid ((P & Q) -> (Q & P))
check valid (!(P & Q) <-> (!P | !Q))
check valid (!(P | Q) <-> (!P & !Q))
check valid ((P & (Q | R)) <-> ((P & Q) | (P & R)))
check valid ((P | (Q & R)) <-> ((P | Q) & (P | R)))
check valid ((P -> Q) <-> (!P | Q))
check valid ((P <-> Q) <-> ((P -> Q) & (Q -> P)))
check valid ((P & (P | Q)) <-> P)
check valid ((P | (P & Q)) <-> P)
check valid ((P & P) <-> P)
check valid ((P | P) <-> P)
check valid (((P & Q) -> R) <-> (P -> (Q -> R)))
check valid ((P <-> Q) <-> (Q <-> P))
check valid (!!P <-> P)

// === OPERADORES EXTENDIDOS Y ALIASES ===
check equivalent (P !& Q), !(P & Q)
check equivalent (P nand Q), !(P & Q)
check equivalent (P ↑ Q), !(P & Q)
check equivalent (P !| Q), !(P | Q)
check equivalent (P nor Q), !(P | Q)
check equivalent (P ↓ Q), !(P | Q)
check equivalent (P ^ Q), ((P | Q) & !(P & Q))
check equivalent (P xor Q), ((P | Q) & !(P & Q))
check equivalent (P ⊕ Q), ((P | Q) & !(P & Q))

// === SATISFACIBILIDAD Y CLASIFICACIÓN SEMÁNTICA ===
check satisfiable (P & Q)
check satisfiable (!P & !Q)
check satisfiable ((P -> Q) & P)
check satisfiable ((P -> Q) & P & !Q)
check satisfiable (P & !P)

// === DERIVACIÓN: GALERÍA DE REGLAS EFECTIVAS ===
set verbose = proof
set output = latex

axiom mp1 = P -> Q
axiom mp2 = P
derive Q from {mp1, mp2}

axiom pr1 = P -> Q
axiom pr2 = Q -> R
axiom pr3 = P
prove R from {pr1, pr2, pr3}

axiom mt1 = !Q
axiom mt2 = P -> Q
derive !P from {mt1, mt2}

axiom ci1 = P
axiom ci2 = Q
derive P & Q from {ci1, ci2}

axiom ce1 = P & Q
derive P from {ce1}

axiom di1 = P
derive P | Q from {di1}

axiom sh1 = P -> Q
axiom sh2 = Q -> R
derive P -> R from {sh1, sh2}

axiom pv1 = P -> Q
axiom pv2 = Q -> R
axiom pv3 = P
derive R from {pv1, pv2, pv3}

axiom sd1 = P | Q
axiom sd2 = !P
derive Q from {sd1, sd2}

axiom ib1 = P -> Q
axiom ib2 = Q -> P
derive P <-> Q from {ib1, ib2}

axiom eb1 = P <-> Q
axiom eb2 = P
derive Q from {eb1, eb2}

axiom dc1 = (P -> Q) & (R -> S)
axiom dc2 = P | R
derive Q | S from {dc1, dc2}

axiom dd1 = (P -> Q) & (R -> S)
axiom dd2 = !Q | !S
derive !P | !R from {dd1, dd2}

axiom ds1 = P | Q
axiom ds2 = P -> R
axiom ds3 = Q -> R
derive R from {ds1, ds2, ds3}

axiom rs1 = P | Q
axiom rs2 = !P | R
derive Q | R from {rs1, rs2}

axiom ex1 = P
axiom ex2 = !P
derive Q from {ex1, ex2}

axiom dn1 = !!P
derive P from {dn1}

axiom idn1 = P
derive !!P from {idn1}

axiom ii1 = Q
derive P -> Q from {ii1}

axiom cp1 = P -> Q
derive !Q -> !P from {cp1}

axiom ab1 = P -> Q
derive P -> (P & Q) from {ab1}

axiom expt1 = (P & Q) -> R
derive P -> (Q -> R) from {expt1}

axiom impt1 = P -> (Q -> R)
derive (P & Q) -> R from {impt1}

axiom dm1 = !(P & Q)
derive !P | !Q from {dm1}

axiom dm2 = !(P | Q)
derive !P & !Q from {dm2}

axiom raa1 = P -> Q
axiom raa2 = P -> !Q
derive !P from {raa1, raa2}

// === ANÁLISIS DE INFERENCIAS Y FALACIAS ===
set verbose = on
analyze {P, P -> Q} -> Q
analyze {P -> Q, Q} -> P
analyze {P -> Q, !P} -> !Q
analyze {P -> P} -> (P -> P)

// === EXPLAIN, TABLAS Y CONTRAMODELOS ===
explain (P -> Q)
explain ((P ⊕ Q) -> (P | Q))
set verbose = model
truth_table (P -> Q)
truth_table ((P ⊕ Q) <-> ((P | Q) & !(P & Q)))
countermodel (P -> Q)
countermodel (((P -> Q) & Q) -> P)
render theory
