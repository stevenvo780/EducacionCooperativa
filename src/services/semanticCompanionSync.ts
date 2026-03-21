import type { DocItem } from '@/components/dashboard/types';
import { buildSTFromSemantic, companionSTName } from '@/lib/buildSTFromSemantic';
import {
  filterSemanticWorkspaceStateByDocument,
  normalizeSemanticWorkspaceState,
  type SemanticDocumentRef,
  type SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { createDocumentApi, fetchDocsApi, updateDocumentApi } from '@/services/dashboardApi';

interface SyncSemanticCompanionFilesOptions {
  workspaceId: string;
  state: SemanticWorkspaceState;
  documentRefs: SemanticDocumentRef[];
}

const getDocKey = (ref: SemanticDocumentRef) => `${ref.docId || ''}::${ref.docName || ''}`;

const resolveSourceDocument = (docs: DocItem[], ref: SemanticDocumentRef) => {
  if (ref.docId) {
    const byId = docs.find((doc) => doc.id === ref.docId);
    if (byId) return byId;
  }

  if (ref.docName) {
    return docs.find((doc) => doc.name === ref.docName);
  }

  return undefined;
};

const resolveCompanionDocuments = (docs: DocItem[], sourceDoc: DocItem) => {
  const expectedName = companionSTName(sourceDoc.name);
  return docs.filter((doc) => doc.name === expectedName);
};

const syncRegistryFromContent = (fileName: string, content: string) => {
  const definitions = STDefinitionsRegistry.extractFromSource(content, fileName);
  if (definitions.length > 0) {
    STDefinitionsRegistry.setFileDefinitions(fileName, definitions);
  } else {
    STDefinitionsRegistry.removeFile(fileName);
  }
};

export const syncSemanticCompanionFiles = async ({
  workspaceId,
  state,
  documentRefs
}: SyncSemanticCompanionFilesOptions) => {
  const normalizedState = normalizeSemanticWorkspaceState(state);
  const uniqueRefs = Array.from(new Map(documentRefs.map((ref) => [getDocKey(ref), ref])).values())
    .filter((ref) => ref.docId || ref.docName);

  if (uniqueRefs.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[companionSync] No document refs to sync');
    }
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[companionSync] Syncing', uniqueRefs.length, 'refs, concepts in state:', normalizedState.concepts.length);
  }

  const docs = await fetchDocsApi({ workspaceId });

  await Promise.all(uniqueRefs.map(async (ref) => {
    const sourceDoc = resolveSourceDocument(docs, ref);
    if (!sourceDoc?.name) return;

    const scopedState = filterSemanticWorkspaceStateByDocument(normalizedState, {
      docId: sourceDoc.id,
      docName: sourceDoc.name
    });
    const fileName = companionSTName(sourceDoc.name);
    const content = buildSTFromSemantic(scopedState, sourceDoc.name);
    const companionDocs = resolveCompanionDocuments(docs, sourceDoc);

    if (companionDocs.length > 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[companionSync] Updating', companionDocs.length, 'companion(s)', fileName, 'concepts:', scopedState.concepts.length);
      }
      /* Update ALL companions with the same name (handles duplicates) */
      await Promise.all(companionDocs.map((doc) => updateDocumentApi(doc.id, { content })));
      syncRegistryFromContent(fileName, content);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agora:docs-changed'));
        /* Dispatch an event per companion so every open tab refreshes */
        for (const doc of companionDocs) {
          window.dispatchEvent(new CustomEvent('agora:doc-content-updated', {
            detail: { docId: doc.id, docName: fileName }
          }));
        }
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[companionSync] Dispatched agora:doc-content-updated for', companionDocs.map((d) => d.id).join(', '));
        }
      }
      return;
    }

    if (scopedState.concepts.length === 0) {
      STDefinitionsRegistry.removeFile(fileName);
      return;
    }

    const created = await createDocumentApi({
      name: fileName,
      content,
      type: 'text',
      workspaceId,
      folder: sourceDoc.folder || 'Material'
    });

    if (created?.id) {
      syncRegistryFromContent(fileName, content);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agora:docs-changed'));
        window.dispatchEvent(new CustomEvent('agora:doc-content-updated', {
          detail: { docId: created.id, docName: fileName }
        }));
      }
    }
  }));
};