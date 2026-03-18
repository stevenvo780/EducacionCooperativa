// ST — Probabilística básica: exhaustiva
logic probabilistic.basic

// === SEMÁNTICA ===
// P(A)       ∈ [0, 1]
// P(¬A)      = 1 - P(A)
// P(A ∧ B)   = P(A) × P(B)  (independencia)
// P(A ∨ B)   = P(A) + P(B) - P(A)P(B)
// P(A → B)   = P(¬A ∨ B)
// Validez:    P(φ) = 1 para toda asignación

// --- Tautología probabilística (P=1 siempre) ---
check valid (P | !P)
check valid (P -> P)
check valid ((P & Q) -> P)

// --- NO válido (P<1 posible) ---
check valid P
check valid (P & Q)
check valid (P -> Q)

// --- Satisfacibilidad ---
check satisfiable (P & Q)
check satisfiable P
check satisfiable (P -> Q)

// --- Contramodelo ---
countermodel P
countermodel (P & Q)

// --- Tabla de verdad probabilística ---
truth_table (P -> Q)
truth_table (P & !P)

// --- Equivalencia ---
check equivalent (P -> Q), (!P | Q)

// --- Derivación ---
axiom p1 = P -> Q
axiom p2 = P
derive Q from {p1, p2}
