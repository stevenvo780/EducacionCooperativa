// ST — Lógica de primer orden: exhaustiva
logic classical.first_order

// === CUANTIFICADORES Y PREDICADOS ===
// forall x <fórmula>  — cuantificador universal
// exists x <fórmula>  — cuantificador existencial
// P(x), R(x,y)        — predicados con parámetros

// --- Valideces de FOL ---
check valid ((forall x P(x)) -> P(a))
check valid (P(a) -> exists x P(x))
check valid ((forall x (P(x) -> Q(x))) -> ((forall x P(x)) -> (forall x Q(x))))

// --- Satisfacibilidad ---
check satisfiable (exists x P(x))
check satisfiable (forall x P(x))
check satisfiable (P(a) & !P(b))

// --- Derivación ---
axiom univ = forall x (P(x) -> Q(x))
axiom base = P(a)
derive Q(a) from {univ, base}
