/**
 * Cliente fetch para los endpoints persistentes del agente IA.
 * Las rutas viven en AgoraBack — `authFetch` resuelve el `apiUrl` y agrega
 * el `Authorization: Bearer <firebase-id-token>`.
 */
import { apiUrl, authFetch, parseApiResponse } from '@/services/apiClient';

export interface RemoteAgentChat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  provider: string | null;
  workspaceContext: string | null;
  totalTokens: number;
}

export interface RemoteAgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  ts: number;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  citations?: unknown[];
}

export interface ListChatsResponse {
  items: RemoteAgentChat[];
  nextCursor: string | null;
}

export interface ListMessagesResponse {
  items: RemoteAgentChatMessage[];
  nextCursor: string | null;
}

export const listRemoteAgentChats = async (params: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<ListChatsResponse> => {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const url = `/api/agora-ai/chats${qs.size ? `?${qs.toString()}` : ''}`;
  const res = await authFetch(url);
  return parseApiResponse<ListChatsResponse>(res);
};

export const createRemoteAgentChat = async (params: {
  title?: string;
  model?: string;
  provider?: string;
} = {}): Promise<RemoteAgentChat> => {
  const res = await authFetch('/api/agora-ai/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await parseApiResponse<{ chat: RemoteAgentChat }>(res);
  return data.chat;
};

export const patchRemoteAgentChat = async (id: string, title: string): Promise<RemoteAgentChat> => {
  const res = await authFetch(`/api/agora-ai/chats/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  const data = await parseApiResponse<{ chat: RemoteAgentChat }>(res);
  return data.chat;
};

export const deleteRemoteAgentChat = async (id: string): Promise<void> => {
  const res = await authFetch(`/api/agora-ai/chats/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`No se pudo eliminar chat (HTTP ${res.status})`);
  }
};

export const listRemoteAgentChatMessages = async (id: string, params: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<ListMessagesResponse> => {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const url = `/api/agora-ai/chats/${encodeURIComponent(id)}/messages${qs.size ? `?${qs.toString()}` : ''}`;
  const res = await authFetch(url);
  return parseApiResponse<ListMessagesResponse>(res);
};

/**
 * Trunca la conversación persistida desde el N-ésimo turno del usuario (0-based)
 * y todos los posteriores. Usado por el checkpoint "volver aquí" para que el
 * descarte sobreviva recarga / cross-device. Se usa el índice de turno user —
 * no el doc id — porque los mensajes en vivo aún no conocen su id de Firestore.
 * Devuelve cuántos mensajes se borraron.
 */
export const truncateRemoteAgentChatFromUserIndex = async (
  id: string,
  userIndex: number
): Promise<number> => {
  const res = await authFetch(
    `/api/agora-ai/chats/${encodeURIComponent(id)}/messages?fromUserIndex=${encodeURIComponent(String(userIndex))}`,
    { method: 'DELETE' }
  );
  const data = await parseApiResponse<{ deleted: number }>(res);
  return data.deleted;
};

/** No usado por el flujo principal — el stream persiste los mensajes server-side. */
export const appendRemoteAgentChatMessage = async (id: string, payload: {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
}): Promise<RemoteAgentChatMessage> => {
  const res = await authFetch(`/api/agora-ai/chats/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseApiResponse<{ message: RemoteAgentChatMessage }>(res);
  return data.message;
};

// re-export apiUrl for callers that need the absolute SSE endpoint.
export { apiUrl };
