// ST — Epistémica S5: exhaustiva
logic epistemic.s5

// === OPERADORES EPISTÉMICOS ===
// [](P) — K(P) conocimiento
// <>(P) — B(P) creencia

// --- Axioma T (veridicidad): lo sabido es verdad ---
check valid ([](P) -> P)

// --- Axioma 4 (introspección positiva): sé que sé ---
check valid ([](P) -> []([](P)))

// --- Axioma B / 5 (introspección negativa) ---
check valid (![]P -> [](![]P))
check valid (P -> [](<>P))

// --- Axioma K ---
check valid ([](P -> Q) -> ([]P -> []Q))

// --- Satisfacibilidad ---
check satisfiable ([](P) & [](Q))
check satisfiable (<>(P) & ![]P)

// --- Derivación epistémica ---
axiom k1 = [](P -> Q)
axiom k2 = [](P)
derive [](Q) from {k1, k2}
