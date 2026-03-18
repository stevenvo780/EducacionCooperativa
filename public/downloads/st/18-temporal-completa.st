// ST — Temporal LTL: exhaustiva
logic temporal.ltl

// === OPERADORES TEMPORALES ===
// [](P) — G(P) siempre (Globally)
// <>(P) — F(P) eventualmente (Finally)
// X es el operador Next (solo via parser)

// --- G implica ahora (reflexividad del frame S4) ---
check valid ([](P) -> P)

// --- G implica F ---
check valid ([](P) -> <>(P))

// --- F NO implica G ---
check valid (<>(P) -> [](P))

// --- Dualidad temporal ---
check equivalent (<>(P)), (![](!(P)))
check equivalent ([](P)), (!<>(!(P)))

// --- Distribución ---
check valid ([](P -> Q) -> ([]P -> []Q))

// --- Satisfacibilidad ---
check satisfiable (<>(P) & <>(!P))
check satisfiable ([](P))
check satisfiable (<>(P) & !P)

// --- Derivación temporal ---
axiom always = [](P -> Q)
axiom now = [](P)
derive [](Q) from {always, now}
