'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRemoteAgentChat,
  deleteRemoteAgentChat,
  listRemoteAgentChatMessages,
  listRemoteAgentChats,
  patchRemoteAgentChat,
  truncateRemoteAgentChatFromUserIndex,
  type RemoteAgentChat,
  type RemoteAgentChatMessage
} from '@/lib/agora-ai/agentChatApi';

const LOCAL_CACHE_KEY = 'agora-ai-remote-chats-cache:v1';

const readCache = (): RemoteAgentChat[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RemoteAgentChat => (
        !!item && typeof item === 'object' && typeof (item as RemoteAgentChat).id === 'string'
      ))
      .slice(0, 200);
  } catch {
    return [];
  }
};

const writeCache = (chats: RemoteAgentChat[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(chats.slice(0, 200)));
  } catch {
    /* quota: silenciamos. */
  }
};

export interface UseAgentChatHistoryResult {
  chats: RemoteAgentChat[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createChat: (params?: { title?: string; model?: string; provider?: string }) => Promise<RemoteAgentChat>;
  renameChat: (id: string, title: string) => Promise<void>;
  removeChat: (id: string) => Promise<void>;
  loadMessages: (id: string) => Promise<RemoteAgentChatMessage[]>;
  /** Trunca un chat persistido desde el N-ésimo turno del usuario (0-based) y
   *  todos los posteriores (checkpoint "volver aquí"). Devuelve cuántos se
   *  borraron. */
  truncateFromUserIndex: (id: string, userIndex: number) => Promise<number>;
  /** Empuja un chat conocido (devuelto por el stream SSE `chat-created`)
   *  al cache local sin esperar al refresh. */
  upsertChat: (chat: RemoteAgentChat) => void;
}

export function useAgentChatHistory(enabled: boolean = true): UseAgentChatHistoryResult {
  const [chats, setChats] = useState<RemoteAgentChat[]>(() => readCache());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { items } = await listRemoteAgentChats({ limit: 50 });
      if (!mounted.current) return;
      setChats(items);
      writeCache(items);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'Error cargando chats');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  const upsertChat = useCallback((chat: RemoteAgentChat) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === chat.id);
      const next = idx >= 0
        ? [chat, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
        : [chat, ...prev];
      const sorted = next.slice().sort((a, b) => b.updatedAt - a.updatedAt);
      writeCache(sorted);
      return sorted;
    });
  }, []);

  const createChat = useCallback<UseAgentChatHistoryResult['createChat']>(async (params = {}) => {
    const created = await createRemoteAgentChat(params);
    upsertChat(created);
    return created;
  }, [upsertChat]);

  const renameChat = useCallback<UseAgentChatHistoryResult['renameChat']>(async (id, title) => {
    const updated = await patchRemoteAgentChat(id, title);
    upsertChat(updated);
  }, [upsertChat]);

  const removeChat = useCallback<UseAgentChatHistoryResult['removeChat']>(async (id) => {
    await deleteRemoteAgentChat(id);
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      writeCache(next);
      return next;
    });
  }, []);

  const loadMessages = useCallback<UseAgentChatHistoryResult['loadMessages']>(async (id) => {
    const all: RemoteAgentChatMessage[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 20; i += 1) {
      const page: { items: RemoteAgentChatMessage[]; nextCursor: string | null } = await listRemoteAgentChatMessages(id, { limit: 200, cursor });
      all.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return all;
  }, []);

  const truncateFromUserIndex = useCallback<UseAgentChatHistoryResult['truncateFromUserIndex']>(async (id, userIndex) => {
    return truncateRemoteAgentChatFromUserIndex(id, userIndex);
  }, []);

  return { chats, loading, error, refresh, createChat, renameChat, removeChat, loadMessages, truncateFromUserIndex, upsertChat };
}
