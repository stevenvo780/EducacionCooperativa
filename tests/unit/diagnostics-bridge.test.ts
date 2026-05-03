import { describe, it, expect, beforeEach } from 'vitest';
import {
  publishDiagnostics,
  clearDiagnostics,
  getAllDiagnostics
} from '@/lib/diagnostics-bus';

describe('diagnostics-bus integration', () => {
  beforeEach(() => clearDiagnostics());

  it('soporta múltiples linters publicando para el mismo doc sin pisarse', () => {
    publishDiagnostics('markdown-linter', 'doc-A', [
      { severity: 'warning', code: 'MD013', message: 'Línea > 80', range: { startLine: 12 } }
    ]);
    publishDiagnostics('st-linter', 'doc-A', [
      { severity: 'error', code: 'ST/E001', message: 'Sintaxis inválida', range: { startLine: 5 } }
    ]);
    const all = getAllDiagnostics();
    expect(all).toHaveLength(2);
    expect(all.some((d) => d.source === 'markdown-linter')).toBe(true);
    expect(all.some((d) => d.source === 'st-linter')).toBe(true);
  });

  it('reemplazo selectivo: actualizar md no afecta st', () => {
    publishDiagnostics('markdown-linter', 'doc-A', [
      { severity: 'warning', message: 'a' }
    ]);
    publishDiagnostics('st-linter', 'doc-A', [
      { severity: 'error', message: 'b' }
    ]);
    publishDiagnostics('markdown-linter', 'doc-A', [
      { severity: 'info', message: 'c' }
    ]);
    const all = getAllDiagnostics();
    const md = all.filter((d) => d.source === 'markdown-linter');
    const st = all.filter((d) => d.source === 'st-linter');
    expect(md).toHaveLength(1);
    expect(md[0].message).toBe('c');
    expect(st).toHaveLength(1);
    expect(st[0].message).toBe('b');
  });

  it('publishedAt es monotónico creciente entre publicaciones consecutivas', async () => {
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    const t1 = getAllDiagnostics()[0].publishedAt;
    await new Promise((r) => setTimeout(r, 5));
    publishDiagnostics('md', 'doc-2', [{ severity: 'warning', message: 'b' }]);
    const items = getAllDiagnostics();
    const t2 = items.find((i) => i.uri === 'doc-2')!.publishedAt;
    expect(t2).toBeGreaterThanOrEqual(t1);
  });

  it('preserva orden de items dentro del bucket', () => {
    publishDiagnostics('md', 'doc-1', [
      { severity: 'warning', message: 'primero' },
      { severity: 'warning', message: 'segundo' },
      { severity: 'warning', message: 'tercero' }
    ]);
    const all = getAllDiagnostics();
    expect(all.map((d) => d.message)).toEqual(['primero', 'segundo', 'tercero']);
  });

  it('uri="global" se trata como cualquier otro bucket', () => {
    publishDiagnostics('runtime', 'global', [
      { severity: 'error', message: 'crash' }
    ]);
    const all = getAllDiagnostics();
    expect(all).toHaveLength(1);
    expect(all[0].uri).toBe('global');
  });
});
