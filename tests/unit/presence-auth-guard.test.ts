import { describe, expect, it, vi, beforeEach } from 'vitest';

let currentUidValue: string | null = null;

vi.mock('@/lib/firebase', () => ({
  auth: () => ({
    get currentUser() {
      return currentUidValue ? { uid: currentUidValue } : null;
    }
  }),
  rtdb: () => {
    throw new Error('rtdb() no debería llamarse cuando canWritePresence falla');
  }
}));

import { joinPresence, subscribePresence } from '@/lib/presence';

describe('presence — guard de auth para evitar permission_denied', () => {
  beforeEach(() => {
    currentUidValue = null;
  });

  it('joinPresence devuelve no-op si no hay user autenticado', async () => {
    currentUidValue = null;
    const handle = await joinPresence({
      workspaceId: 'personal_uidA',
      sessionId: 'ses-1',
      userId: 'uidA',
      displayName: 'Alice'
    });
    // No throw, handle no-op.
    await expect(handle.heartbeat()).resolves.toBeUndefined();
    await expect(handle.updateCurrentDoc('doc-1')).resolves.toBeUndefined();
    await expect(handle.leave()).resolves.toBeUndefined();
  });

  it('joinPresence devuelve no-op si wsId personal_<uid> no coincide con uid auth', async () => {
    currentUidValue = 'uidA';
    const handle = await joinPresence({
      workspaceId: 'personal_uidB',
      sessionId: 'ses-1',
      userId: 'uidA',
      displayName: 'Alice'
    });
    await expect(handle.heartbeat()).resolves.toBeUndefined();
  });

  it('subscribePresence devuelve unsubscribe no-op si no hay auth', () => {
    currentUidValue = null;
    const unsubscribe = subscribePresence('personal_uidA', () => undefined);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('subscribePresence devuelve unsubscribe no-op si personal_<uid> no coincide', () => {
    currentUidValue = 'uidA';
    const unsubscribe = subscribePresence('personal_uidB', () => undefined);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
