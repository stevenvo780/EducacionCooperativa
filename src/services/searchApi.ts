import { fetchZod } from '@/lib/fetch-zod';
import { semanticSearchResponseSchema } from '@agora/contracts';
import type { SemanticSearchRequest, SemanticSearchResponse } from '@/lib/search/types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const semanticSearchApi = async (
  payload: SemanticSearchRequest,
  init?: { signal?: AbortSignal }
) => {
  try {
    const data = await fetchZod('/api/search/semantic', semanticSearchResponseSchema, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
      signal: init?.signal,
      cache: 'no-store'
    });
    return data as unknown as SemanticSearchResponse;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo ejecutar la búsqueda semántica: ${detail}`);
  }
};
