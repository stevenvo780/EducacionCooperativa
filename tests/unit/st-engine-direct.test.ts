import { describe, expect, it } from 'vitest';

import {
  check,
  createInterpreter,
  evaluate,
  parse
} from '@stevenvo780/st-lang/api';

describe('st engine direct compatibility', () => {
  it('accepts unicode connectives directly in the engine', () => {
    const result = evaluate('logic classical.propositional\ncheck valid ((P → Q) → (¬Q → ¬P))');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('valid');
  });

  it('accepts premise/conclusion syntax directly in the engine', () => {
    const result = evaluate('logic classical.propositional\npremise h1 : P -> Q\npremise h2 : P\nconclusion Q');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
    expect(result.results?.[0]?.reasoningType).toBe('Modus Ponens');
  });

  it('accepts sequent notation directly in the engine', () => {
    const result = evaluate('logic classical.propositional\n{P -> Q, P} ⊢ Q');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });

  it('accepts anonymous premises inside derive directly in the engine', () => {
    const result = evaluate('logic classical.propositional\nderive Q from {(P -> Q), P}');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });

  it('accepts unnamed assume directly in the engine', () => {
    const result = evaluate('logic classical.propositional\nassume P\nshow P\nqed');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });

  it('keeps parse and check green for spanish classroom syntax', () => {
    const source = 'logic classical.propositional\npremisa P ∨ Q\npremisa ¬P\npor_tanto Q';
    const parsed = parse(source);
    const checked = check(source);

    expect(parsed.ok).toBe(true);
    expect(parsed.diagnostics ?? []).toHaveLength(0);
    expect(checked.ok).toBe(true);
    expect(checked.diagnostics ?? []).toHaveLength(0);
  });

  it('supports premise buffers in createInterpreter directly in the engine api', () => {
    const interpreter = createInterpreter();

    interpreter.exec('logic classical.propositional');
    interpreter.exec('premise P -> Q');
    interpreter.exec('premise P');
    const result = interpreter.exec('conclusion Q');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(result.results?.[0]?.status).toBe('provable');
  });
});
