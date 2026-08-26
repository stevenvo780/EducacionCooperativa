import { authFetch, parseApiResponse } from '@/services/apiClient';

export const AGENT_KEY_PROVIDERS = ['openai', 'deepseek', 'anthropic', 'google', 'gemini', 'minimax', 'agora-gateway', 'custom'] as const;
export type AgentKeyProvider = typeof AGENT_KEY_PROVIDERS[number];

export interface RemoteAgentSecret {
  provider: AgentKeyProvider;
  displayHint: string;
  createdAt: number;
  lastUsedAt: number | null;
  kid: string;
}

export const listAgentSecrets = async (): Promise<RemoteAgentSecret[]> => {
  const res = await authFetch('/api/agora-ai/keys');
  const data = await parseApiResponse<{ items: RemoteAgentSecret[] }>(res);
  return Array.isArray(data?.items) ? data.items : [];
};

export const saveAgentSecret = async (provider: AgentKeyProvider, key: string): Promise<RemoteAgentSecret> => {
  const res = await authFetch('/api/agora-ai/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key })
  });
  const data = await parseApiResponse<{ secret: RemoteAgentSecret }>(res);
  return data.secret;
};

export const deleteAgentSecret = async (provider: AgentKeyProvider): Promise<void> => {
  const res = await authFetch(`/api/agora-ai/keys/${encodeURIComponent(provider)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`No se pudo eliminar key (HTTP ${res.status})`);
  }
};
