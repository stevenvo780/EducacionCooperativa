import { fetchZod } from '@/lib/fetch-zod';
import { semanticStateResponseSchema } from '@agora/contracts';
import type { SemanticWorkspaceState, SemanticFragmentRecord } from '@/lib/semantic/workspace-state';

// In-flight dedupe: si MosaicEditor + GlobalSemanticBrowser piden el mismo
// workspaceId al mismo tiempo, comparten la promesa para evitar 3x roundtrips
// al backend en cada mount del dashboard.
const inFlightFetches = new Map<string, Promise<SemanticWorkspaceState | undefined>>();

const FRAGMENT_TEXT_CAP = 1500;
const FRAGMENT_EXCERPT_CAP = 400;
const TOTAL_FRAGMENT_CAP = 3000;

const truncateFragment = (f: SemanticFragmentRecord): SemanticFragmentRecord => ({
  ...f,
  text: f.text && f.text.length > FRAGMENT_TEXT_CAP ? f.text.slice(0, FRAGMENT_TEXT_CAP) : f.text,
  excerpt: f.excerpt && f.excerpt.length > FRAGMENT_EXCERPT_CAP ? f.excerpt.slice(0, FRAGMENT_EXCERPT_CAP) : f.excerpt
});

const sanitizeStateForClient = (state: SemanticWorkspaceState | undefined): SemanticWorkspaceState | undefined => {
  if (!state) return state;
  const fragments = state.fragments;
  if (fragments.length <= TOTAL_FRAGMENT_CAP && fragments.every((f) => (f.text?.length ?? 0) <= FRAGMENT_TEXT_CAP)) {
    return state;
  }
  // Recortar agresivamente fragments para evitar que tablets/mobile colapsen.
  // El usuario sigue pudiendo ver y editar; los textos largos se truncan.
  const sortedByDate = [...fragments].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const trimmed = sortedByDate.slice(0, TOTAL_FRAGMENT_CAP).map(truncateFragment);
  return { ...state, fragments: trimmed };
};

export const fetchSemanticWorkspaceStateApi = (workspaceId: string): Promise<SemanticWorkspaceState | undefined> => {
  const existing = inFlightFetches.get(workspaceId);
  if (existing) return existing;
  const search = new URLSearchParams({ workspaceId });
  const promise = fetchZod(`/api/semantic?${search.toString()}`, semanticStateResponseSchema, {
    cache: 'no-store'
  })
    .then((data) => sanitizeStateForClient(data.state))
    .finally(() => {
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
