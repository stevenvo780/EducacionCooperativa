import type { DocItem } from '@/components/dashboard/types';
import { buildSTFromSemantic, companionSTName } from '@/lib/buildSTFromSemantic';
import {
  filterSemanticWorkspaceStateByDocument,
  mergeSemanticWorkspaceStates,
  normalizeSemanticWorkspaceState,
  type SemanticConceptRecord,
  type SemanticDocumentRef,
  type SemanticFragmentRecord,
  type SemanticRelationRecord,
  type SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
import {
  buildTheoryGraphFromSTSource,
  projectTheoryGraphToSemanticState,
  type TheoryGraph
} from '@/lib/semantic/theory-graph';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import {
  createDocumentApi,
  fetchDocumentRawApi,
  fetchDocsApi,
  updateDocumentApi
} from '@/services/dashboardApi';
import { loadSemanticWorkspaceState, saveSemanticWorkspaceState } from '@/services/editorSemanticStore';
import { saveSemanticWorkspaceStateApi } from '@/services/semanticStateApi';

interface SyncSemanticCompanionFilesOptions {
  workspaceId: string;
  state: SemanticWorkspaceState;
  documentRefs: SemanticDocumentRef[];
  ownerId?: string | null;
}

interface CompanionSyncLog {
  sourceDocName: string;
  companionName: string;
  action: 'created' | 'updated' | 'skipped';
  companionDocIds: string[];
}

export interface SyncSemanticCompanionFilesResult {
  logs: CompanionSyncLog[];
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
  documentRefs,
  ownerId
}: SyncSemanticCompanionFilesOptions): Promise<SyncSemanticCompanionFilesResult> => {
  const normalizedState = normalizeSemanticWorkspaceState(state);
  const uniqueRefs = Array.from(new Map(documentRefs.map((ref) => [getDocKey(ref), ref])).values())
    .filter((ref) => ref.docId || ref.docName);

  if (uniqueRefs.length === 0) {
    return { logs: [] };
  }

  const docs = await fetchDocsApi({ workspaceId });
  const logs: CompanionSyncLog[] = [];

  await Promise.all(uniqueRefs.map(async (ref) => {
    const sourceDoc = resolveSourceDocument(docs, ref);
    if (!sourceDoc?.name) return;

    const scopedState = filterSemanticWorkspaceStateByDocument(normalizedState, {
      docId: sourceDoc.id,
      docName: sourceDoc.name
    });
    const fileName = companionSTName(sourceDoc.name);
    const companionDocs = resolveCompanionDocuments(docs, sourceDoc);

    if (scopedState.concepts.length === 0 && scopedState.fragments.length === 0 && scopedState.relations.length === 0) {
      STDefinitionsRegistry.removeFile(fileName);
      logs.push({
        sourceDocName: sourceDoc.name,
        companionName: fileName,
        action: 'skipped',
        companionDocIds: companionDocs.map((doc) => doc.id)
      });
      return;
    }

    if (companionDocs.length > 0) {
      const mergedContents = await Promise.all(companionDocs.map(async (doc) => {
        let existingContent = '';
        try {
          existingContent = await fetchDocumentRawApi(doc.id);
        } catch {
          existingContent = doc.content || '';
        }
        const content = buildSTFromSemantic(scopedState, sourceDoc.name, { existingContent });
        await updateDocumentApi(doc.id, { content });
        return { docId: doc.id, content };
      }));

      syncRegistryFromContent(fileName, mergedContents[0]?.content || '');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agora:docs-changed'));
        companionDocs.forEach((doc) => {
          window.dispatchEvent(new CustomEvent('agora:doc-content-updated', {
            detail: { docId: doc.id, docName: fileName }
          }));
        });
      }
      logs.push({
        sourceDocName: sourceDoc.name,
        companionName: fileName,
        action: 'updated',
        companionDocIds: companionDocs.map((doc) => doc.id)
      });
      return;
    }

    const content = buildSTFromSemantic(scopedState, sourceDoc.name);
    const created = await createDocumentApi({
      name: fileName,
      content,
      type: 'text',
      ownerId: ownerId || undefined,
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
      logs.push({
        sourceDocName: sourceDoc.name,
        companionName: fileName,
        action: 'created',
        companionDocIds: [created.id]
      });
    }
  }));

  return { logs };
};

const matchesDoc = (
  docId: string | null | undefined,
  docName: string | null | undefined,
  record: { docId?: string | null; docName?: string | null }
) => {
  if (docId && record.docId === docId) return true;
  if (docName && record.docName === docName) return true;
  return false;
};

const withoutSTProjectionForDocument = (
  state: SemanticWorkspaceState,
  docId: string | null | undefined,
  docName: string | null | undefined
): SemanticWorkspaceState => ({
  ...state,
  concepts: state.concepts.filter((concept) => !(concept.origin === 'st-source' && matchesDoc(docId, docName, concept))),
  fragments: state.fragments.filter((fragment) => !(fragment.origin === 'st-source' && matchesDoc(docId, docName, fragment))),
  relations: state.relations.filter((relation) => !(relation.origin === 'st-source' && (relation.docId === docId || !docId))),
  updatedAt: state.updatedAt
});

export const syncSTSourceToSemanticWorkspace = async (options: {
  workspaceId: string;
  userId?: string | null;
  docId?: string | null;
  docName: string;
  source: string;
  persistRemote?: boolean;
}): Promise<{ state: SemanticWorkspaceState; graph: TheoryGraph }> => {
  const graph = buildTheoryGraphFromSTSource(options.source, {
    docId: options.docId ?? null,
    docName: options.docName,
    sourceFileName: options.docName,
    workspaceId: options.workspaceId
  });

  const context = { workspaceId: options.workspaceId, userId: options.userId ?? null };
  const currentState = loadSemanticWorkspaceState(context);

  if (graph.diagnostics.some((diagnostic) => diagnostic.type === 'parse-error' && diagnostic.severity === 'error')) {
    return { state: currentState, graph };
  }

  const projectedState = projectTheoryGraphToSemanticState(graph, {
    workspaceId: options.workspaceId,
    docId: options.docId ?? null,
    docName: options.docName
  });

  const baseState = withoutSTProjectionForDocument(
    normalizeSemanticWorkspaceState(currentState),
    options.docId ?? null,
    options.docName
  );
  const nextState = mergeSemanticWorkspaceStates(baseState, {
    ...projectedState,
    preferences: baseState.preferences
  });

  saveSemanticWorkspaceState(context, nextState);
  if (options.persistRemote !== false) {
    try {
      await saveSemanticWorkspaceStateApi(options.workspaceId, nextState);
    } catch {
      // Local state remains authoritative until the next sync succeeds.
    }
  }

  return { state: nextState, graph };
};

