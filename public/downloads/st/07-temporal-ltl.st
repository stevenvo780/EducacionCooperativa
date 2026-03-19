// ST — Temporal LTL
logic temporal.ltl

set verbose = on

// === SEGURIDAD, VIVACIDAD Y DUALIDADES ===
check valid ([](P) -> P)
check valid ([](P) -> <>(P))
check valid ([](P -> Q) -> ([](P) -> [](Q)))
check valid ([](P) -> []([](P)))
check valid ([](P) -> next P)
check equivalent <>(P), ![](!(P))
check equivalent [](P), !<>(!(P))

// === SATISFACIBILIDAD ===
check satisfiable (<>(P) & <>(!P))
check satisfiable (P until Q)
check satisfiable ([](P) & <>(Q))

// === DERIVACIÓN Y PRUEBA ===
axiom g1 = [](P -> Q)
axiom g2 = []P
axiom g3 = [](Q -> R)
derive [](Q) from {g1, g2}
derive [](R) from {g1, g2, g3}
prove [](R) from {g1, g2, g3}

// === ANÁLISIS DE INFERENCIAS ===
analyze {[](P -> Q), []P} -> []Q
analyze {<>(P)} -> [](P)

// === EXPLICACIÓN DE PATRONES Y CONTRAMODELOS ===
explain [](P -> <>Q)
explain (!P until Q)
countermodel (<>(P) -> [](P))
countermodel (next P -> P)
render theory
