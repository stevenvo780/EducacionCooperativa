import { describe, expect, it } from 'vitest';

import {
  check,
  evaluate
} from '@/lib/st-api';

describe('st compatibility layer', () => {
  it('normalizes unicode propositional connectives', () => {
    const result = evaluate('logic classical.propositional\ncheck valid ((P → Q) → (¬Q → ¬P))');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('valid');
  });

  it('supports premise/conclusion classroom syntax', () => {
    const result = evaluate('logic classical.propositional\npremise h1 : P -> Q\npremise h2 : P\nconclusion Q');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
    expect(result.results?.[0]?.reasoningType).toBe('Modus Ponens');
  });

  it('supports turnstile notation', () => {
    const result = evaluate('logic classical.propositional\n{P -> Q, P} ⊢ Q');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });

  it('supports anonymous formulas inside derive blocks', () => {
    const result = evaluate('logic classical.propositional\nderive Q from {(P -> Q), P}');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });

  it('auto-names bare assumptions', () => {
    const result = evaluate('logic classical.propositional\nassume P\nshow P\nqed');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });

  it('uses named formulas when therefore closes an argument', () => {
    const result = evaluate('logic classical.propositional\naxiom regla = P -> Q\naxiom base = P\ntherefore Q');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });

  it('keeps validation green for compatibility syntax', () => {
    const diagnostics = check('logic classical.propositional\npremisa P ∨ Q\npremisa ¬P\npor_tanto Q').diagnostics ?? [];

    expect(diagnostics).toHaveLength(0);
  });
});
