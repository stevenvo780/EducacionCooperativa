import { describe, expect, it } from 'vitest';
import { SyncConflictError } from '@/lib/offlineSync';
import { SyncQueueStatus } from '@/lib/offlineStorage';

describe('SyncConflictError', () => {
  it('contiene los detalles del conflicto', () => {
    const err = new SyncConflictError({
      localVersion: 3,
      serverVersion: 5,
      serverContent: 'remoto',
      serverUpdatedBy: 'alice'
    });
    expect(err.name).toBe('SyncConflictError');
    expect(err.details.serverVersion).toBe(5);
    expect(err.details.localVersion).toBe(3);
    expect(err.details.serverContent).toBe('remoto');
    expect(err.details.serverUpdatedBy).toBe('alice');
  });

  it('hereda de Error', () => {
    const err = new SyncConflictError({});
    expect(err).toBeInstanceOf(Error);
  });

  it('mensaje útil para el usuario', () => {
    const err = new SyncConflictError({});
    expect(err.message).toMatch(/conflicto|conflict|versión|version/i);
  });
});

describe('SyncQueueStatus.Conflict', () => {
  it('está disponible como valor del enum', () => {
    expect(SyncQueueStatus.Conflict).toBe('conflict');
  });

  it('es distinto de los otros estados', () => {
    expect(SyncQueueStatus.Conflict).not.toBe(SyncQueueStatus.Pending);
    expect(SyncQueueStatus.Conflict).not.toBe(SyncQueueStatus.Failed);
    expect(SyncQueueStatus.Conflict).not.toBe(SyncQueueStatus.Processing);
  });
});
