// ST — Silogística aristotélica
logic aristotelian.syllogistic

set verbose = on

// === MODOS CATEGÓRICOS CLAVE ===
check valid ((forall x (M(x) -> P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
check valid ((forall x (M(x) -> !P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (M(x) -> P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (M(x) -> !P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (M(x) -> P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((exists x (M(x) & !P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> M(x))) & (forall x (M(x) -> !S(x))) -> (forall x (S(x) -> !P(x))))

// === SATISFACIBILIDAD ===
check satisfiable (forall x (S(x) -> P(x)))
check satisfiable (exists x (S(x) & P(x)))
check satisfiable (exists x (S(x) & !P(x)))

// === DERIVACIÓN Y PRUEBA ===
axiom mayor = forall x (M(x) -> P(x))
axiom menor = forall x (S(x) -> M(x))
axiom particular = exists x (S(x) & M(x))
derive forall x (S(x) -> P(x)) from {mayor, menor}
derive exists x (S(x) & P(x)) from {mayor, particular}
prove forall x (S(x) -> P(x)) from {mayor, menor}
prove exists x (S(x) & P(x)) from {mayor, particular}

// === EXPLICACIÓN, ANÁLISIS Y CONTRAMODELOS ===
analyze {forall x (M(x) -> P(x)), forall x (S(x) -> M(x))} -> forall x (S(x) -> P(x))
analyze {forall x (P(x) -> M(x)), forall x (S(x) -> M(x))} -> forall x (S(x) -> P(x))
explain forall x (M(x) -> P(x))
explain exists x (S(x) & !P(x))
countermodel ((exists x (M(x) & P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
countermodel ((forall x (P(x) -> M(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
render theory
