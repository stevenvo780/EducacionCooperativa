import { fetchZod } from '@/lib/fetch-zod';
import { semanticStateResponseSchema } from '@agora/contracts';
import type { SemanticWorkspaceState } from '@/lib/semantic/workspace-state';

// In-flight dedupe: si MosaicEditor + GlobalSemanticBrowser piden el mismo
// workspaceId al mismo tiempo, comparten la promesa para evitar 3x roundtrips
// al backend en cada mount del dashboard.
const inFlightFetches = new Map<string, Promise<SemanticWorkspaceState | undefined>>();

export const fetchSemanticWorkspaceStateApi = (workspaceId: string): Promise<SemanticWorkspaceState | undefined> => {
  const existing = inFlightFetches.get(workspaceId);
  if (existing) return existing;
  const search = new URLSearchParams({ workspaceId });
  const promise = fetchZod(`/api/semantic?${search.toString()}`, semanticStateResponseSchema, {
    cache: 'no-store'
  })
    .then((data) => data.state)
    .finally(() => {
      // Mantener el dedupe sólo durante la ventana del request en vuelo,
      // no como cache permanente: la siguiente llamada vuelve a pegarle al backend.
      inFlightFetches.delete(workspaceId);
    });
  inFlightFetches.set(workspaceId, promise);
  return promise;
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
