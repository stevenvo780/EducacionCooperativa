import { describe, expect, it } from 'vitest';
import { buildDocumentBlobRevisionKey } from '@/lib/document-blob-revision';

describe('document blob revision key', () => {
  it('cambia cuando el agente sobrescribe el mismo storagePath', () => {
    const path = 'workspaces/ws-1/notas/resumen.md';
    const before = buildDocumentBlobRevisionKey({
      storagePath: path,
      updatedAt: { _seconds: 1_777_000_000, _nanoseconds: 100 }
    });
    const after = buildDocumentBlobRevisionKey({
      storagePath: path,
      updatedAt: { _seconds: 1_777_000_001, _nanoseconds: 200 }
    });

    expect(after).not.toBe(before);
  });

  it('mantiene la misma clave para snapshots repetidos de la misma revisión', () => {
    const input = {
      storagePath: 'workspaces/ws-1/notas/resumen.md',
      updatedAt: { seconds: 1_777_000_000, nanoseconds: 123 }
    };

    expect(buildDocumentBlobRevisionKey(input)).toBe(buildDocumentBlobRevisionKey(input));
  });

  it('conserva compatibilidad cuando no viene updatedAt', () => {
    expect(buildDocumentBlobRevisionKey({ storagePath: 'workspaces/ws-1/a.md' }))
      .toBe('workspaces/ws-1/a.md');
  });
});
