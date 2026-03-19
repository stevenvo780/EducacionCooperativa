// ST — Primer orden
// Script canónico exhaustivo del perfil classical.first_order
logic classical.first_order

set verbose = off

// === CUANTIFICADORES, INSTANCIACIÓN, GENERALIZACIÓN Y DUALIDADES ===
check valid ((forall x P(x)) -> P(a))
check valid (P(a) -> exists x P(x))
check valid (forall x (P -> P))
check valid ((forall x (P(x) -> Q(x))) -> ((forall x P(x)) -> (forall x Q(x))))
check valid ((forall x (P(x) -> Q(x))) -> ((exists x P(x)) -> (exists x Q(x))))
check valid ((forall x (P(x) -> Q(x))) -> (P(a) -> Q(a)))
check valid ((exists x P(x)) -> (forall x P(x)))
check valid forall x (x = x)
check equivalent !(exists x !P(x)), forall x P(x)
check equivalent !(forall x P(x)), exists x !P(x)

// === SATISFACIBILIDAD ===
check satisfiable (exists x P(x))
check satisfiable (exists x P(x) & exists x !P(x))
check satisfiable ((forall x (P(x) -> Q(x))) & P(a))
check satisfiable (forall x exists y R(x, y))

// === DERIVACIÓN Y PRUEBA ===
set verbose = on
axiom univ = forall x (Humano(x) -> Mortal(x))
axiom paso = forall x (Mortal(x) -> Finito(x))
axiom caso = Humano(socrates)
derive Mortal(socrates) from {univ, caso}
derive Finito(socrates) from {univ, paso, caso}
prove Finito(socrates) from {univ, paso, caso}

// === ESTADO Y FÓRMULAS CON CUANTIFICADORES ===
let witness = forall x (exists y R(x, y))
print witness
let igualdad = (x = y)
print igualdad

// === ANÁLISIS DE INFERENCIAS ===
analyze {forall x (H(x) -> M(x)), H(a)} -> M(a)
analyze {exists x P(x)} -> forall x P(x)

// === EXPLICACIÓN RICA Y CONTRAMODELOS ===
explain forall x (Humano(x) -> Mortal(x))
explain forall x exists y Relacion(x, y)
explain forall x (x = x)
countermodel ((exists x P(x)) -> forall x P(x))
countermodel ((forall x exists y R(x, y)) -> (exists y forall x R(x, y)))
render theory
