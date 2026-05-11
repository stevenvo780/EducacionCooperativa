import { useEffect } from 'react';
import { getAuthToken } from '@/services/apiClient';
import { getErrorMessage, isAbortError } from '@/lib/error-utils';

const SSE_DATA_PREFIX = 'data: ';
const MAX_EVENT_BYTES = 5 * 1024 * 1024;
const RECONNECT_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000] as const;
const MAX_RECONNECT_ATTEMPTS = 3;
const STABLE_RECONNECT_RESET_MS = 60_000;
const YIELD_EVERY_EVENTS = 10;
const YIELD_EVERY_BYTES = 64 * 1024;

/**
 * Status codes terminales: el cliente NO debe reintentar. 403 ocurre con docs
 * sin permiso (ej. archivos sin extensión .md que el endpoint stream rechaza)
 * y 404 cuando el doc no existe. Reintentar sólo amplifica el ruido en logs.
 */
const TERMINAL_HTTP_STATUSES = new Set<number>([401, 403, 404, 410]);

interface UseEditorSSEStreamOptions {
  roomId: string | undefined;
  isPageVisible: boolean;
  onSnapshot: (data: unknown) => void;
  onDeleted: () => void;
  /**
   * Llamado cuando el endpoint devuelve un status terminal (401/403/404/410).
   * El consumidor puede mostrar un placeholder "no editable en vivo".
   */
  onUnavailable?: (status: number) => void;
}

export function useEditorSSEStream({
  roomId,
  isPageVisible,
  onSnapshot,
  onDeleted,
  onUnavailable
}: UseEditorSSEStreamOptions) {
  useEffect(() => {
    if (!roomId || !isPageVisible) return;

    let cancelled = false;
    let activeController: AbortController | null = null;
    let backoffIndex = 0;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    const runOnce = async (): Promise<{
      ok: boolean;
      deleted: boolean;
      openedAt: number;
      terminalStatus?: number;
    }> => {
      const openedAt = Date.now();
      const token = await getAuthToken();
      if (cancelled) return { ok: false, deleted: false, openedAt };

      const controller = new AbortController();
      activeController = controller;

      try {
        const res = await fetch(`/api/documents/${roomId}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal
        });

        if (!res.ok) {
          if (TERMINAL_HTTP_STATUSES.has(res.status)) {
            return { ok: false, deleted: false, openedAt, terminalStatus: res.status };
          }
          throw new Error(`Stream connection failed: HTTP ${res.status}`);
        }
        if (!res.body) throw new Error('No body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let deleted = false;
        let eventsSinceYield = 0;
        let bytesSinceYield = 0;

        const processEvent = (rawEvent: string) => {
          const dataLine = rawEvent
            .split('\n')
            .find(line => line.startsWith(SSE_DATA_PREFIX));
          if (!dataLine) return;
          const payload = dataLine.substring(SSE_DATA_PREFIX.length);
          if (payload.length > MAX_EVENT_BYTES) {
            console.warn('[useEditorSSEStream] dropping oversized SSE event:', payload.length, 'bytes');
            return;
          }
          try {
            const data = JSON.parse(payload);
            if (data?.type === 'snapshot') {
              onSnapshot(data.data);
            } else if (data?.type === 'deleted') {
              deleted = true;
              onDeleted();
            }
          } catch { /* ignore parse errors */ }
        };

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) bytesSinceYield += value.byteLength;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const rawEvent of events) {
            if (rawEvent.length === 0) continue;
            processEvent(rawEvent);
            eventsSinceYield += 1;
            if (eventsSinceYield >= YIELD_EVERY_EVENTS || bytesSinceYield >= YIELD_EVERY_BYTES) {
              eventsSinceYield = 0;
              bytesSinceYield = 0;
              await yieldToEventLoop();
            }
          }
        }

        if (!cancelled && buffer.length > 0) {
          processEvent(buffer);
        }

        return { ok: true, deleted, openedAt };
      } finally {
        activeController = null;
      }
    };

    const loop = async () => {
      while (!cancelled) {
        try {
          const { deleted, openedAt, terminalStatus } = await runOnce();
          if (cancelled) return;
          if (terminalStatus !== undefined) {
            onUnavailable?.(terminalStatus);
            return;
          }
          if (deleted) return;
          if (Date.now() - openedAt >= STABLE_RECONNECT_RESET_MS) {
            backoffIndex = 0;
            attempts = 0;
          }
        } catch (error: unknown) {
          if (isAbortError(error) || cancelled) return;
          console.error('Stream error:', getErrorMessage(error));
        }

        if (cancelled) return;
        attempts += 1;
        if (attempts > MAX_RECONNECT_ATTEMPTS) {
          console.warn('[useEditorSSEStream] giving up after', MAX_RECONNECT_ATTEMPTS, 'attempts');
          return;
        }

        const waitMs = RECONNECT_BACKOFF_MS[Math.min(backoffIndex, RECONNECT_BACKOFF_MS.length - 1)]!;
        backoffIndex = Math.min(backoffIndex + 1, RECONNECT_BACKOFF_MS.length - 1);

        await new Promise<void>((resolve) => {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            resolve();
          }, waitMs);
        });
      }
    };

    void loop();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      activeController?.abort();
      activeController = null;
    };
  }, [roomId, isPageVisible, onSnapshot, onDeleted, onUnavailable]);
}
