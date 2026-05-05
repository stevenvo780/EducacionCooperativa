import { useEffect } from 'react';
import { getAuthToken } from '@/services/apiClient';
import { getErrorMessage, isAbortError } from '@/lib/error-utils';

const SSE_DATA_PREFIX = 'data: ';

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

    const controller = new AbortController();
    let cancelled = false;

    const init = async () => {
      const token = await getAuthToken();
      if (cancelled) return;

      try {
        const res = await fetch(`/api/documents/${roomId}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal
        });

        if (!res.ok) throw new Error('Stream connection failed');
        if (!res.body) throw new Error('No body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processEvent = (rawEvent: string) => {
          const dataLine = rawEvent
            .split('\n')
            .find(line => line.startsWith(SSE_DATA_PREFIX));
          if (!dataLine) return;
          try {
            const data = JSON.parse(dataLine.substring(SSE_DATA_PREFIX.length));
            if (data?.type === 'snapshot') {
              onSnapshot(data.data);
            } else if (data?.type === 'deleted') {
              onDeleted();
            }
          } catch { /* ignore parse errors */ }
        };

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const rawEvent of events) {
            if (rawEvent.length === 0) continue;
            processEvent(rawEvent);
          }
        }

        if (!cancelled && buffer.length > 0) {
          processEvent(buffer);
        }
      } catch (error: unknown) {
        if (!isAbortError(error) && !cancelled) {
          console.error('Stream error:', getErrorMessage(error));
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [roomId, isPageVisible, onSnapshot, onDeleted]);
}
