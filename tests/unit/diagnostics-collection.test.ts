import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDiagnosticsCollection,
  publishDiagnostics,
  clearDiagnostics,
  getAllDiagnostics
} from '@/lib/diagnostics-bus';

describe('createDiagnosticsCollection', () => {
  beforeEach(() => clearDiagnostics());

  it('múltiples collections con diferentes sources no se pisan', () => {
    const md = createDiagnosticsCollection('md');
    const st = createDiagnosticsCollection('st');
    md.set('doc-1', [{ severity: 'warning', message: 'md a' }]);
    st.set('doc-1', [{ severity: 'error', message: 'st b' }]);
    const all = getAllDiagnostics();
    expect(all).toHaveLength(2);
    expect(all.find((d) => d.source === 'md' && d.message === 'md a')).toBeDefined();
    expect(all.find((d) => d.source === 'st' && d.message === 'st b')).toBeDefined();
  });

  it('dispose() limpia solo las del source propio', () => {
    const md = createDiagnosticsCollection('md');
    const st = createDiagnosticsCollection('st');
    md.set('doc-1', [{ severity: 'warning', message: 'a' }]);
    st.set('doc-1', [{ severity: 'error', message: 'b' }]);
    md.dispose();
    const remaining = getAllDiagnostics();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].source).toBe('st');
  });

  it('actualizaciones múltiples sobre el mismo doc no acumulan', () => {
    const md = createDiagnosticsCollection('md');
    for (let i = 0; i < 5; i++) {
      md.set('doc-1', [
        { severity: 'warning', message: `v${i}-a` },
        { severity: 'warning', message: `v${i}-b` }
      ]);
    }
    const all = getAllDiagnostics();
    expect(all).toHaveLength(2);
    expect(all.every((d) => d.message.startsWith('v4-'))).toBe(true);
  });

  it('publishDiagnostics directo funciona igual que la collection', () => {
    publishDiagnostics('md', 'doc-1', [{ severity: 'warning', message: 'a' }]);
    const md = createDiagnosticsCollection('md');
    md.set('doc-2', [{ severity: 'error', message: 'b' }]);
    expect(getAllDiagnostics()).toHaveLength(2);
  });

  it('soporta items con range completo y actions', () => {
    const md = createDiagnosticsCollection('md');
    md.set('doc-1', [{
      severity: 'warning',
      code: 'MD013',
      message: 'línea > 80 chars',
      range: { startLine: 12, startColumn: 81, endLine: 12, endColumn: 120 },
      actions: [
        { id: 'wrap', label: 'Reformatear' },
        { id: 'ignore', label: 'Ignorar regla', kind: 'source' }
      ]
    }]);
    const d = getAllDiagnostics()[0];
    expect(d.code).toBe('MD013');
    expect(d.range?.startColumn).toBe(81);
    expect(d.range?.endLine).toBe(12);
    expect(d.actions).toHaveLength(2);
    expect(d.actions?.[1].kind).toBe('source');
  });
});
