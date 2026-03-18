// ST — Deóntica estándar: exhaustiva
logic deontic.standard

// === OPERADORES DEÓNTICOS ===
// [](P) — O(P) obligación
// <>(P) — P(P) permisión
// [](!P) — F(P) prohibición

// --- Axioma D: lo obligatorio es permitido ---
check valid ([](P) -> <>(P))

// --- Axioma K deóntico ---
check valid ([](P -> Q) -> ([](P) -> [](Q)))

// --- Prohibición bloquea permisión ---
check valid ([](!P) -> !<>(P))

// --- Lo obligatorio NO implica verdad ---
check valid ([](P) -> P)

// --- Satisfacibilidad ---
check satisfiable ([](P) & !P)
check satisfiable (<>(P) & <>(Q))

// --- Derivación ---
axiom obl = [](P -> Q)
axiom obl2 = [](P)
derive [](Q) from {obl, obl2}
