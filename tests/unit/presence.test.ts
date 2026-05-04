import { describe, expect, it } from 'vitest';
import { colorForUser, deduplicateByUser, viewersOfDoc, type PresenceEntry } from '@/lib/presence';

function entry(partial: Partial<PresenceEntry> & { userId: string; sessionId: string }): PresenceEntry {
  return {
    sessionId: partial.sessionId,
    userId: partial.userId,
    displayName: partial.displayName ?? `User ${partial.userId}`,
    color: partial.color ?? '#000000',
    joinedAt: partial.joinedAt ?? Date.now(),
    lastSeen: partial.lastSeen ?? Date.now(),
    ...(partial.photoURL ? { photoURL: partial.photoURL } : {}),
    ...(partial.currentDocId ? { currentDocId: partial.currentDocId } : {})
  };
}

describe('colorForUser', () => {
  it('devuelve el mismo color para el mismo userId (estable)', () => {
    expect(colorForUser('alice')).toBe(colorForUser('alice'));
    expect(colorForUser('bob-123')).toBe(colorForUser('bob-123'));
  });

  it('devuelve un color de la paleta predefinida', () => {
    const color = colorForUser('test');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('userIds distintos suelen producir colores distintos', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(colorForUser));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('deduplicateByUser', () => {
  it('descarta sesiones duplicadas del mismo usuario, preservando la más reciente', () => {
    const old = entry({ userId: 'u1', sessionId: 's1', lastSeen: 1000, currentDocId: 'doc-old' });
    const fresh = entry({ userId: 'u1', sessionId: 's2', lastSeen: 5000, currentDocId: 'doc-new' });
    const result = deduplicateByUser([old, fresh]);
    expect(result).toHaveLength(1);
    expect(result[0]!.sessionId).toBe('s2');
    expect(result[0]!.currentDocId).toBe('doc-new');
  });

  it('mantiene usuarios distintos', () => {
    const a = entry({ userId: 'u1', sessionId: 's1' });
    const b = entry({ userId: 'u2', sessionId: 's2' });
    expect(deduplicateByUser([a, b])).toHaveLength(2);
  });

  it('lista vacía devuelve vacía', () => {
    expect(deduplicateByUser([])).toEqual([]);
  });
});

describe('viewersOfDoc', () => {
  const entries = [
    entry({ userId: 'a', sessionId: 'sa', currentDocId: 'doc-1' }),
    entry({ userId: 'b', sessionId: 'sb', currentDocId: 'doc-1' }),
    entry({ userId: 'c', sessionId: 'sc', currentDocId: 'doc-2' }),
    entry({ userId: 'd', sessionId: 'sd' })
  ];

  it('filtra por docId', () => {
    expect(viewersOfDoc(entries, 'doc-1').map((e) => e.userId)).toEqual(['a', 'b']);
  });

  it('excluye la sesión propia', () => {
    expect(viewersOfDoc(entries, 'doc-1', 'sa').map((e) => e.userId)).toEqual(['b']);
  });

  it('docId sin viewers devuelve vacío', () => {
    expect(viewersOfDoc(entries, 'doc-999')).toEqual([]);
  });
});
