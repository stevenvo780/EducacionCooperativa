import type {
  AgentDiagnosticEventDetail,
  AgentDocumentsMutatedEventDetail,
  AgentOpenDocumentsEventDetail,
  AgentToolResultEventDetail,
  AgentUiCommandEventDetail,
  AgentWorkerCommandEventDetail
} from '@/lib/agora-ai/types';

export const AGORA_EVENTS = {
  agentToolResult: 'agora:agent-tool-result',
  workerCommandResult: 'agora:worker-command-result',
  agentUiCommand: 'agora:agent-ui-command',
  agentDiagnostic: 'agora:agent-diagnostic',
  documentsMutated: 'agora:documents-mutated',
  docsChanged: 'agora:docs-changed',
  openDocuments: 'agora:open-documents'
} as const;

type AgoraWindowEventMap = {
  [AGORA_EVENTS.agentToolResult]: AgentToolResultEventDetail;
  [AGORA_EVENTS.workerCommandResult]: AgentWorkerCommandEventDetail;
  [AGORA_EVENTS.agentUiCommand]: AgentUiCommandEventDetail;
  [AGORA_EVENTS.agentDiagnostic]: AgentDiagnosticEventDetail;
  [AGORA_EVENTS.documentsMutated]: AgentDocumentsMutatedEventDetail;
  [AGORA_EVENTS.docsChanged]: void;
  [AGORA_EVENTS.openDocuments]: AgentOpenDocumentsEventDetail;
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