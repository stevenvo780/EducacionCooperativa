logic classical.propositional

let p = passage([[clase-logica.md#b8]])
let phi = formalize p as (P -> Q)
claim c1 = phi
support c1 <- p
confidence c1 = 0.84
context c1 = "Si P entonces Q"
axiom base = P -> Q
axiom premisa = P
derive Q from {base, premisa}
