import { describe, it, expect, beforeEach } from 'vitest';
import {
  publishDiagnostics,
  clearDiagnostics,
  clearDiagnosticsFor,
  subscribeDiagnostics,
  getAllDiagnostics,
  createDiagnosticsCollection,
  type ResolvedDiagnostic
} from '@/lib/diagnostics-bus';

describe('diagnostics-bus', () => {
  beforeEach(() => {
    clearDiagnostics();
  });

  it('publishDiagnostics agrega entradas resolved con id, source y uri', () => {
    publishDiagnostics('md', 'doc-1', [
      { severity: 'warning', message: 'línea muy larga', code: 'MD013' }
    ]);
    const all = getAllDiagnostics();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      source: 'md',
      uri: 'doc-1',
      severity: 'warning',
      message: 'línea muy larga',
      code: 'MD013'
    });
    expect(all[0].id).toBeTruthy();
    expect(all[0].publishedAt).toBeGreaterThan(0);
  });

  it('publicar dos veces sobre (source, uri) reemplaza, no acumula', () => {
    publishDiagnostics('md', 'doc-1', [
      { severity: 'warning', message: 'a' },
      { severity: 'error', message: 'b' }
    ]);
    publishDiagnostics('md', 'doc-1', [
      { severity: 'info', message: 'c' }
    ]);
    const all = getAllDiagnostics();
    expect(all).toHaveLength(1);
    expect(all[0].message).toBe('c');
    expect(all[0].severity).toBe('info');
  });

  it('publicar [] limpia el bucket de (source, uri)', () => {
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    publishDiagnostics('md', 'doc-1', []);
    expect(getAllDiagnostics()).toHaveLength(0);
  });

  it('mantiene buckets separados por source y por uri', () => {
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    publishDiagnostics('st', 'doc-1', [{ severity: 'error', message: 'b' }]);
    publishDiagnostics('md', 'doc-2', [{ severity: 'info', message: 'c' }]);
    expect(getAllDiagnostics()).toHaveLength(3);
  });

  it('clearDiagnostics(source) elimina solo ese origen', () => {
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    publishDiagnostics('st', 'doc-1', [{ severity: 'error', message: 'b' }]);
    clearDiagnostics('md');
    const remaining = getAllDiagnostics();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].source).toBe('st');
  });

  it('clearDiagnosticsFor(source, uri) elimina solo ese par', () => {
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    publishDiagnostics('md', 'doc-2', [{ severity: 'warning', message: 'b' }]);
    clearDiagnosticsFor('md', 'doc-1');
    const remaining = getAllDiagnostics();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].uri).toBe('doc-2');
  });

  it('subscribeDiagnostics emite snapshot inicial y en cada cambio', () => {
    const snapshots: ResolvedDiagnostic[][] = [];
    const unsubscribe = subscribeDiagnostics((s) => snapshots.push(s));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toHaveLength(0);

    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toHaveLength(1);

    unsubscribe();
    publishDiagnostics('md', 'doc-1', [{ severity: 'error', message: 'b' }]);
    expect(snapshots).toHaveLength(2); // ya desuscrito
  });

  it('createDiagnosticsCollection encapsula source y expone set/clear/dispose', () => {
    const col = createDiagnosticsCollection('test-linter');
    col.set('doc-1', [{ severity: 'warning', message: 'a' }]);
    col.set('doc-2', [{ severity: 'error', message: 'b' }]);
    expect(getAllDiagnostics()).toHaveLength(2);

    col.clear('doc-1');
    expect(getAllDiagnostics()).toHaveLength(1);
    expect(getAllDiagnostics()[0].uri).toBe('doc-2');

    col.dispose();
    expect(getAllDiagnostics()).toHaveLength(0);
  });

  it('genera id estable cuando no se proporciona', () => {
    publishDiagnostics('md', 'doc-1', [
      { severity: 'warning', message: 'a' },
      { severity: 'warning', message: 'b' }
    ]);
    const ids = getAllDiagnostics().map((d) => d.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('respeta id explícito si se proporciona', () => {
    publishDiagnostics('md', 'doc-1', [
      { id: 'fixed-id', severity: 'warning', message: 'a' }
    ]);
    expect(getAllDiagnostics()[0].id).toBe('fixed-id');
  });

  it('preserva range, detail y actions del input', () => {
    publishDiagnostics('md', 'doc-1', [{
      severity: 'warning',
      message: 'a',
      detail: 'detalle largo',
      range: { startLine: 10, startColumn: 5, endLine: 10, endColumn: 80 },
      actions: [{ id: 'fix', label: 'Reformatear', kind: 'quickfix' }]
    }]);
    const d = getAllDiagnostics()[0];
    expect(d.detail).toBe('detalle largo');
    expect(d.range).toEqual({ startLine: 10, startColumn: 5, endLine: 10, endColumn: 80 });
    expect(d.actions).toHaveLength(1);
    expect(d.actions?.[0].id).toBe('fix');
  });
});
