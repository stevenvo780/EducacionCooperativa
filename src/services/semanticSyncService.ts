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
import { AGORA_EVENTS, dispatchAgoraEvent } from '@/lib/agora-events';
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

export interface SyncSemanticCompanionForDocumentResult extends CompanionSyncLog {
  content: string | null;
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

const emitCompanionEvents = (workspaceId: string, companionName: string, companionDocIds: string[]) => {
  if (typeof window === 'undefined' || companionDocIds.length === 0) return;

  dispatchAgoraEvent(AGORA_EVENTS.docsChanged, { workspaceId });
  companionDocIds.forEach((docId) => {
    dispatchAgoraEvent(AGORA_EVENTS.docContentUpdated, { docId, docName: companionName });
  });
};

const syncSemanticCompanionForSourceDocument = async (options: {
  workspaceId: string;
  state: SemanticWorkspaceState;
  docs: DocItem[];
  sourceDoc: Pick<DocItem, 'id' | 'name' | 'folder' | 'content'>;
  ownerId?: string | null;
}): Promise<SyncSemanticCompanionForDocumentResult> => {
  const scopedState = filterSemanticWorkspaceStateByDocument(options.state, {
    docId: options.sourceDoc.id,
    docName: options.sourceDoc.name
  });
  const companionName = companionSTName(options.sourceDoc.name);
  const companionDocs = resolveCompanionDocuments(options.docs, options.sourceDoc as DocItem);

  if (scopedState.concepts.length === 0 && scopedState.fragments.length === 0 && scopedState.relations.length === 0) {
    STDefinitionsRegistry.removeFile(companionName);
    return {
      sourceDocName: options.sourceDoc.name,
      companionName,
      action: 'skipped',
      companionDocIds: companionDocs.map((doc) => doc.id),
      content: null
    };
  }

  if (companionDocs.length > 0) {
    const mergedContents = await Promise.all(companionDocs.map(async (doc) => {
      let existingContent = '';
      try {
        existingContent = await fetchDocumentRawApi(doc.id);
      } catch {
        existingContent = doc.content || '';
      }
      const content = buildSTFromSemantic(scopedState, options.sourceDoc.name, { existingContent });
      await updateDocumentApi(doc.id, { content });
      return { docId: doc.id, content };
    }));

    const nextContent = mergedContents[0]?.content || '';
    syncRegistryFromContent(companionName, nextContent);
    emitCompanionEvents(options.workspaceId, companionName, companionDocs.map((doc) => doc.id));
    return {
      sourceDocName: options.sourceDoc.name,
      companionName,
      action: 'updated',
      companionDocIds: companionDocs.map((doc) => doc.id),
      content: nextContent
    };
  }

  const content = buildSTFromSemantic(scopedState, options.sourceDoc.name);
  const created = await createDocumentApi({
    name: companionName,
    content,
    type: 'text',
    ownerId: options.ownerId || undefined,
    workspaceId: options.workspaceId,
    folder: options.sourceDoc.folder || 'Material'
  });

  if (created?.id) {
    syncRegistryFromContent(companionName, content);
    emitCompanionEvents(options.workspaceId, companionName, [created.id]);
    return {
      sourceDocName: options.sourceDoc.name,
      companionName,
      action: 'created',
      companionDocIds: [created.id],
      content
    };
  }

  return {
    sourceDocName: options.sourceDoc.name,
    companionName,
    action: 'skipped',
    companionDocIds: [],
    content: null
  };
};

export const syncSemanticCompanionForDocument = async (options: {
  workspaceId: string;
  state: SemanticWorkspaceState;
  docId?: string | null;
  docName: string;
  folder?: string | null;
  ownerId?: string | null;
}): Promise<SyncSemanticCompanionForDocumentResult> => {
  const docs = await fetchDocsApi({ workspaceId: options.workspaceId });
  const resolvedSourceDoc = resolveSourceDocument(docs, {
    docId: options.docId ?? null,
    docName: options.docName
  }) ?? {
    id: options.docId || options.docName,
    name: options.docName,
    folder: options.folder || 'Material',
    content: ''
  };

  return syncSemanticCompanionForSourceDocument({
    workspaceId: options.workspaceId,
    state: normalizeSemanticWorkspaceState(options.state),
    docs,
    sourceDoc: resolvedSourceDoc,
    ownerId: options.ownerId
  });
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
    const log = await syncSemanticCompanionForSourceDocument({
      workspaceId,
      state: normalizedState,
      docs,
      sourceDoc,
      ownerId
    });
    logs.push(log);
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
