import { describe, expect, it } from 'vitest';

import {
  compareDiagnosticsForOverlay,
  compareDiagnosticsForSharedRange,
  getDiagnosticPriority
} from '@/lib/markdown-linter/diagnostic-priority';

describe('diagnostic priority helpers', () => {
  it('da menor prioridad a ST-Definitions que a warnings y errors en el mismo rango', () => {
    const stDefinition = { line: 3, column: 8, severity: 'info' as const, source: 'ST-Definitions' };
    const spellingWarning = { line: 3, column: 8, severity: 'warning' as const, source: 'Spelling' };
    const hardError = { line: 3, column: 8, severity: 'error' as const, source: 'Structure' };

    expect(getDiagnosticPriority(stDefinition)).toBeLessThan(getDiagnosticPriority(spellingWarning));
    expect(getDiagnosticPriority(spellingWarning)).toBeLessThan(getDiagnosticPriority(hardError));
  });

  it('prioriza diagnósticos más fuertes al reclamar un rango compartido', () => {
    const diagnostics = [
      { line: 4, column: 2, severity: 'info' as const, source: 'ST-Definitions' },
      { line: 4, column: 2, severity: 'warning' as const, source: 'Spelling' },
      { line: 4, column: 2, severity: 'error' as const, source: 'Structure' }
    ].sort(compareDiagnosticsForSharedRange);

    expect(diagnostics.map((diagnostic) => diagnostic.source)).toEqual([
      'Structure',
      'Spelling',
      'ST-Definitions'
    ]);
  });

  it('pinta primero los diagnósticos más débiles para que los fuertes queden encima en overlay', () => {
    const diagnostics = [
      { line: 7, column: 5, severity: 'warning' as const, source: 'Spelling' },
      { line: 7, column: 5, severity: 'info' as const, source: 'ST-Definitions' },
      { line: 7, column: 5, severity: 'error' as const, source: 'Structure' }
    ].sort(compareDiagnosticsForOverlay);

    expect(diagnostics.map((diagnostic) => diagnostic.source)).toEqual([
      'ST-Definitions',
      'Spelling',
      'Structure'
    ]);
  });
});