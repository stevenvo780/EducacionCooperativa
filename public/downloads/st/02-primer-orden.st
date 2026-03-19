// ST — Primer orden
logic classical.first_order

// === CUANTIFICADORES, INSTANCIACIÓN Y DUALIDADES ===
check valid ((forall x P(x)) -> P(a))
check valid (P(a) -> exists x P(x))
check valid ((forall x (P(x) -> Q(x))) -> ((forall x P(x)) -> (forall x Q(x))))
check valid ((forall x (P(x) -> Q(x))) -> (P(a) -> Q(a)))
check valid forall x (x = x)
check equivalent !(exists x !P(x)), forall x P(x)
check equivalent !(forall x P(x)), exists x !P(x)

// === SATISFACIBILIDAD ===
check satisfiable (exists x P(x))
check satisfiable (exists x P(x) & exists x !P(x))
check satisfiable ((forall x (P(x) -> Q(x))) & P(a))

// === DERIVACIÓN Y PRUEBA ===
axiom univ = forall x (Humano(x) -> Mortal(x))
axiom paso = forall x (Mortal(x) -> Finito(x))
axiom caso = Humano(socrates)
derive Mortal(socrates) from {univ, caso}
derive Finito(socrates) from {univ, paso, caso}
prove Finito(socrates) from {univ, paso, caso}

// === ANÁLISIS DE INFERENCIAS ===
analyze {forall x (H(x) -> M(x)), H(a)} -> M(a)
analyze {exists x P(x)} -> forall x P(x)

// === EXPLICACIÓN Y CONTRAMODELOS ===
explain forall x (Humano(x) -> Mortal(x))
countermodel ((exists x P(x)) -> forall x P(x))
countermodel ((forall x exists y R(x, y)) -> (exists y forall x R(x, y)))
render theory
