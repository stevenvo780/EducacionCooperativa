// ST — Deóntica estándar
logic deontic.standard

set verbose = on

// === OBLIGACIÓN, PERMISIÓN Y PROHIBICIÓN ===
check valid ([](P) -> <>(P))
check valid ([](P -> Q) -> ([](P) -> [](Q)))
check valid ([]P -> [](P | Q))
check valid ([](!P) -> !<>(P))
check equivalent [](P), !<>(!P)
check equivalent <>(P), ![](!P)

// === SATISFACIBILIDAD ===
check satisfiable ([](P) & !P)
check satisfiable (<>(P) & <>(!P))
check satisfiable ([](P -> Q) & <>(P))

// === DERIVACIÓN Y PRUEBA ===
axiom d1 = [](P -> Q)
axiom d2 = [](P)
axiom d3 = [](Q -> R)
derive [](Q) from {d1, d2}
derive [](R) from {d1, d2, d3}
prove [](R) from {d1, d2, d3}

// === ANÁLISIS DE INFERENCIAS ===
analyze {[](P -> Q), [](P)} -> [](Q)
analyze {<>(P)} -> P

// === EXPLICACIÓN, PARADOJAS Y CONTRAMODELOS ===
explain ([]P -> [](P | Q))
explain [](P -> <>Q)
countermodel ([](P) -> P)
countermodel (<>(P) -> P)
render theory
