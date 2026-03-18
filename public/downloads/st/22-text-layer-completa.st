// ST — Text Layer: exhaustiva
logic classical.propositional

// === PASO 1: Pasaje ===
// Vincula un fragmento textual a un ancla de documento
let p1 = passage([[documento.md#seccion-1]])
let p2 = passage([[documento.md#seccion-2]])

// === PASO 2: Formalización ===
// Convierte el pasaje en una fórmula lógica
let f1 = formalize p1 as (P -> Q)
let f2 = formalize p2 as (P)

// === PASO 3: Claims ===
// Registra las formalizaciones como afirmaciones verificables
claim c1 = f1
claim c2 = f2

// === PASO 4: Metadatos ===
support c1 <- p1
support c2 <- p2
confidence c1 = 0.90
confidence c2 = 0.85
context c1 = "Si se cumple la condición P, entonces se cumple Q"
context c2 = "La condición P se satisface"

// === PASO 5: Uso en razonamiento ===
axiom base = P -> Q
axiom premisa = P
derive Q from {base, premisa}

// === VERIFICACIONES ===
check valid (P -> P)
check satisfiable (P & Q)
truth_table (P -> Q)
