import { authFetch } from '@/services/apiClient';
import type { SemanticSearchRequest, SemanticSearchResponse } from '@/lib/search/types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const semanticSearchApi = async (
  payload: SemanticSearchRequest,
  init?: { signal?: AbortSignal }
) => {
  const res = await authFetch('/api/search/semantic', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal: init?.signal,
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('No se pudo ejecutar la búsqueda semántica');
  }

  return res.json() as Promise<SemanticSearchResponse>;
};
