import type { AgentChatSession, AgentMode, AgentRollbackAction, AgentStoredChatMessage, AIProvider } from '@/lib/agora-ai/types';
import { AGORA_EVENTS, dispatchAgoraEvent } from '@/lib/agora-events';

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
const compactMessages = (messages: AgentStoredChatMessage[]) => (
  messages.map(truncateAgentRun)
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
  if (!provider || !['openai', 'anthropic', 'ollama', 'gemini', 'deepseek', 'minimax'].includes(provider)) return null;
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
    messages: compactMessages(messages),
    rollbackQueue: normalizeRollbackQueue(raw.rollbackQueue),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
  };
};

export const sortChatSessions = (sessions: AgentChatSession[]) => (
  sessions.slice().sort((left, right) => right.updatedAt - left.updatedAt)
);

export const orderChatSessions = (sessions: AgentChatSession[]) => sortChatSessions(sessions);

export const loadChatSessions = (workspaceId: string): AgentChatSession[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(getChatHistoryStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return orderChatSessions(
      parsed
        .map(normalizeSession)
        .filter((session): session is AgentChatSession => session !== null && session.workspaceId === workspaceId)
    );
  } catch {
    return [];
  }
};

const isQuotaExceededError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: unknown; code?: unknown };
  if (typeof err.name === 'string' && /quota|exceeded/i.test(err.name)) return true;
  if (typeof err.code === 'number' && err.code === 22) return true;
  return false;
};

const halveSessionMessages = (sessions: AgentChatSession[]): { sessions: AgentChatSession[]; changed: boolean } => {
  let changed = false;
  const reduced = sessions.map((session) => {
    if (session.messages.length <= 1) return session;
    const half = Math.max(1, Math.floor(session.messages.length / 2));
    const truncated = session.messages.slice(-half);
    if (truncated.length !== session.messages.length) changed = true;
    return { ...session, messages: truncated };
  });
  return { sessions: reduced, changed };
};

const evictOldestSession = (sessions: AgentChatSession[]): { sessions: AgentChatSession[]; evicted: AgentChatSession | null } => {
  if (sessions.length <= 1) return { sessions, evicted: null };
  let oldestIdx = 0;
  for (let i = 1; i < sessions.length; i += 1) {
    const current = sessions[i];
    const oldest = sessions[oldestIdx];
    if (current && oldest && current.updatedAt < oldest.updatedAt) {
      oldestIdx = i;
    }
  }
  const evicted = sessions[oldestIdx] ?? null;
  const next = sessions.filter((_, idx) => idx !== oldestIdx);
  return { sessions: next, evicted };
};

const writeSessionsToStorage = (workspaceId: string, sessions: AgentChatSession[]) => {
  window.localStorage.setItem(getChatHistoryStorageKey(workspaceId), JSON.stringify(sessions));
};

export const saveChatSessions = (workspaceId: string, sessions: AgentChatSession[]) => {
  const next = orderChatSessions(sessions).map((session) => ({
    ...session,
    messages: compactMessages(session.messages)
  }));
  if (!isBrowser()) return next;

  try {
    writeSessionsToStorage(workspaceId, next);
    return next;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      dispatchAgoraEvent(AGORA_EVENTS.problem, {
        source: 'agora-ai',
        uri: 'global',
        severity: 'warning',
        message: 'No se pudo guardar el historial de Agora AI en localStorage',
        detail: error instanceof Error ? error.message : String(error),
        code: 'agora-ai-history-save'
      });
      return next;
    }

    let attempt = next;
    let evictedCount = 0;
    let halvedAttempts = 0;
    let succeeded = false;

    for (let i = 0; i < 8; i += 1) {
      const { sessions: halved, changed } = halveSessionMessages(attempt);
      if (!changed) break;
      attempt = halved;
      halvedAttempts += 1;
      try {
        writeSessionsToStorage(workspaceId, attempt);
        succeeded = true;
        break;
      } catch (retryError) {
        if (!isQuotaExceededError(retryError)) {
          dispatchAgoraEvent(AGORA_EVENTS.problem, {
            source: 'agora-ai',
            uri: 'global',
            severity: 'warning',
            message: 'Error inesperado guardando historial de Agora AI',
            detail: retryError instanceof Error ? retryError.message : String(retryError),
            code: 'agora-ai-history-save'
          });
          return attempt;
        }
      }
    }

    while (!succeeded && attempt.length > 1) {
      const { sessions: pruned, evicted } = evictOldestSession(attempt);
      if (!evicted) break;
      attempt = pruned;
      evictedCount += 1;
      try {
        writeSessionsToStorage(workspaceId, attempt);
        succeeded = true;
        break;
      } catch (retryError) {
        if (!isQuotaExceededError(retryError)) {
          dispatchAgoraEvent(AGORA_EVENTS.problem, {
            source: 'agora-ai',
            uri: 'global',
            severity: 'warning',
            message: 'Error inesperado guardando historial de Agora AI',
            detail: retryError instanceof Error ? retryError.message : String(retryError),
            code: 'agora-ai-history-save'
          });
          return attempt;
        }
      }
    }

    if (succeeded) {
      dispatchAgoraEvent(AGORA_EVENTS.problem, {
        source: 'agora-ai',
        uri: 'global',
        severity: 'warning',
        message: 'Historial de Agora AI ajustado por límite de localStorage',
        detail: `Se aplicó LRU sobre el historial (mensajes recortados: ${halvedAttempts} rondas, sesiones más antiguas evictadas: ${evictedCount}).`,
        code: 'agora-ai-history-truncated'
      });
      return attempt;
    }

    dispatchAgoraEvent(AGORA_EVENTS.problem, {
      source: 'agora-ai',
      uri: 'global',
      severity: 'error',
      message: 'localStorage sin espacio para el historial de Agora AI',
      detail: `Borra chats antiguos desde el panel de historial para liberar cuota (rondas: ${halvedAttempts}, evictadas: ${evictedCount}).`,
      code: 'agora-ai-history-quota'
    });
    return attempt;
  }
};

export const upsertChatSession = (sessions: AgentChatSession[], session: AgentChatSession) => {
  const next = sessions.filter((item) => item.id !== session.id);
  next.push({
    ...session,
    title: session.title?.trim() || deriveChatSessionTitle(session.messages),
    messages: compactMessages(session.messages)
  });
  return orderChatSessions(next);
};
