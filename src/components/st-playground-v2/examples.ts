export interface StV2Example {
  id: string;
  title: string;
  description: string;
  source: string;
}

export const ST_PLAYGROUND_V2_EXAMPLES: StV2Example[] = [
  {
    id: 'modus-ponens',
    title: 'Modus Ponens + contrapositiva',
    description: 'Derivación clásica + check de la contrapositiva.',
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
    description: 'Tabla de verdad de (P ∧ Q) ∨ (¬P ∧ ¬Q).',
    source: `logic classical.propositional

truth_table ((P & Q) | (!P & !Q))
check valid (P -> (Q -> P))
`
  },
  {
    id: 'counter-model',
    title: 'Contramodelo',
    description: '((P→Q)→(Q→P)) no es válida — produce contramodelo.',
    source: `logic classical.propositional

countermodel ((P -> Q) -> (Q -> P))
check valid ((P & Q) -> (P | Q))
`
  },
  {
    id: 'belnap',
    title: 'Belnap paraconsistente',
    description: 'En Belnap una contradicción no trivializa.',
    source: `logic paraconsistent.belnap

axiom a1 : P
axiom a2 : !P

check satisfiable (P & !P)
check valid (Q | !Q)
`
  }
];
