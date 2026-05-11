const authState = {
  currentUser: null as null | { getIdToken?: () => Promise<string>; uid?: string }
};

let shouldThrowAuth = false;
const onAuthStateChangedMock = vi.fn();

vi.mock('@/lib/firebase', () => ({
  auth: () => {
    if (shouldThrowAuth) {
      throw new Error('firebase auth failed');
    }
    return authState;
  }
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args)
}));

const loadApiClient = async () => import('@/services/apiClient');

describe('api client auth wrappers', () => {
  beforeEach(() => {
    vi.resetModules();
    shouldThrowAuth = false;
    authState.currentUser = null;
    onAuthStateChangedMock.mockReset();
  });

  it('returns a token from the current firebase user', async () => {
    authState.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };

    const apiClient = await loadApiClient();
    await expect(apiClient.getAuthToken()).resolves.toBe('token-123');
  });

  it('returns null when the resolved user has no getIdToken method', async () => {
    let successCallback: ((user: typeof authState.currentUser) => void) | undefined;

    onAuthStateChangedMock.mockImplementation((_: unknown, success: typeof successCallback) => {
      successCallback = success;
      return vi.fn();
    });

    const apiClient = await loadApiClient();
    const pending = apiClient.getAuthToken();
    authState.currentUser = { uid: 'u1' };
    successCallback?.({ uid: 'u1' });

    await expect(pending).resolves.toBeNull();
  });

  it('deduplicates concurrent auth waits and resolves from auth state changes', async () => {
    let successCallback: ((user: typeof authState.currentUser) => void) | undefined;

    onAuthStateChangedMock.mockImplementation((_: unknown, success: typeof successCallback) => {
      successCallback = success;
      return vi.fn();
    });

    const apiClient = await loadApiClient();
    const lateUser = {
      getIdToken: vi.fn().mockResolvedValue('late-token')
    };

    const first = apiClient.getAuthToken();
    const second = apiClient.getAuthToken();

    expect(onAuthStateChangedMock).toHaveBeenCalledTimes(1);

    authState.currentUser = lateUser;
    successCallback?.(lateUser);

    await expect(Promise.all([first, second])).resolves.toEqual(['late-token', 'late-token']);
    expect(lateUser.getIdToken).toHaveBeenCalledTimes(2);
  });

  it('recovers from auth observer errors and timeouts', async () => {
    let errorCallback: ((error: Error) => void) | undefined;

    onAuthStateChangedMock.mockImplementation((_: unknown, __: unknown, error: typeof errorCallback) => {
      errorCallback = error;
      return vi.fn();
    });

    const apiClient = await loadApiClient();
    const fromError = apiClient.getAuthToken();
    authState.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fallback-token')
    };
    errorCallback?.(new Error('observer failed'));
    await expect(fromError).resolves.toBe('fallback-token');

    vi.useFakeTimers();
    authState.currentUser = null;
    onAuthStateChangedMock.mockImplementation(() => vi.fn());

    const fromTimeout = apiClient.getAuthToken();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(fromTimeout).resolves.toBeNull();
  });

  it('returns null when auth access throws and forwards headers in authFetch', async () => {
    shouldThrowAuth = true;
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const apiClient = await loadApiClient();
    await expect(apiClient.getAuthToken()).resolves.toBeNull();

    await apiClient.authFetch('/api/test', {
      method: 'POST',
      headers: { 'X-Test': '1' }
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Test')).toBe('1');
    expect(headers.get('X-Request-Id')).toBeTruthy();
  });

  it('falls back to local dev token when firebase auth is unavailable', async () => {
    shouldThrowAuth = true;
    localStorage.setItem('agora_local_dev_token', 'local-dev-token');

    const apiClient = await loadApiClient();
    await expect(apiClient.getAuthToken()).resolves.toBe('local-dev-token');
  });

  it('adds the bearer token when available and exposes the deprecated helper', async () => {
    authState.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('auth-token')
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', fetchMock);

    const apiClient = await loadApiClient();
    await apiClient.authFetch('/api/test');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer auth-token');
    expect(headers.get('X-Request-Id')).toBeTruthy();
    await expect(apiClient.withAuthToken('/ruta')).resolves.toBe('/ruta');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does NOT show a network toast when the fetch is aborted (workspace switch)', async () => {
    authState.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-abc')
    };
    const sonner = await import('sonner');
    const toastSpy = vi.spyOn(sonner.toast, 'error').mockImplementation(() => 'id' as never);
    const abortError = new DOMException('signal is aborted without reason', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal('fetch', fetchMock);

    const apiClient = await loadApiClient();
    await expect(apiClient.authFetch('/api/test')).rejects.toBe(abortError);

    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('still surfaces a network toast for non-abort fetch failures', async () => {
    authState.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-abc')
    };
    const sonner = await import('sonner');
    const toastSpy = vi.spyOn(sonner.toast, 'error').mockImplementation(() => 'id' as never);
    const networkError = new TypeError('Failed to fetch');
    const fetchMock = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal('fetch', fetchMock);

    const apiClient = await loadApiClient();
    await expect(apiClient.authFetch('/api/test')).rejects.toBe(networkError);

    expect(toastSpy).toHaveBeenCalledWith('Fallo de Red', expect.objectContaining({
      description: 'Failed to fetch'
    }));
  });
});
