export interface StPlaygroundExample {
  id: string;
  title: string;
  description: string;
  profile: string;
  source: string;
}

export const ST_PLAYGROUND_EXAMPLES: StPlaygroundExample[] = [
  {
    id: 'modus-ponens',
    title: 'Modus Ponens',
    description: 'Derivación clásica: de P→Q y P obtenemos Q.',
    profile: 'classical.propositional',
    source: `logic classical.propositional

axiom a1 : P -> Q
axiom a2 : P

derive Q from {a1, a2}
check valid ((P -> Q) -> (!Q -> !P))
`
  },
  {
    id: 'truth-table',
    title: 'Tabla de verdad',
    description: 'Genera la tabla de verdad de una fórmula proposicional.',
    profile: 'classical.propositional',
    source: `logic classical.propositional

truth_table ((P & Q) | (!P & !Q))
check valid (P -> (Q -> P))
`
  },
  {
    id: 'belnap',
    title: 'Belnap paraconsistente',
    description: 'En Belnap una contradicción no trivializa la teoría.',
    profile: 'paraconsistent.belnap',
    source: `logic paraconsistent.belnap

axiom a1 : P
axiom a2 : !P

check satisfiable (P & !P)
check valid (Q | !Q)
`
  },
  {
    id: 'counter-model',
    title: 'Contramodelo',
    description: 'Una fórmula no válida produce un contramodelo explícito.',
    profile: 'classical.propositional',
    source: `logic classical.propositional

countermodel ((P -> Q) -> (Q -> P))
check valid ((P & Q) -> (P | Q))
`
  }
];
