// ST — Modal K
logic modal.k

// === NECESIDAD, POSIBILIDAD Y DUALIDAD ===
check valid ([](P -> Q) -> ([]P -> []Q))
check valid [](P -> P)
check equivalent []P, !<>!P
check equivalent <>P, ![]!P

// === SATISFACIBILIDAD ===
check satisfiable (<>P & <>Q)
check satisfiable ([]P & <>!P)
check satisfiable ([](P -> Q) & <>P)

// === DERIVACIÓN Y PRUEBA ===
axiom nec1 = [](P -> Q)
axiom nec2 = []P
axiom nec3 = [](Q -> R)
derive []Q from {nec1, nec2}
derive []R from {nec1, nec2, nec3}
prove []R from {nec1, nec2, nec3}

// === ANÁLISIS DE INFERENCIAS ===
analyze {[](P -> Q), []P} -> []Q
analyze {[]P} -> P

// === EXPLICACIÓN Y CONTRAMODELOS ===
explain [](P -> <>Q)
countermodel ([]P -> P)
countermodel (P -> []<>P)
render theory
