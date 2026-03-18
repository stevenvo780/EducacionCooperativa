// ST — Clásica proposicional: exhaustiva
logic classical.propositional

// === OPERADORES BASE ===
// & (conjunción), | (disyunción), ! (negación)
// -> (implicación), <-> (bicondicional)

// --- Tautologías clásicas ---
check valid (P -> P)
check valid (P | !P)
check valid (!!P -> P)
check valid ((P -> Q) -> (!Q -> !P))
check valid ((P & (P -> Q)) -> Q)
check valid (((P -> Q) & (Q -> R)) -> (P -> R))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((!P -> !Q) -> (Q -> P))
check valid ((P <-> Q) -> (P -> Q))
check valid ((P <-> Q) -> (Q -> P))

// --- Contradicciones ---
check satisfiable (P & !P)
check valid (!(P & !P))

// --- Satisfacibilidad (no tautologías) ---
check satisfiable (P & Q)
check satisfiable (P -> Q)
check satisfiable (!P)

// --- Derivación con reglas ---
axiom mp1 = P -> Q
axiom mp2 = Q -> R
axiom mp3 = P
derive Q from {mp1, mp3}
derive R from {mp2, mp3, mp1}

// --- Equivalencias ---
check equivalent (P -> Q), (!P | Q)
check equivalent (!(P & Q)), (!P | !Q)
check equivalent (!(P | Q)), (!P & !Q)
check equivalent (P <-> Q), ((P -> Q) & (Q -> P))

// --- Tabla de verdad ---
truth_table (P -> Q)
truth_table (P & Q & R)

// --- Contramodelo ---
countermodel (P -> Q)
countermodel (P & Q)
