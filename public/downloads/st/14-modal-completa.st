// ST — Modal K: exhaustiva
logic modal.k

// === OPERADORES MODALES ===
// [] — necesidad (box)
// <> — posibilidad (diamond)

// --- Axioma K (distribución) ---
check valid ([](P -> Q) -> ([]P -> []Q))

// --- Dualidad ---
check equivalent ([]P), (!<>(!P))
check equivalent (<>P), (![](!P))

// --- NO válido en K (requiere reflexividad) ---
check valid ([]P -> P)
check valid (<>P -> P)

// --- Satisfacibilidad ---
check satisfiable ([]P & <>!P)
check satisfiable (<>P & <>!P)
check satisfiable ([]P)

// --- Derivación modal ---
axiom nec = [](P -> Q)
axiom nec2 = []P
derive []Q from {nec, nec2}
