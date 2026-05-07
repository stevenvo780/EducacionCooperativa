import { useEffect } from 'react';
import { getAuthToken } from '@/services/apiClient';
import { getErrorMessage, isAbortError } from '@/lib/error-utils';

const SSE_DATA_PREFIX = 'data: ';
const MAX_EVENT_BYTES = 5 * 1024 * 1024;
const RECONNECT_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
const STABLE_RECONNECT_RESET_MS = 60_000;
const YIELD_EVERY_EVENTS = 10;
const YIELD_EVERY_BYTES = 64 * 1024;

interface UseEditorSSEStreamOptions {
  roomId: string | undefined;
  isPageVisible: boolean;
  onSnapshot: (data: unknown) => void;
  onDeleted: () => void;
}

export function useEditorSSEStream({
  roomId,
  isPageVisible,
  onSnapshot,
  onDeleted
}: UseEditorSSEStreamOptions) {
  useEffect(() => {
    if (!roomId || !isPageVisible) return;

    let cancelled = false;
    let activeController: AbortController | null = null;
    let backoffIndex = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    const runOnce = async (): Promise<{ ok: boolean; deleted: boolean; openedAt: number }> => {
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

        if (!res.ok) throw new Error(`Stream connection failed: HTTP ${res.status}`);
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
          const { deleted, openedAt } = await runOnce();
          if (cancelled) return;
          if (deleted) return;
          if (Date.now() - openedAt >= STABLE_RECONNECT_RESET_MS) {
            backoffIndex = 0;
          }
        } catch (error: unknown) {
          if (isAbortError(error) || cancelled) return;
          console.error('Stream error:', getErrorMessage(error));
        }

        if (cancelled) return;

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
  }, [roomId, isPageVisible, onSnapshot, onDeleted]);
}
