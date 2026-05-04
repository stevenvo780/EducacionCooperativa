import { fetchZod } from '@/lib/fetch-zod';
import { semanticStateResponseSchema } from '@agora/contracts';
import type { SemanticWorkspaceState } from '@/lib/semantic/workspace-state';

export const fetchSemanticWorkspaceStateApi = async (workspaceId: string) => {
  const search = new URLSearchParams({ workspaceId });
  const data = await fetchZod(`/api/semantic?${search.toString()}`, semanticStateResponseSchema, {
    cache: 'no-store'
  });
  return data.state;
};

export const saveSemanticWorkspaceStateApi = async (
  workspaceId: string,
  state: SemanticWorkspaceState
) => {
  const data = await fetchZod('/api/semantic', semanticStateResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, state })
  });
  return data.state;
};
