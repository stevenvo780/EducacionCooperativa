// ST — Silogística aristotélica: exhaustiva
logic aristotelian.syllogistic

// === PROPOSICIONES CATEGÓRICAS ===
// A: Todo S es P     → forall x (S(x) -> P(x))
// E: Ningún S es P   → forall x (S(x) -> !P(x))
// I: Algún S es P    → exists x (S(x) & P(x))
// O: Algún S no es P → exists x (S(x) & !P(x))

// --- Figura 1: Barbara (AAA-1) ---
check valid ((forall x (M(x) -> P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))

// --- Figura 1: Celarent (EAE-1) ---
check valid ((forall x (M(x) -> !P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))

// --- Figura 1: Darii (AII-1) ---
check valid ((forall x (M(x) -> P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & P(x))))

// --- Figura 1: Ferio (EIO-1) ---
check valid ((forall x (M(x) -> !P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & !P(x))))

// --- Silogismo INVÁLIDO ---
check valid ((forall x (P(x) -> M(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))

// --- Derivación silogística ---
axiom mayor = forall x (M(x) -> P(x))
axiom menor = forall x (S(x) -> M(x))
derive forall x (S(x) -> P(x)) from {mayor, menor}

// --- Satisfacibilidad ---
check satisfiable (forall x (S(x) -> P(x)))
check satisfiable (exists x (S(x) & P(x)))
