// ST — Silogística aristotélica
// Script canónico exhaustivo del perfil aristotelian.syllogistic
logic aristotelian.syllogistic

set verbose = off

// === LOS 19 MODOS VÁLIDOS REALMENTE CODIFICADOS ===
check valid ((forall x (M(x) -> P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
check valid ((forall x (M(x) -> !P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (M(x) -> P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (M(x) -> !P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (P(x) -> M(x))) & (forall x (S(x) -> !M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> M(x))) & (exists x (S(x) & !M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (M(x) -> P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((exists x (M(x) & P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (M(x) -> P(x))) & (exists x (M(x) & S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (M(x) -> !P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & !P(x))))
check valid ((exists x (M(x) & !P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (M(x) -> !P(x))) & (exists x (M(x) & S(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> M(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (P(x) -> M(x))) & (forall x (M(x) -> !S(x))) -> (forall x (S(x) -> !P(x))))
check valid ((exists x (P(x) & M(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (P(x) -> !M(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (exists x (M(x) & S(x))) -> (exists x (S(x) & !P(x))))

// === PROPOSICIONES A / E / I / O ===
check satisfiable (forall x (S(x) -> P(x)))
check satisfiable (forall x (S(x) -> !P(x)))
check satisfiable (exists x (S(x) & P(x)))
check satisfiable (exists x (S(x) & !P(x)))

// === DERIVACIÓN COMPLETA Y ENTIMEMA ===
set verbose = on
axiom mayor = forall x (M(x) -> P(x))
axiom menor = forall x (S(x) -> M(x))
axiom particular = exists x (S(x) & M(x))
derive forall x (S(x) -> P(x)) from {mayor, menor}
derive exists x (S(x) & P(x)) from {mayor, particular}
prove forall x (S(x) -> P(x)) from {mayor, menor}
prove exists x (S(x) & P(x)) from {mayor, particular}

// Una sola premisa: el perfil debe sugerir la premisa faltante cuando reconoce el entimema.
derive forall x (S(x) -> P(x)) from {mayor}

// === CUADRO DE OPOSICIÓN, ANÁLISIS Y CASOS INVÁLIDOS ===
analyze {forall x (M(x) -> P(x)), forall x (S(x) -> M(x))} -> forall x (S(x) -> P(x))
analyze {forall x (P(x) -> M(x)), forall x (S(x) -> M(x))} -> forall x (S(x) -> P(x))
explain forall x (M(x) -> P(x))
explain forall x (M(x) -> !P(x))
explain exists x (S(x) & P(x))
explain exists x (S(x) & !P(x))

// === CONTRAMODELOS ===
countermodel ((exists x (M(x) & P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
countermodel ((forall x (P(x) -> M(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
render theory
