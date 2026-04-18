import { describe, expect, it } from 'vitest';

import { collectSTDiagnostics, hasSTExecutionErrors } from '@/lib/st-execution';
import { evaluate } from '@/lib/st-api';

describe('st execution helpers', () => {
  it('surfaces nested command errors even when the runtime returns ok=true', () => {
    const result = evaluate('logic classical.propositional\ncheck satisfiable (forall x P(x))');

    expect(result.ok).toBe(true);
    expect(result.diagnostics ?? []).toHaveLength(0);
    expect(collectSTDiagnostics(result)).toEqual([
      expect.objectContaining({
        severity: 'error',
        message: "'forall' no esta soportado en logica proposicional clasica"
      })
    ]);
    expect(hasSTExecutionErrors(result)).toBe(true);
  });

  it('keeps top-level runtime warnings visible alongside command diagnostics', () => {
    const result = evaluate('logic classical.propositional\nclaim demo = P');
    const diagnostics = collectSTDiagnostics(result);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: "Referencia 'P' no encontrada para claim 'demo'"
      })
    ]);
    expect(hasSTExecutionErrors(result)).toBe(false);
  });
});
