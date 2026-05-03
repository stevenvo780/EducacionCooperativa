import { describe, it, expect, beforeEach } from 'vitest';
import {
  publishDiagnostics,
  clearDiagnostics,
  subscribeDiagnostics,
  installDiagnosticsBus,
  type ResolvedDiagnostic
} from '@/lib/diagnostics-bus';

describe('diagnostics-bus listeners', () => {
  beforeEach(() => {
    clearDiagnostics();
  });

  it('multiple listeners reciben el mismo snapshot', () => {
    const snapsA: ResolvedDiagnostic[][] = [];
    const snapsB: ResolvedDiagnostic[][] = [];
    const unA = subscribeDiagnostics((s) => snapsA.push(s));
    const unB = subscribeDiagnostics((s) => snapsB.push(s));
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    expect(snapsA[snapsA.length - 1]).toEqual(snapsB[snapsB.length - 1]);
    unA();
    unB();
  });

  it('un listener que falla no rompe a los demás', () => {
    const snaps: ResolvedDiagnostic[][] = [];
    const unA = subscribeDiagnostics(() => { throw new Error('boom'); });
    const unB = subscribeDiagnostics((s) => snaps.push(s));
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    expect(snaps.length).toBeGreaterThanOrEqual(1);
    unA();
    unB();
  });

  it('installDiagnosticsBus captura console.error y publica como source=console', () => {
    const snaps: ResolvedDiagnostic[][] = [];
    const un = subscribeDiagnostics((s) => snaps.push(s));

    installDiagnosticsBus();
    const origError = console.error;
    try {
      console.error('boom error de prueba');
    } finally {
      console.error = origError;
    }

    const last = snaps[snaps.length - 1];
    const consoleEntry = last?.find((e) => e.source === 'console' && e.message.includes('boom'));
    expect(consoleEntry).toBeDefined();
    expect(consoleEntry?.severity).toBe('error');
    un();
  });

  it('no entra en loop infinito si un listener publica recursivamente', () => {
    let calls = 0;
    const un = subscribeDiagnostics(() => {
      calls += 1;
      if (calls > 100) return;
      // Listener malicioso que publica dentro del propio emit. El guard
      // de re-entrancy debe absorberlo.
      publishDiagnostics('recursive', 'global', [
        { severity: 'warning', message: `loop-${calls}` }
      ]);
    });

    publishDiagnostics('init', 'global', [{ severity: 'warning', message: 'start' }]);

    // Sin el guard, calls explotaría hasta stack overflow. Con guard +
    // cap MAX_EMIT_DEPTH, queda acotado a unas pocas iteraciones.
    expect(calls).toBeLessThan(20);
    un();
  });

  it('console.warn acumula entradas en el bucket console', () => {
    installDiagnosticsBus();
    const snaps: ResolvedDiagnostic[][] = [];
    const un = subscribeDiagnostics((s) => snaps.push(s));
    console.warn('warn-uno-único');
    console.warn('warn-dos-único');
    const last = snaps[snaps.length - 1];
    const matches = last.filter((e) => e.source === 'console' && /único/.test(e.message));
    expect(matches.length).toBeGreaterThanOrEqual(2);
    un();
  });
});
