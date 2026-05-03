import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('respeta orden inverso: el más reciente primero dentro del mismo source console', () => {
    installDiagnosticsBus();
    const snaps: ResolvedDiagnostic[][] = [];
    const un = subscribeDiagnostics((s) => snaps.push(s));
    console.warn('primer warn');
    console.warn('segundo warn');
    const last = snaps[snaps.length - 1];
    const consoleEntries = last.filter((e) => e.source === 'console');
    // el más reciente debe estar antes en el array (unshift)
    const idxSecond = consoleEntries.findIndex((e) => e.message.includes('segundo'));
    const idxFirst = consoleEntries.findIndex((e) => e.message.includes('primer'));
    expect(idxSecond).toBeGreaterThanOrEqual(0);
    expect(idxFirst).toBeGreaterThan(idxSecond);
    un();
  });
});
