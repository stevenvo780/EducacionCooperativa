logic aristotelian.syllogistic

check valid ((forall x (M(x) -> P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
check valid ((forall x (M(x) -> !P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((exists x (M(x) & P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
