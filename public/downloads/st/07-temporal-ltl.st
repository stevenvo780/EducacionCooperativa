logic temporal.ltl

check valid ([](P) -> P)
check valid ([](P) -> <>(P))
check valid (<>(P) -> [](P))
check valid ([](P) -> next P)
