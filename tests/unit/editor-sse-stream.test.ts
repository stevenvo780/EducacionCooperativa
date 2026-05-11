import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditorSSEStream } from '@/components/mosaic-editor/useEditorSSEStream';

vi.mock('@/services/apiClient', () => ({
  getAuthToken: vi.fn(async () => 'fake-token')
}));

function buildFetchResponse(status: number, body: string | null = null): Response {
  if (status >= 200 && status < 300 && body !== null) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      }
    });
    return new Response(stream, { status });
  }
  return new Response(null, { status });
}

describe('useEditorSSEStream', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no reintenta cuando el endpoint responde 403', async () => {
    fetchSpy.mockResolvedValue(buildFetchResponse(403));
    const onSnapshot = vi.fn();
    const onDeleted = vi.fn();
    const onUnavailable = vi.fn();

    const { unmount } = renderHook(() =>
      useEditorSSEStream({
        roomId: 'doc-no-md',
        isPageVisible: true,
        onSnapshot,
        onDeleted,
        onUnavailable
      })
    );

    // Esperamos un microtick para que el async loop ejecute el primer fetch.
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onUnavailable).toHaveBeenCalledWith(403);
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();

    unmount();

    // Después de 1s no debería haber reintentos.
    await new Promise((r) => setTimeout(r, 1200));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('no reintenta tras 404', async () => {
    fetchSpy.mockResolvedValue(buildFetchResponse(404));
    const onUnavailable = vi.fn();

    const { unmount } = renderHook(() =>
      useEditorSSEStream({
        roomId: 'doc-missing',
        isPageVisible: true,
        onSnapshot: vi.fn(),
        onDeleted: vi.fn(),
        onUnavailable
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(onUnavailable).toHaveBeenCalledWith(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('no abre stream si roomId está vacío', async () => {
    const { unmount } = renderHook(() =>
      useEditorSSEStream({
        roomId: undefined,
        isPageVisible: true,
        onSnapshot: vi.fn(),
        onDeleted: vi.fn()
      })
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchSpy).not.toHaveBeenCalled();
    unmount();
  });

  it('procesa snapshots cuando el stream responde 200', async () => {
    const sseBody = 'data: {"type":"snapshot","data":{"content":"hola"}}\n\n';
    fetchSpy.mockResolvedValue(buildFetchResponse(200, sseBody));
    const onSnapshot = vi.fn();

    const { unmount } = renderHook(() =>
      useEditorSSEStream({
        roomId: 'doc-ok',
        isPageVisible: true,
        onSnapshot,
        onDeleted: vi.fn()
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(onSnapshot).toHaveBeenCalledWith({ content: 'hola' });
    unmount();
  });
});
