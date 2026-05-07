import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGORA_EVENTS, dispatchAgoraEvent } from '@/lib/agora-events';

describe('agora typed browser events', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches CustomEvent with typed detail', () => {
    const listener = vi.fn();
    window.addEventListener(AGORA_EVENTS.agentUiCommand, listener as EventListener);

    const detail = {
      workspaceId: 'workspace-1',
      command: { type: 'open_panel', panel: 'board' },
      source: 'agora-ai'
    } as const;

    try {
      dispatchAgoraEvent(AGORA_EVENTS.agentUiCommand, detail);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0]?.[0] as CustomEvent;
      expect(event.detail).toEqual(detail);
    } finally {
      window.removeEventListener(AGORA_EVENTS.agentUiCommand, listener as EventListener);
    }
  });

  it('dispatches docsChanged with required workspaceId in detail', () => {
    const listener = vi.fn();
    window.addEventListener(AGORA_EVENTS.docsChanged, listener);

    try {
      dispatchAgoraEvent(AGORA_EVENTS.docsChanged, { workspaceId: 'workspace-1' });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0]?.[0] as CustomEvent<{ workspaceId: string | null }>;
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event.detail).toEqual({ workspaceId: 'workspace-1' });
    } finally {
      window.removeEventListener(AGORA_EVENTS.docsChanged, listener);
    }
  });
});
