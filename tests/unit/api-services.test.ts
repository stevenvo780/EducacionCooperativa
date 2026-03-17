import type { Plan } from '@/types/subscription';

const { authFetchMock } = vi.hoisted(() => ({
  authFetchMock: vi.fn()
}));

vi.mock('@/services/apiClient', () => ({
  authFetch: authFetchMock
}));

import {
  semanticSearchApi
} from '@/services/searchApi';
import {
  DEFAULT_SNIPPETS,
  createSnippet,
  deleteSnippet,
  fetchSnippets,
  seedDefaultSnippets,
  updateSnippet
} from '@/services/snippetApi';
import {
  createPaymentPreference,
  fetchStorageUsage,
  fetchSubscriptionStatus,
  verifyPayment
} from '@/services/subscriptionApi';

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

describe('HTTP service wrappers', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('handles semantic search responses', async () => {
    authFetchMock.mockResolvedValueOnce(jsonResponse({
      results: [],
      meta: {
        query: 'memoria',
        workspaceId: 'ws-1',
        scannedDocuments: 1,
        totalCandidates: 0,
        offset: 0,
        hasMore: false,
        mode: 'heuristic-v1'
      }
    }));

    await expect(semanticSearchApi({
      query: 'memoria',
      workspaceId: 'ws-1'
    })).resolves.toMatchObject({
      meta: { query: 'memoria' }
    });

    authFetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(semanticSearchApi({
      query: 'memoria',
      workspaceId: 'ws-1'
    })).rejects.toThrow('No se pudo ejecutar la búsqueda semántica');
  });

  it('handles snippet CRUD and seeding', async () => {
    authFetchMock.mockResolvedValueOnce(jsonResponse([{ id: 's1' }]));
    await expect(fetchSnippets('ws 1')).resolves.toEqual([{ id: 's1' }]);

    authFetchMock.mockResolvedValueOnce(new Response('fail', { status: 500 }));
    await expect(fetchSnippets('ws-1')).resolves.toEqual([]);

    authFetchMock.mockResolvedValueOnce(jsonResponse({ id: 's2', title: 'Nuevo' }));
    await expect(createSnippet({
      title: 'Nuevo',
      description: 'Desc',
      markdown: '# Hola',
      workspaceId: 'ws-1',
      category: 'text',
      order: 1
    })).resolves.toEqual({ id: 's2', title: 'Nuevo' });

    authFetchMock.mockResolvedValueOnce(new Response('fail', { status: 500 }));
    await expect(createSnippet({
      title: 'Nuevo',
      description: 'Desc',
      markdown: '# Hola',
      workspaceId: 'ws-1',
      category: 'text',
      order: 1
    })).resolves.toBeNull();

    authFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(updateSnippet('id 1', { title: 'Editado' })).resolves.toBe(true);

    authFetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(updateSnippet('id-2', { order: 2 })).resolves.toBe(false);

    authFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteSnippet('id 1')).resolves.toBe(true);

    authFetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(deleteSnippet('id-2')).resolves.toBe(false);

    expect(DEFAULT_SNIPPETS.length).toBeGreaterThan(0);

    let call = 0;
    authFetchMock.mockImplementation((_: string, init?: RequestInit) => {
      call += 1;
      if (call === 2) {
        return Promise.resolve(new Response('fail', { status: 500 }));
      }
      const payload = JSON.parse(String(init?.body ?? '{}'));
      return Promise.resolve(jsonResponse({ id: `snippet-${call}`, ...payload }));
    });

    const seeded = await seedDefaultSnippets('ws-seed');
    expect(seeded).toHaveLength(DEFAULT_SNIPPETS.length - 1);
    expect(seeded.every((snippet) => snippet.workspaceId === 'ws-seed')).toBe(true);
  });

  it('handles subscription service responses', async () => {
    authFetchMock.mockResolvedValueOnce(jsonResponse({
      subscription: { userId: 'u1', planId: 'free', status: 'free' }
    }));
    await expect(fetchSubscriptionStatus()).resolves.toEqual({
      userId: 'u1',
      planId: 'free',
      status: 'free'
    });

    authFetchMock.mockResolvedValueOnce(new Response('fail', { status: 500 }));
    await expect(fetchSubscriptionStatus()).rejects.toThrow('Error al obtener estado de suscripción');

    authFetchMock.mockResolvedValueOnce(jsonResponse({
      preferenceId: 'pref-1',
      initPoint: 'https://mp'
    }));
    await expect(createPaymentPreference('pro' as Plan)).resolves.toEqual({
      preferenceId: 'pref-1',
      initPoint: 'https://mp'
    });

    authFetchMock.mockResolvedValueOnce(jsonResponse({ error: 'detalle' }, 400));
    await expect(createPaymentPreference('basic' as Plan)).rejects.toThrow('detalle');

    authFetchMock.mockResolvedValueOnce(jsonResponse({}, 400));
    await expect(createPaymentPreference('free' as Plan)).rejects.toThrow('Error al crear preferencia de pago');

    authFetchMock.mockResolvedValueOnce(jsonResponse({
      usedMB: 1,
      limitMB: 10,
      planId: 'free',
      usedBytes: 1,
      limitBytes: 10,
      percentage: 10
    }));
    await expect(fetchStorageUsage()).resolves.toMatchObject({ usedMB: 1, planId: 'free' });

    authFetchMock.mockResolvedValueOnce(new Response('fail', { status: 500 }));
    await expect(fetchStorageUsage()).rejects.toThrow('Error al obtener uso de almacenamiento');

    authFetchMock.mockResolvedValueOnce(jsonResponse({
      status: 'active',
      message: 'ok'
    }, 500));
    await expect(verifyPayment()).resolves.toEqual({
      status: 'active',
      message: 'ok'
    });
  });
});
