import type { ProofObligation } from './types';

export const exampleObligations: ProofObligation[] = [
  {
    id: 'th-mp',
    title: 'Modus Ponens',
    formula: '((P → Q) ∧ P) → Q',
    profile: 'classical',
    status: 'verified',
    dependencies: [],
    proof: {
      steps: [
        { formula: '(P → Q) ∧ P', justification: 'assume (antecedente)' },
        { formula: 'P → Q', justification: '∧-elim (1)' },
        { formula: 'P', justification: '∧-elim (1)' },
        { formula: 'Q', justification: '→-elim (2, 3)' },
        { formula: '((P → Q) ∧ P) → Q', justification: '→-intro (1–4)' }
      ]
    }
  },
  {
    id: 'th-syll',
    title: 'Silogismo hipotético',
    formula: '((P → Q) ∧ (Q → R)) → (P → R)',
    profile: 'classical',
    status: 'verified',
    dependencies: ['th-mp'],
    proof: {
      steps: [
        { formula: '(P → Q) ∧ (Q → R)', justification: 'assume' },
        { formula: 'P → Q', justification: '∧-elim (1)' },
        { formula: 'Q → R', justification: '∧-elim (1)' },
        { formula: 'P', justification: 'assume (sub-prueba)' },
        { formula: 'Q', justification: '→-elim (2, 4) [usa th-mp]' },
        { formula: 'R', justification: '→-elim (3, 5)' },
        { formula: 'P → R', justification: '→-intro (4–6)' },
        { formula: '((P → Q) ∧ (Q → R)) → (P → R)', justification: '→-intro (1–7)' }
      ]
    }
  },
  {
    id: 'cl-affirm-consequent',
    title: 'Afirmación del consecuente',
    formula: '((P → Q) ∧ Q) → P',
    profile: 'classical',
    status: 'failed',
    dependencies: [],
    countermodel: {
      P: false,
      Q: true,
      'P → Q': true,
      '(P → Q) ∧ Q': true,
      conclusion: 'P es falso pese a antecedente verdadero — la implicación falla'
    }
  },
  {
    id: 'cl-modal-K',
    title: 'Axioma K (modal)',
    formula: '□(P → Q) → (□P → □Q)',
    profile: 'modal-K',
    status: 'pending',
    dependencies: ['th-mp']
  }
];
