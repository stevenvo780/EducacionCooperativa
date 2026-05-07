import type { AgentChatSession, AgentMode, AgentRollbackAction, AgentStoredChatMessage, AIProvider } from '@/lib/agora-ai/types';

const MAX_CHAT_SESSIONS = 50;
const MAX_CHAT_MESSAGES = 200;

const isBrowser = () => typeof window !== 'undefined';

// Truncar tool outputs largos de cada agentRun antes de persistir. Tool outputs
// (file content, terminal stdout) pueden ser MBs cada uno y hinchaban el chat
// history en localStorage a 20MB+. Mantenemos shape original.
const TOOL_RESULT_PREVIEW_CHARS = 800;
const STEP_CONTENT_PREVIEW_CHARS = 800;
const STEP_RESULT_DATA_PREVIEW_CHARS = 4000;
const truncateString = (val: unknown, max = TOOL_RESULT_PREVIEW_CHARS): unknown => {
  if (typeof val !== 'string') return val;
  if (val.length <= max) return val;
  return `${val.slice(0, max)}\n…[truncado ${val.length - max} chars]`;
};
const truncateStepData = (data: unknown): unknown => {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return truncateString(data, STEP_RESULT_DATA_PREVIEW_CHARS);
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length <= STEP_RESULT_DATA_PREVIEW_CHARS) return data;
    return `${serialized.slice(0, STEP_RESULT_DATA_PREVIEW_CHARS)}\n…[truncado ${serialized.length - STEP_RESULT_DATA_PREVIEW_CHARS} chars]`;
  } catch {
    return data;
  }
};
const truncateAgentRun = (msg: AgentStoredChatMessage): AgentStoredChatMessage => {
  const m = msg as unknown as {
    agentRun?: {
      toolResults?: Array<Record<string, unknown>>;
      steps?: Array<Record<string, unknown>>;
    };
  };
  if (!m.agentRun) return msg;
  const compactResults = m.agentRun.toolResults?.map((r) => {
    const next = { ...r };
    if ('output' in next) next['output'] = truncateString(next['output']);
    if ('result' in next) next['result'] = truncateString(next['result']);
    return next;
  });
  const compactSteps = m.agentRun.steps?.map((step) => {
    const next: Record<string, unknown> = { ...step };
    if (typeof next['content'] === 'string') {
      next['content'] = truncateString(next['content'], STEP_CONTENT_PREVIEW_CHARS);
    }
    const result = next['result'];
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      const compactResult: Record<string, unknown> = { ...r };
      if ('data' in compactResult) compactResult['data'] = truncateStepData(compactResult['data']);
      if (typeof compactResult['summary'] === 'string') {
        compactResult['summary'] = truncateString(compactResult['summary'], STEP_CONTENT_PREVIEW_CHARS);
      }
      if (typeof compactResult['error'] === 'string') {
        compactResult['error'] = truncateString(compactResult['error'], STEP_CONTENT_PREVIEW_CHARS);
      }
      next['result'] = compactResult;
    }
    return next;
  });
  const nextRun: Record<string, unknown> = { ...m.agentRun };
  if (compactResults) nextRun['toolResults'] = compactResults;
  if (compactSteps) nextRun['steps'] = compactSteps;
  return { ...msg, agentRun: nextRun } as unknown as AgentStoredChatMessage;
};
const clampMessages = (messages: AgentStoredChatMessage[]) => (
  messages.slice(-MAX_CHAT_MESSAGES).map(truncateAgentRun)
);

export const getChatHistoryStorageKey = (workspaceId: string) => `agora-ai-chats:${workspaceId}`;

export const deriveChatSessionTitle = (messages: AgentStoredChatMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!firstUserMessage) return 'Nuevo chat';
  const normalized = firstUserMessage.content
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 48 ? `${normalized.slice(0, 47)}…` : normalized;
};

export const createEmptyChatSession = (params: {
  workspaceId: string;
  provider: AIProvider;
  mode: AgentMode;
  now?: number;
}): AgentChatSession => {
  const now = params.now ?? Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nuevo chat',
    workspaceId: params.workspaceId,
    provider: params.provider,
    mode: params.mode,
    messages: [],
    rollbackQueue: [],
    createdAt: now,
    updatedAt: now
  };
};

const normalizeMessage = (value: unknown): AgentStoredChatMessage | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<AgentStoredChatMessage>;
  if (typeof raw.id !== 'string') return null;
  if (raw.role !== 'user' && raw.role !== 'assistant') return null;
  return {
    id: raw.id,
    role: raw.role,
    content: typeof raw.content === 'string' ? raw.content : '',
    ...(typeof raw.error === 'boolean' ? { error: raw.error } : {}),
    ...(raw.agentRun && typeof raw.agentRun === 'object' ? { agentRun: raw.agentRun } : {}),
    ...(raw.pendingConfirmation && typeof raw.pendingConfirmation === 'object' ? { pendingConfirmation: raw.pendingConfirmation } : {})
  };
};

const normalizeRollbackQueue = (value: unknown): AgentRollbackAction[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Partial<AgentRollbackAction>;
      if (typeof raw.action !== 'string') return null;
      return {
        action: raw.action,
        args: raw.args && typeof raw.args === 'object' ? raw.args as Record<string, unknown> : {}
      };
    })
    .filter((item): item is AgentRollbackAction => item !== null);
};

const normalizeSession = (value: unknown): AgentChatSession | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<AgentChatSession>;
  if (typeof raw.id !== 'string' || typeof raw.workspaceId !== 'string') return null;
  const provider = raw.provider;
  const mode = raw.mode;
  if (!provider || !['openai', 'anthropic', 'ollama', 'gemini', 'deepseek'].includes(provider)) return null;
  if (!mode || !['chat', 'agent'].includes(mode)) return null;
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage).filter((item): item is AgentStoredChatMessage => item !== null)
    : [];
  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : deriveChatSessionTitle(messages),
    workspaceId: raw.workspaceId,
    provider,
    mode,
    messages: clampMessages(messages),
    rollbackQueue: normalizeRollbackQueue(raw.rollbackQueue),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
  };
};

export const sortChatSessions = (sessions: AgentChatSession[]) => (
  sessions.slice().sort((left, right) => right.updatedAt - left.updatedAt)
);

export const trimChatSessions = (sessions: AgentChatSession[]) => sortChatSessions(sessions).slice(0, MAX_CHAT_SESSIONS);

export const loadChatSessions = (workspaceId: string): AgentChatSession[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(getChatHistoryStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return trimChatSessions(
      parsed
        .map(normalizeSession)
        .filter((session): session is AgentChatSession => session !== null && session.workspaceId === workspaceId)
    );
  } catch {
    return [];
  }
};

export const saveChatSessions = (workspaceId: string, sessions: AgentChatSession[]) => {
  const next = trimChatSessions(sessions).map((session) => ({
    ...session,
    messages: clampMessages(session.messages)
  }));
  if (isBrowser()) {
    window.localStorage.setItem(getChatHistoryStorageKey(workspaceId), JSON.stringify(next));
  }
  return next;
};

export const upsertChatSession = (sessions: AgentChatSession[], session: AgentChatSession) => {
  const next = sessions.filter((item) => item.id !== session.id);
  next.push({
    ...session,
    title: session.title?.trim() || deriveChatSessionTitle(session.messages),
    messages: clampMessages(session.messages)
  });
  return trimChatSessions(next);
};
