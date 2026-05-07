import { removeSemanticDocumentBlock } from '@/lib/semanticDocumentBlocks';
import { fetchDocumentRawApi, updateDocumentApi } from '@/services/dashboardApi';

// Cache de raw content por docId. Antes cada delete consecutivo de bloques
// del mismo doc disparaba un fetch independiente. En bursts (ej. eliminar
// varios fragments seguidos) eso era N round-trips innecesarios. Vida 5s:
// suficiente para coalescer bursts sin riesgo de quedarse con copia stale
// frente a edits remotos.
const RAW_CACHE_TTL_MS = 5000;
const rawDocCache = new Map<string, { content: string; ts: number }>();

const getCachedRaw = async (docId: string): Promise<string> => {
  const cached = rawDocCache.get(docId);
  const now = Date.now();
  if (cached && now - cached.ts < RAW_CACHE_TTL_MS) {
    return cached.content;
  }
  const content = await fetchDocumentRawApi(docId);
  rawDocCache.set(docId, { content, ts: now });
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
