logic classical.first_order

check valid ((forall x P(x)) -> P(a))
check valid (P(a) -> exists x P(x))
check satisfiable (exists x P(x) & exists x !P(x))
