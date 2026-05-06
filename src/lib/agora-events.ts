import type {
  AgentDiagnosticEventDetail,
  AgentDocumentsMutatedEventDetail,
  AgentOpenDocumentsEventDetail,
  AgentToolResultEventDetail,
  AgentUiCommandEventDetail,
  AgentWorkerCommandEventDetail
} from '@/lib/agora-ai/types';
import type { SyncEvent } from '@/types/sync';
import type { LinterDiagnostic } from '@/lib/markdown-linter/types';

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
  focusDocumentSection: 'agora:focus-document-section',
  touchDragStart: 'agora:touch-drag-start',
  touchDragOver: 'agora:touch-drag-over',
  touchDragLeave: 'agora:touch-drag-leave',
  touchDrop: 'agora:touch-drop',
  touchDragEnd: 'agora:touch-drag-end',
  promptUserChoice: 'agora:prompt-user-choice',
  showDiff: 'agora:show-diff',
  agentStatus: 'agora:agent-status',
  agentPlan: 'agora:agent-plan'
} as const;

export type TouchDropPosition = 'left' | 'right' | 'top' | 'bottom' | 'replace';

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

export interface AgoraDocContentUpdatedDetail {
  docId: string;
  docName?: string;
  updatedAt?: number;
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
  [AGORA_EVENTS.docContentUpdated]: AgoraDocContentUpdatedDetail;
  [AGORA_EVENTS.jumpToLine]: { docId?: string; line: number; column?: number };
  [AGORA_EVENTS.insertSnippet]: { markdown: string; docId?: string };
  [AGORA_EVENTS.openAiConfig]: void;
  [AGORA_EVENTS.openLinterConfig]: void;
  [AGORA_EVENTS.openBottomDock]: { tab?: string };
  [AGORA_EVENTS.planRequired]: {
    kind?: 'plan' | 'quota';
    currentPlan?: string;
    feature?: string;
    message?: string;
    reason?: string;
  };
  [AGORA_EVENTS.mdDiagnostics]: {
    diagnostics: LinterDiagnostic[];
    docId?: string | null;
  };
  [AGORA_EVENTS.stDiagnostics]: {
    diagnostics: Array<{
      line?: number;
      column?: number;
      endLine?: number;
      endColumn?: number;
      severity: string;
      message: string;
      code?: string;
    }>;
    docId?: string | null;
  };
  [AGORA_EVENTS.stEditorConfigChanged]: unknown;
  [AGORA_EVENTS.stSourceSaved]: { docId: string; docName?: string; content?: string };
  [AGORA_EVENTS.semanticPreferencesChanged]: {
    workspaceId?: string;
    preferences?: unknown;
  };
  [AGORA_EVENTS.focusDocumentSection]: {
    documentId: string;
    headingTitle?: string | null;
    line?: number | null;
  };
  [AGORA_EVENTS.touchDragStart]: { docId: string };
  [AGORA_EVENTS.touchDragOver]: { tileId: string; position: TouchDropPosition };
  [AGORA_EVENTS.touchDragLeave]: Record<string, never>;
  [AGORA_EVENTS.touchDrop]: {
    docId: string;
    tileId: string;
    position: TouchDropPosition;
  };
  [AGORA_EVENTS.touchDragEnd]: Record<string, never>;
  [AGORA_EVENTS.promptUserChoice]: unknown;
  [AGORA_EVENTS.showDiff]: unknown;
  [AGORA_EVENTS.agentStatus]: unknown;
  [AGORA_EVENTS.agentPlan]: unknown;
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
