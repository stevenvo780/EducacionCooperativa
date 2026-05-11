import { removeSemanticDocumentBlock } from '@/lib/semanticDocumentBlocks';
import { fetchDocumentRawApi, updateDocumentApi } from '@/services/dashboardApi';

// Cache de raw content por docId. Antes cada delete consecutivo de bloques
// del mismo doc disparaba un fetch independiente. En bursts (ej. eliminar
// varios fragments seguidos) eso era N round-trips innecesarios. Vida 5s:
// suficiente para coalescer bursts sin riesgo de quedarse con copia stale
// frente a edits remotos.
const RAW_CACHE_TTL_MS = 5000;
const RAW_CACHE_MAX_ENTRIES = 64;
const rawDocCache = new Map<string, { content: string; ts: number }>();

const touchRawCacheEntry = (docId: string, entry: { content: string; ts: number }) => {
  if (rawDocCache.has(docId)) rawDocCache.delete(docId);
  rawDocCache.set(docId, entry);
  while (rawDocCache.size > RAW_CACHE_MAX_ENTRIES) {
    const oldest = rawDocCache.keys().next().value;
    if (oldest === undefined || oldest === docId) break;
    rawDocCache.delete(oldest);
  }
};

const getCachedRaw = async (docId: string): Promise<string> => {
  const cached = rawDocCache.get(docId);
  const now = Date.now();
  if (cached && now - cached.ts < RAW_CACHE_TTL_MS) {
    touchRawCacheEntry(docId, cached);
    return cached.content;
  }
  const content = await fetchDocumentRawApi(docId);
  touchRawCacheEntry(docId, { content, ts: now });
  return content;
};

const invalidateRawCache = (docId: string) => {
  rawDocCache.delete(docId);
};

export const removeSemanticBlockFromDocument = async (docId: string, docBlockId: string) => {
  const rawContent = await getCachedRaw(docId);
  const nextContent = removeSemanticDocumentBlock(rawContent, docBlockId);

  if (nextContent === rawContent.trimEnd()) {
    return false;
  }

  await updateDocumentApi(docId, { content: `${nextContent}\n` });
  // Tras mutar invalidamos: la próxima lectura debe ver la versión nueva
  // si la cache TTL aún no expiró.
  invalidateRawCache(docId);
  return true;
};
