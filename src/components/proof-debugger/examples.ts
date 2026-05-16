import type { DebugExample } from './types';

export const PROOF_EXAMPLES: DebugExample[] = [
  {
    id: 'modus-ponens',
    name: 'Modus Ponens',
    description: 'Si P→Q y P, entonces Q.',
    profile: 'classical.propositional',
    snapshots: [
      {
        step: 1,
        formula: 'P → Q',
        justification: 'premise',
        premises: [],
        source: 'premise',
        result: 'axioma'
      },
      {
        step: 2,
        formula: 'P',
        justification: 'premise',
        premises: [],
        source: 'premise',
        result: 'axioma'
      },
      {
        step: 3,
        formula: 'Q',
        justification: '→E (1, 2)',
        premises: [1, 2],
        source: 'rule',
        result: 'derivado'
      }
    ]
  },
  {
    id: 'syllogism',
    name: 'Silogismo Hipotético',
    description: 'De P→Q y Q→R se obtiene P→R.',
    profile: 'classical.propositional',
    snapshots: [
      {
        step: 1,
        formula: 'P → Q',
        justification: 'premise',
        premises: [],
        source: 'premise',
        result: 'axioma'
      },
      {
        step: 2,
        formula: 'Q → R',
        justification: 'premise',
        premises: [],
        source: 'premise',
        result: 'axioma'
      },
      {
        step: 3,
        formula: 'P → R',
        justification: '→T (1, 2)',
        premises: [1, 2],
        source: 'rule',
        result: 'derivado'
      },
      {
        step: 4,
        formula: '¬R',
        justification: 'premise',
        premises: [],
        source: 'premise',
        result: 'axioma'
      },
      {
        step: 5,
        formula: '¬P',
        justification: 'MT (3, 4)',
        premises: [3, 4],
        source: 'rule',
        result: 'derivado'
      }
    ]
  },
  {
    id: 'countermodel',
    name: 'Contramodelo',
    description: 'P ∨ Q no implica P ∧ Q. Contramodelo: P=false, Q=true.',
    profile: 'classical.propositional',
    snapshots: [
      {
        step: 1,
        formula: 'P ∨ Q',
        justification: 'premise',
        premises: [],
        source: 'premise',
        result: 'satisfacible',
        assignments: { P: false, Q: true }
      },
      {
        step: 2,
        formula: 'P ∧ Q',
        justification: 'goal',
        premises: [],
        source: 'goal',
        result: 'falso en el modelo',
        assignments: { P: false, Q: true }
      },
      {
        step: 3,
        formula: '¬(P ∧ Q)',
        justification: 'contramodelo verificado',
        premises: [1, 2],
        source: 'semantic',
        result: 'contramodelo hallado',
        assignments: { P: false, Q: true }
      }
    ]
  }
];
