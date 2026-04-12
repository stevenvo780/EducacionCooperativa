import { DocumentType } from '@/types/documents';
import type {
  AgentDocumentTarget,
  AgentDocumentsMutatedEventDetail,
  AgentOpenDocumentsEventDetail,
  AgentRun,
  AgentToolExecutionResult
} from '@/lib/agora-ai/types';

const OPENABLE_ACTIONS = new Set([
  'read_document',
  'create_document',
  'update_document',
  'rename_document',
  'move_document'
]);

const MUTATION_ACTIONS = new Set([
  'create_document',
  'update_document',
  'rename_document',
  'move_document',
  'delete_document',
  'create_folder',
  'restore_document',
  'create_snippet',
  'delete_snippet'
]);

function toDocumentTarget(result: AgentToolExecutionResult, workspaceId: string): AgentDocumentTarget | null {
  const raw = result.data?.document;
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Record<string, unknown>;
  if (typeof doc.id !== 'string' || !doc.id.trim()) return null;
  return {
    id: doc.id,
    name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Sin título',
    type: typeof doc.type === 'string' ? doc.type : DocumentType.Text,
    folder: typeof doc.folder === 'string' ? doc.folder : '',
    content: typeof doc.content === 'string' ? doc.content : undefined,
    mimeType: typeof doc.mimeType === 'string' ? doc.mimeType : null,
    workspaceId
  };
}

export function collectAgentWorkspaceEffects(agentRun: AgentRun | undefined, workspaceId: string) {
  if (!agentRun) {
    return {
      openDocumentsEvent: null as AgentOpenDocumentsEventDetail | null,
      mutatedEvent: null as AgentDocumentsMutatedEventDetail | null
    };
  }

  const seenDocuments = new Set<string>();
  const documents: AgentDocumentTarget[] = [];
  const mutations: AgentDocumentsMutatedEventDetail['mutations'] = [];
  let focusFolder: string | undefined;

  for (const step of agentRun.steps) {
    const result = step.result;
    if (!result?.ok) continue;

    if (MUTATION_ACTIONS.has(result.name)) {
      mutations.push({ action: result.name, result });
    }

    const maybeDocument = toDocumentTarget(result, workspaceId);
    if (!maybeDocument) continue;

    if (maybeDocument.type === DocumentType.Folder) {
      if (!focusFolder && maybeDocument.folder) {
        focusFolder = maybeDocument.folder;
      }
      continue;
    }

    if (!OPENABLE_ACTIONS.has(result.name)) continue;
    if (seenDocuments.has(maybeDocument.id)) continue;

    seenDocuments.add(maybeDocument.id);
    documents.push(maybeDocument);
    if (!focusFolder && maybeDocument.folder) {
      focusFolder = maybeDocument.folder;
    }
  }

  return {
    openDocumentsEvent: documents.length
      ? {
        workspaceId,
        documents,
        focusFolder,
        source: 'agora-ai' as const
      }
      : null,
    mutatedEvent: mutations.length
      ? {
        workspaceId,
        mutations,
        source: 'agora-ai' as const
      }
      : null
  };
}
