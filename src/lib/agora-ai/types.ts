export type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'gemini';
export type AgentMode = 'chat' | 'agent';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AgentPendingConfirmation {
  toolCallId: string;
  toolName: string;
  prompt: string;
  args: Record<string, unknown>;
}

export interface AgentRollbackAction {
  action: string;
  args: Record<string, unknown>;
}

export interface AgentToolExecutionResult {
  ok: boolean;
  name: string;
  callId: string;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
  requiresConfirmation?: boolean;
  pendingConfirmation?: AgentPendingConfirmation;
  rollback?: AgentRollbackAction[];
}

export interface AgentTraceStep {
  id: string;
  type: 'thinking' | 'plan' | 'tool_call' | 'tool_result' | 'final' | 'confirmation' | 'error';
  title: string;
  content?: string;
  call?: AgentToolCall;
  result?: AgentToolExecutionResult;
  startedAt: number;
  finishedAt?: number;
}

export interface AgentRun {
  mode: AgentMode;
  provider: AIProvider;
  iterations: number;
  steps: AgentTraceStep[];
  finalReply: string;
  pendingConfirmation?: AgentPendingConfirmation;
  rollback?: AgentRollbackAction[];
}

export interface AgentStoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  agentRun?: AgentRun;
  pendingConfirmation?: AgentPendingConfirmation;
}

export interface AgentChatSession {
  id: string;
  title: string;
  workspaceId: string;
  provider: AIProvider;
  mode: AgentMode;
  messages: AgentStoredChatMessage[];
  rollbackQueue: AgentRollbackAction[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentDocumentTarget {
  id: string;
  name: string;
  type?: string;
  folder?: string;
  content?: string;
  mimeType?: string | null;
  workspaceId?: string;
  ownerId?: string;
}

export interface AgentOpenDocumentsEventDetail {
  workspaceId: string;
  documents: AgentDocumentTarget[];
  focusFolder?: string;
  source: 'agora-ai';
}

export interface AgentDocumentsMutatedEventDetail {
  workspaceId: string;
  mutations: Array<{
    action: string;
    result: AgentToolExecutionResult;
  }>;
  source: 'agora-ai';
}

export type AgentStreamEvent =
  | { type: 'connected' }
  | { type: 'status'; status: string }
  | { type: 'step'; step: AgentTraceStep }
  | { type: 'complete'; reply: string; agentRun: AgentRun }
  | { type: 'error'; error: string };

export interface ToolJsonSchema {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: ToolJsonSchema;
}

export interface AgentRequestBody {
  messages: ChatMessage[];
  workspaceId?: string;
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  mode?: AgentMode;
}

export interface AgentResponseBody {
  reply: string;
  agentRun?: AgentRun;
  error?: string;
}

export interface AgentExecutionContext {
  workspaceId: string;
  uid: string;
  email?: string | null;
  origin?: string;
}
