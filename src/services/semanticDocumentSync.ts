import { removeSemanticDocumentBlock } from '@/lib/semanticDocumentBlocks';
import { fetchDocumentRawApi, updateDocumentApi } from '@/services/dashboardApi';

export const removeSemanticBlockFromDocument = async (docId: string, docBlockId: string) => {
  const rawContent = await fetchDocumentRawApi(docId);
  const nextContent = removeSemanticDocumentBlock(rawContent, docBlockId);

  if (nextContent === rawContent.trimEnd()) {
    return false;
  }

  await updateDocumentApi(docId, { content: `${nextContent}\n` });
  return true;
};
