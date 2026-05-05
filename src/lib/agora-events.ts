import type {
  AgentDiagnosticEventDetail,
  AgentDocumentsMutatedEventDetail,
  AgentOpenDocumentsEventDetail,
  AgentToolResultEventDetail,
  AgentUiCommandEventDetail,
  AgentWorkerCommandEventDetail
} from '@/lib/agora-ai/types';
import type { SyncEvent } from '@/types/sync';

export const AGORA_EVENTS = {
  agentToolResult: 'agora:agent-tool-result',
  workerCommandResult: 'agora:worker-command-result',
  agentUiCommand: 'agora:agent-ui-command',
  agentDiagnostic: 'agora:agent-diagnostic',
  documentsMutated: 'agora:documents-mutated',
  docsChanged: 'agora:docs-changed',
  openDocuments: 'agora:open-documents',
  rtdbEvent: 'agora:rtdb-event',
  problem: 'agora:problem',
  documentContent: 'agora:document-content',
  docContentUpdated: 'agora:doc-content-updated',
  jumpToLine: 'agora:jump-to-line',
  insertSnippet: 'agora:insert-snippet',
  openAiConfig: 'agora:open-ai-config',
  openLinterConfig: 'agora:open-linter-config',
  openBottomDock: 'agora:open-bottom-dock',
  planRequired: 'agora:plan-required',
  mdDiagnostics: 'agora:md-diagnostics',
  stDiagnostics: 'agora:st-diagnostics',
  stEditorConfigChanged: 'agora:st-editor-config-changed',
  stSourceSaved: 'agora:st-source-saved',
  semanticPreferencesChanged: 'agora:semantic-preferences-changed',
  focusDocumentSection: 'agora:focus-document-section'
} as const;

export interface AgoraProblemEventDetail {
  severity?: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
  uri?: string;
  message: string;
  detail?: string;
  code?: string;
}

export interface AgoraDocumentContentDetail {
  docId: string;
  content: string;
}

type AgoraWindowEventMap = {
  [AGORA_EVENTS.agentToolResult]: AgentToolResultEventDetail;
  [AGORA_EVENTS.workerCommandResult]: AgentWorkerCommandEventDetail;
  [AGORA_EVENTS.agentUiCommand]: AgentUiCommandEventDetail;
  [AGORA_EVENTS.agentDiagnostic]: AgentDiagnosticEventDetail;
  [AGORA_EVENTS.documentsMutated]: AgentDocumentsMutatedEventDetail;
  [AGORA_EVENTS.docsChanged]: void;
  [AGORA_EVENTS.openDocuments]: AgentOpenDocumentsEventDetail;
  [AGORA_EVENTS.rtdbEvent]: SyncEvent;
  [AGORA_EVENTS.problem]: AgoraProblemEventDetail;
  [AGORA_EVENTS.documentContent]: AgoraDocumentContentDetail;
  [AGORA_EVENTS.docContentUpdated]: { docId: string; updatedAt?: number };
  [AGORA_EVENTS.jumpToLine]: { docId?: string; line: number; column?: number };
  [AGORA_EVENTS.insertSnippet]: { docId?: string; snippet: string };
  [AGORA_EVENTS.openAiConfig]: void;
  [AGORA_EVENTS.openLinterConfig]: void;
  [AGORA_EVENTS.openBottomDock]: { tab?: string };
  [AGORA_EVENTS.planRequired]: { reason?: string };
  [AGORA_EVENTS.mdDiagnostics]: { docId?: string; count?: number };
  [AGORA_EVENTS.stDiagnostics]: { docId?: string; count?: number };
  [AGORA_EVENTS.stEditorConfigChanged]: Record<string, unknown>;
  [AGORA_EVENTS.stSourceSaved]: { docId: string };
  [AGORA_EVENTS.semanticPreferencesChanged]: Record<string, unknown>;
  [AGORA_EVENTS.focusDocumentSection]: { docId: string; section?: string };
};

type AgoraEventName = keyof AgoraWindowEventMap;

export function dispatchAgoraEvent<Name extends AgoraEventName>(
  name: Name,
  ...detail: AgoraWindowEventMap[Name] extends void ? [] : [detail: AgoraWindowEventMap[Name]]
): void {
  if (typeof window === 'undefined') return;
  if (detail.length === 0) {
    window.dispatchEvent(new Event(name));
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail: detail[0] }));
}

export function subscribeAgoraEvent<Name extends AgoraEventName>(
  name: Name,
  handler: AgoraWindowEventMap[Name] extends void
    ? () => void
    : (detail: AgoraWindowEventMap[Name]) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener: EventListener = (event) => {
    const detail = (event as CustomEvent<AgoraWindowEventMap[Name]>).detail;
    (handler as (d?: AgoraWindowEventMap[Name]) => void)(detail);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
