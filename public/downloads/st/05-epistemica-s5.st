// ST — Epistémica S5
logic epistemic.s5

// === VERIDICIDAD, INTROSPECCIÓN Y DUALIDAD ===
check valid ([](P) -> P)
check valid ([](P) -> []([](P)))
check valid (![]P -> [](![]P))
check valid (P -> [](<>P))
check valid ([](P -> Q) -> ([]P -> []Q))
check equivalent []P, !<>!P
check equivalent <>P, ![]!P

// === SATISFACIBILIDAD ===
check satisfiable ([]P & ![]Q)
check satisfiable (<>P & <>!P)
check satisfiable ([](P -> Q) & <>P)

// === DERIVACIÓN Y PRUEBA ===
axiom s1 = [](P -> Q)
axiom s2 = []P
axiom s3 = [](Q -> R)
derive []Q from {s1, s2}
derive []R from {s1, s2, s3}
prove []R from {s1, s2, s3}

// === ANÁLISIS DE INFERENCIAS ===
analyze {[](P -> Q), []P} -> []Q
analyze {<>P} -> P

// === EXPLICACIÓN Y CONTRAMODELOS ===
explain (![]P -> [](![]P))
countermodel (<>P -> P)
countermodel ([]P -> []Q)
render theory
