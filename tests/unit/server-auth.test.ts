const {
  collectionMock,
  docMock,
  getMock,
  verifyIdTokenMock
} = vi.hoisted(() => {
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({
    get: getMock
  }));
  const collectionMock = vi.fn(() => ({
    doc: docMock
  }));

  return {
    verifyIdTokenMock: vi.fn(),
    getMock,
    docMock,
    collectionMock
  };
});

process.env.APP_PASSWORD = 'test-local-secret';

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: verifyIdTokenMock
  },
  adminDb: {
    collection: collectionMock
  }
}));

import {
  getUserRole,
  isAdminUser,
  isWorkspaceMember,
  requireAuth,
  _clearMembershipCacheForTesting
} from '@/lib/server-auth';
import { createLocalDevAuthToken } from '@/lib/local-dev-auth';

describe('server auth helpers', () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    getMock.mockReset();
    docMock.mockClear();
    collectionMock.mockClear();
    _clearMembershipCacheForTesting();
  });

  it('extracts and verifies bearer tokens', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: 'u1',
      email: 'user@example.com'
    });
    await expect(requireAuth(new Request('https://app.test', {
      headers: { authorization: 'Bearer token-1' }
    }) as never)).resolves.toEqual({
      uid: 'u1',
      email: 'user@example.com'
    });

    verifyIdTokenMock.mockResolvedValueOnce({
      uid: 'u2',
      userEmail: 'alt@example.com'
    });
    await expect(requireAuth(new Request('https://app.test', {
      headers: { Authorization: 'Bearer token-2' }
    }) as never)).resolves.toEqual({
      uid: 'u2',
      email: 'alt@example.com'
    });
  });

  it('returns null when auth token is missing or invalid', async () => {
    await expect(requireAuth(new Request('https://app.test') as never)).resolves.toBeNull();
    await expect(requireAuth(new Request('https://app.test', {
      headers: { authorization: 'Token plain-value' }
    }) as never)).resolves.toBeNull();

    verifyIdTokenMock.mockRejectedValueOnce(new Error('invalid'));
    await expect(requireAuth(new Request('https://app.test', {
      headers: { authorization: 'Bearer bad-token' }
    }) as never)).resolves.toBeNull();

    await expect(requireAuth({
      headers: new Headers(),
      url: '::::'
    } as never)).resolves.toBeNull();
  });

  it('accepts local dev signed tokens when Firebase verify fails', async () => {
    const token = createLocalDevAuthToken({
      uid: 'local-user-1',
      email: 'local@example.com'
    });

    verifyIdTokenMock.mockRejectedValueOnce(new Error('identitytoolkit permission denied'));
    await expect(requireAuth(new Request('https://app.test', {
      headers: { authorization: `Bearer ${token}` }
    }) as never)).resolves.toEqual({
      uid: 'local-user-1',
      email: 'local@example.com'
    });
  });

  it('checks workspace membership', async () => {
    await expect(isWorkspaceMember('personal', 'u1')).resolves.toBe(false);

    getMock.mockResolvedValueOnce({ exists: false });
    await expect(isWorkspaceMember('ws-1', 'u1')).resolves.toBe(false);

    // Clear cache so same key can be re-evaluated with different mock data
    _clearMembershipCacheForTesting();
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ members: ['u1', 'u2'] })
    });
    await expect(isWorkspaceMember('ws-1', 'u1')).resolves.toBe(true);

    _clearMembershipCacheForTesting();
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ members: ['u2'] })
    });
    await expect(isWorkspaceMember('ws-1', 'u1')).resolves.toBe(false);

    _clearMembershipCacheForTesting();
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ members: 'u1' })
    });
    await expect(isWorkspaceMember('ws-1', 'u1')).resolves.toBe(false);
  });

  it('loads roles and detects admins', async () => {
    await expect(getUserRole('')).resolves.toBeNull();

    getMock.mockResolvedValueOnce({ exists: false });
    await expect(getUserRole('u1')).resolves.toBeNull();

    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: '  admin ' })
    });
    await expect(getUserRole('u1')).resolves.toBe('admin');

    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: '   ' })
    });
    await expect(getUserRole('u1')).resolves.toBeNull();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getMock.mockRejectedValueOnce(new Error('db down'));
    await expect(getUserRole('u1')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'ADMIN' })
    });
    await expect(isAdminUser('u1')).resolves.toBe(true);

    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'SuperAdmin' })
    });
    await expect(isAdminUser('u1')).resolves.toBe(true);

    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'viewer' })
    });
    await expect(isAdminUser('u1')).resolves.toBe(false);

    getMock.mockResolvedValueOnce({
      exists: false
    });
    await expect(isAdminUser('u1')).resolves.toBe(false);
  });
});
