// ST — Temporal LTL
// Script canónico exhaustivo del perfil temporal.ltl
logic temporal.ltl

set verbose = off

// === AXIOMAS, DUALIDADES Y NEGATIVOS IMPORTANTES ===
check valid ([]P -> P)
check valid ([]P -> <>P)
check valid ([]P -> [][]P)
check valid ([](P -> Q) -> ([]P -> []Q))
check valid ([]P -> next P)
check valid (<>P -> []P)
check equivalent <>(P), ![](!P)
check equivalent [](P), !<>(!P)

// === SATISFACIBILIDAD ===
check satisfiable (next P)
check satisfiable (<>(P) & <>(!P))
check satisfiable (P until Q)
check satisfiable ([]P & <>Q)

// === DERIVACIÓN Y PRUEBA ===
set verbose = on
axiom g1 = [](P -> Q)
axiom g2 = []P
axiom g3 = [](Q -> R)
derive []Q from {g1, g2}
derive []R from {g1, g2, g3}
prove []R from {g1, g2, g3}

// === ANÁLISIS ===
analyze {[](P -> Q), []P} -> []Q
analyze {<>P} -> []P

// === LOS 6 PATRONES TEMPORALES RECONOCIDOS ===
explain [](!P)
explain <>(P)
explain [](P -> <>Q)
explain <>[](P)
explain []<>(P)
explain (!P until Q)

// === CONTRAMODELOS TEMPORALES ===
countermodel (<>P -> []P)
countermodel (next P -> P)
render theory
