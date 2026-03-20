import { describe, expect, it } from 'vitest';

import {
  getSemanticDefinition,
  getSemanticSymbols,
  getStaticSemanticCompletions
} from '@/components/editor/codemirror/st-semantic';

const SOURCE = `logic classical.propositional

theory Algebra {
  axiom neutral : (P -> P)
}

axiom base : P
`;

describe('st semantic helpers', () => {
  it('lists semantic symbols including theory members', () => {
    const names = getSemanticSymbols(SOURCE).map((symbol) => symbol.name);

    expect(names).toContain('Algebra');
    expect(names).toContain('Algebra.neutral');
    expect(names).toContain('base');
  });

  it('resolves qualified member definitions from semantic symbols', () => {
    const definition = getSemanticDefinition(SOURCE, 'Algebra.neutral');

    expect(definition).toMatchObject({ line: 4, column: 3 });
  });

  it('exposes static semantic completions from st-lang', () => {
    const labels = getStaticSemanticCompletions().map((completion) => completion.label);

    expect(labels).toContain('logic arithmetic');
    expect(labels).toContain('render');
    expect(labels).toContain('truth_table');
  });
});
