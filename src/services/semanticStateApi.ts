import { authFetch } from '@/services/apiClient';
import type { SemanticWorkspaceState } from '@/lib/semantic/workspace-state';

export const fetchSemanticWorkspaceStateApi = async (workspaceId: string) => {
  const search = new URLSearchParams({ workspaceId });
  const res = await authFetch(`/api/semantic?${search.toString()}`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('No se pudo cargar el estado semantico del workspace');
  }

  const data = await res.json() as { state?: SemanticWorkspaceState };
  return data.state;
};

export const saveSemanticWorkspaceStateApi = async (
  workspaceId: string,
  state: SemanticWorkspaceState
) => {
  const res = await authFetch('/api/semantic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, state })
  });

  if (!res.ok) {
    throw new Error('No se pudo guardar el estado semantico del workspace');
  }

  const data = await res.json() as { state?: SemanticWorkspaceState };
  return data.state;
};
