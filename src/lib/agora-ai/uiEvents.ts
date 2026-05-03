import { DocumentType } from '@/types/documents';
import type {
  AgentDocumentTarget,
  AgentDocumentsMutatedEventDetail,
  AgentDiagnosticEventDetail,
  AgentOpenDocumentsEventDetail,
  AgentRun,
  AgentToolResultEventDetail,
  AgentUiCommand,
  AgentUiCommandEventDetail,
  AgentWorkerCommandEventDetail,
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

const DOCUMENT_REFRESH_ACTIONS = new Set([
  ...MUTATION_ACTIONS,
  'run_worker_command',
  'git_commit_workspace'
]);

function toUiCommand(raw: unknown): AgentUiCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const command = raw as Record<string, unknown>;
  const type = typeof command.type === 'string' ? command.type : '';
  if (!type) return null;
  return {
    type: type as AgentUiCommand['type'],
    panel: typeof command.panel === 'string' ? command.panel as AgentUiCommand['panel'] : undefined,
    folder: typeof command.folder === 'string' ? command.folder : undefined
  };
}

function toDiagnostic(result: AgentToolExecutionResult, workspaceId: string): AgentDiagnosticEventDetail | null {
  const raw = result.data?.diagnostic;
  if (raw && typeof raw === 'object') {
    const diagnostic = raw as Record<string, unknown>;
    const message = typeof diagnostic.message === 'string' && diagnostic.message.trim()
      ? diagnostic.message.trim()
      : result.summary;
    const severity = typeof diagnostic.severity === 'string' ? diagnostic.severity : 'info';
    return {
      workspaceId,
      severity: severity === 'error' || severity === 'warning' || severity === 'hint' ? severity : 'info',
      message,
      detail: typeof diagnostic.detail === 'string' ? diagnostic.detail : undefined,
      code: typeof diagnostic.code === 'string' ? diagnostic.code : undefined,
      source: 'agora-ai'
    };
  }
  if (result.ok) return null;
  return {
    workspaceId,
    severity: 'error',
    message: `Error en ${result.name}`,
    detail: result.error || result.summary,
    code: result.name,
    source: 'agora-ai'
  };
}

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
      mutatedEvent: null as AgentDocumentsMutatedEventDetail | null,
      toolEvents: [] as AgentToolResultEventDetail[],
      workerCommandEvents: [] as AgentWorkerCommandEventDetail[],
      uiCommandEvents: [] as AgentUiCommandEventDetail[],
      diagnosticEvents: [] as AgentDiagnosticEventDetail[],
      shouldRefreshDocuments: false
    };
  }

  const seenDocuments = new Set<string>();
  const documents: AgentDocumentTarget[] = [];
  const mutations: AgentDocumentsMutatedEventDetail['mutations'] = [];
  const toolEvents: AgentToolResultEventDetail[] = [];
  const workerCommandEvents: AgentWorkerCommandEventDetail[] = [];
  const uiCommandEvents: AgentUiCommandEventDetail[] = [];
  const diagnosticEvents: AgentDiagnosticEventDetail[] = [];
  let focusFolder: string | undefined;
  let shouldRefreshDocuments = false;

  for (const step of agentRun.steps) {
    const result = step.result;
    if (!result) continue;

    toolEvents.push({ workspaceId, result, source: 'agora-ai' });

    const diagnostic = toDiagnostic(result, workspaceId);
    if (diagnostic) {
      diagnosticEvents.push(diagnostic);
    }

    if (
      DOCUMENT_REFRESH_ACTIONS.has(result.name)
      && (
        (result.name === 'run_worker_command' || result.name === 'git_commit_workspace')
          ? result.data?.mayHaveChangedWorkspace === true
          : true
      )
    ) {
      shouldRefreshDocuments = true;
    }

    if (!result.ok) continue;

    const uiCommand = toUiCommand(result.data?.uiCommand);
    if (uiCommand) {
      uiCommandEvents.push({ workspaceId, command: uiCommand, source: 'agora-ai' });
    }

    if (MUTATION_ACTIONS.has(result.name)) {
      mutations.push({ action: result.name, result });
    }
    if (result.name === 'run_worker_command') {
      workerCommandEvents.push({
        workspaceId,
        command: typeof result.data?.command === 'string' ? result.data.command : '',
        cwd: typeof result.data?.cwd === 'string' ? result.data.cwd : undefined,
        ok: typeof result.data?.commandOk === 'boolean' ? result.data.commandOk : result.ok,
        exitCode: typeof result.data?.exitCode === 'number' ? result.data.exitCode : null,
        stdout: typeof result.data?.stdout === 'string' ? result.data.stdout : undefined,
        stderr: typeof result.data?.stderr === 'string' ? result.data.stderr : undefined,
        source: 'agora-ai'
      });
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
      : null,
    toolEvents,
    workerCommandEvents,
    uiCommandEvents,
    diagnosticEvents,
    shouldRefreshDocuments
  };
}
