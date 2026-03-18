// ST — Intuicionista proposicional: exhaustiva
logic intuitionistic.propositional

// === VÁLIDAS EN IPC ===
check valid (P -> P)
check valid (P -> !!P)
check valid ((P -> Q) -> (!Q -> !P))
check valid ((P & !P) -> Q)
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((P & Q) -> P)
check valid (P -> (P | Q))

// === RECHAZADAS EN IPC (válidas clásicamente) ===
check valid (P | !P)
check valid (!!P -> P)
check valid (((P -> Q) -> P) -> P)
check valid ((!P -> !Q) -> (Q -> P))

// === SATISFACIBILIDAD ===
check satisfiable (P & Q)
check satisfiable (!P)
check satisfiable (P | !P)

// === CONTRAMODELO ===
countermodel (P | !P)
countermodel (!!P -> P)

// === EQUIVALENCIAS ===
check equivalent (P -> Q), (P -> Q)
check equivalent (!(P & Q)), (P -> !Q)
