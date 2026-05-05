'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Bot, Send, Settings, ChevronDown,
  Loader2, Trash2, Copy, Check, AlertCircle, Undo2,
  History, MessageSquarePlus, Shield, Square,
  ListTree, ChevronsDownUp, ChevronsUpDown
} from 'lucide-react';
import { apiUrl, authFetch, getAuthToken } from '@/services/apiClient';
import { fetchZod } from '@/lib/fetch-zod';
import { agentResponseBodySchema, agentContextResponseSchema } from '@agora/contracts';
import {
  createEmptyChatSession,
  deriveChatSessionTitle,
  loadChatSessions,
  saveChatSessions,
  upsertChatSession
} from '@/lib/agora-ai/chatHistory';
import { AgentThinkingBlock } from '@/components/chat/AgentThinkingBlock';
import { ToolCallBlock } from '@/components/chat/ToolCallBlock';
import { InlineConfirmation } from '@/components/chat/InlineConfirmation';
import { buildAgoraSystemPrompt, extractThinkingSegments } from '@/lib/agora-ai/systemPrompt';
import { toOllamaTools } from '@/lib/agora-ai/toolDefinitions';
import { collectAgentWorkspaceEffects } from '@/lib/agora-ai/uiEvents';
import { AGORA_EVENTS, dispatchAgoraEvent } from '@/lib/agora-events';
import { parseSlashCommand, type SlashCommandHelp } from '@/lib/agora-ai/slashCommands';
import {
  AI_SETTINGS_CHANGED_EVENT,
  PROVIDER_META,
  loadAIProviderConfig,
  saveAIProviderConfig,
  loadAgentAccessPolicy,
  saveAgentAccessProfile,
  loadAgentTraceExpanded,
  saveAgentTraceExpanded,
  loadAgentUserInstructions,
  type AIProviderConfig
} from '@/lib/agora-ai/clientSettings';
import { AGENT_ACCESS_PROFILE_ORDER, AGENT_ACCESS_PROFILES, normalizeAgentAccessPolicy, profileAutoConfirms } from '@/lib/agora-ai/accessPolicy';
import {
  contextWindowForModel as contextWindowFromCatalog,
  getModelCatalogSync,
  loadModelCatalog,
  type ModelCatalog
} from '@/lib/agora-ai/modelCatalog';
import type {
  AIProvider,
  AgentAccessPolicy,
  AgentAccessProfileId,
  AgentChatSession,
  AgentDocumentsMutatedEventDetail,
  AgentMode,
  AgentPendingConfirmation,
  AgentResponseBody,
  AgentRollbackAction,
  AgentRun,
  AgentStoredChatMessage,
  AgentStreamEvent,
  AgentToolCall,
  AgentToolExecutionResult,
  AgentTraceStep
} from '@/lib/agora-ai/types';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

type UIChatMessage = AgentStoredChatMessage;

interface AgoraAIChatProps {
  workspaceId?: string;
}

interface OllamaToolCallPayload {
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
}

interface OllamaChatResponse {
  message?: {
    content?: string;
    thinking?: string;
    tool_calls?: OllamaToolCallPayload[];
  };
}

const UNDO_COMMAND = /^\s*(deshaz|undo|revierte|rollback)/i;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Estimación rápida de tokens (≈ 4 chars por token para texto mixto). */
function approxTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Ventana de contexto del modelo, leída del catálogo (modelCatalog.json en el back).
 *  El componente debe pasar el catálogo cargado; si no, se usa el snapshot sync
 *  con fallback. */
function contextWindowForModel(provider: string, model: string, catalog?: ModelCatalog): number {
  return contextWindowFromCatalog(provider, model, catalog);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function formatSessionTimestamp(timestamp: number) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  } catch {
    return '';
  }
}

function createStep(step: Omit<AgentTraceStep, 'startedAt'>): AgentTraceStep {
  return {
    ...step,
    startedAt: Date.now(),
    finishedAt: Date.now()
  };
}

/**
 * Serializa un mensaje del historial al formato que esperamos enviar al
 * modelo. Para mensajes del assistant en modo agente enriquecemos el
 * content con un resumen breve de los tool calls ya ejecutados, así el
 * modelo conserva contexto de qué información recabó en turnos previos
 * (sin tener que re-ejecutar las mismas tools).
 */
function serializeMessageForHistory(message: { role: string; content: string; agentRun?: AgentRun | undefined }) {
  if (message.role !== 'assistant' || !message.agentRun) {
    return { role: message.role, content: message.content };
  }
  const toolSteps = message.agentRun.steps.filter(step => step.type === 'tool_result' && step.result);
  if (toolSteps.length === 0) {
    return { role: message.role, content: message.content };
  }
  const toolDigest = toolSteps
    .slice(-12)
    .map(step => {
      const name = step.call?.name || step.title || 'tool';
      const summary = step.result?.summary?.trim();
      return summary ? `- ${name}: ${summary}` : `- ${name}`;
    })
    .join('\n');
  const enriched = `${message.content}\n\n[contexto del turno previo — tools ejecutadas]\n${toolDigest}`;
  return { role: message.role, content: enriched };
}

function truncateDebug(value: string | undefined, max = 3000) {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}\n\n[...truncado por Agora AI...]` : value;
}

function parseAgentStreamEvent(raw: string): AgentStreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj.type;
  if (type === 'connected') return { type: 'connected' };
  if (type === 'status' && typeof obj.status === 'string') {
    return { type: 'status', status: obj.status };
  }
  if (type === 'step' && obj.step && typeof obj.step === 'object') {
    return { type: 'step', step: obj.step as AgentTraceStep };
  }
  if (type === 'complete' && typeof obj.reply === 'string' && obj.agentRun && typeof obj.agentRun === 'object') {
    return { type: 'complete', reply: obj.reply, agentRun: obj.agentRun as AgentRun };
  }
  if (type === 'error' && typeof obj.error === 'string') {
    return { type: 'error', error: obj.error };
  }
  return null;
}

function publishAgentProblem(detail: {
  severity?: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  detail?: string;
  code?: string;
}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('agora:problem', {
    detail: {
      source: 'agora-ai',
      uri: 'global',
      severity: detail.severity ?? 'warning',
      message: detail.message,
      detail: truncateDebug(detail.detail),
      code: detail.code
    }
  }));
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
) {
  const results: Array<PromiseSettledResult<R> | undefined> = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await task(item, index)
        .then((value): PromiseSettledResult<R> => ({ status: 'fulfilled', value }))
        .catch((reason): PromiseSettledResult<R> => ({ status: 'rejected', reason }));
    }
  });
  await Promise.all(workers);
  return results;
}

function toAssistantMessage(reply: string, agentRun?: AgentRun, error = false): UIChatMessage {
  return {
    id: uid(),
    role: 'assistant',
    content: reply,
    error,
    agentRun,
    pendingConfirmation: agentRun?.pendingConfirmation
  };
}

const markdownComponents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code: ({ className, children, ...props }: any) => {
    const isBlock = /language-(\w+)/.test(className || '');
    return isBlock ? (
      <pre className="bg-surface-950 rounded-md p-3 my-2 overflow-x-auto text-xs leading-relaxed max-w-full">
        <code className={`${className || ''} text-surface-200 font-mono whitespace-pre`} {...props}>{children}</code>
      </pre>
    ) : (
      <code className="bg-surface-700 text-sky-300 px-1 rounded text-[0.85em] font-mono break-words" {...props}>{children}</code>
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: (props: any) => <a {...props} className="text-sky-400 underline hover:text-sky-300 break-all" target="_blank" rel="noopener noreferrer" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ul: (props: any) => <ul {...props} className="list-disc pl-4 my-0.5 space-y-0" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ol: (props: any) => <ol {...props} className="list-decimal pl-4 my-0.5 space-y-0" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p: (props: any) => <p {...props} className="my-0.5 leading-snug" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockquote: (props: any) => <blockquote {...props} className="border-l-2 border-surface-600 pl-3 my-2 text-surface-400 italic" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: (props: any) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-md border border-surface-700">
      <table {...props} className="w-full text-xs border-collapse" />
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  th: (props: any) => <th {...props} className="border-b border-surface-700 bg-surface-900 px-2 py-1 text-left font-semibold text-surface-200" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  td: (props: any) => <td {...props} className="border-b border-surface-800 px-2 py-1 text-surface-300 align-top" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h1: (props: any) => <h1 {...props} className="text-base font-semibold mt-2 mb-1 text-surface-100" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h2: (props: any) => <h2 {...props} className="text-sm font-semibold mt-2 mb-1 text-surface-100" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h3: (props: any) => <h3 {...props} className="text-sm font-semibold mt-1.5 mb-0.5 text-surface-200" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hr: (props: any) => <hr {...props} className="my-2 border-surface-700" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @next/next/no-img-element
  img: (props: any) => <img {...props} className="max-w-full h-auto rounded-md my-2" loading="lazy" alt={props.alt || ''} />
} as const;

interface ChatMessageProps {
  msg: UIChatMessage;
  traceExpanded: boolean;
  confirmingId: string | null;
  copiedId: string | null;
  onConfirm: (messageId: string, approve: boolean) => void;
  onCopy: (id: string, content: string) => void;
}

function ChatMessageImpl({ msg, traceExpanded, confirmingId, copiedId, onConfirm, onCopy }: ChatMessageProps) {
  const visibleSteps = msg.agentRun?.steps.filter(step => step.type !== 'final') ?? [];
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`group relative max-w-[88%] min-w-0 overflow-hidden rounded-lg px-3 py-1.5 text-sm leading-normal [overflow-wrap:anywhere] ${
        msg.role === 'user'
          ? 'bg-sky-600/20 border border-sky-500/20 text-surface-100'
          : msg.error
            ? 'bg-mandy-900/30 border border-mandy-500/20 text-mandy-300'
            : 'bg-surface-800 border border-surface-700 text-surface-200'
      }`}>
        {msg.error && (
          <div className="flex items-center gap-1 mb-1 text-xs text-mandy-400">
            <AlertCircle className="w-3 h-3" />
            Error
          </div>
        )}
        <div className="max-w-full overflow-hidden [overflow-wrap:anywhere]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {msg.content}
          </ReactMarkdown>
        </div>

        {msg.agentRun?.mode === 'agent' && msg.role === 'assistant' && (
          <div className="mt-2">
            {visibleSteps.map(step => {
              if (step.type === 'thinking' && step.content) {
                return <AgentThinkingBlock key={step.id} content={step.content} defaultOpen={traceExpanded} />;
              }
              if (step.type === 'plan' && step.content) {
                return (
                  <div key={step.id} className="mt-1.5 rounded-md border border-sky-500/20 bg-sky-500/5 px-2.5 py-1.5 text-xs text-sky-100">
                    <div className="font-medium text-sky-300 mb-1">{step.title}</div>
                    <div className="break-words leading-snug">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {step.content || ''}
                      </ReactMarkdown>
                    </div>
                  </div>
                );
              }
              return <ToolCallBlock key={step.id} step={step} defaultOpen={traceExpanded} />;
            })}

            {msg.pendingConfirmation && (
              <InlineConfirmation
                pending={msg.pendingConfirmation}
                busy={confirmingId === msg.id}
                onConfirm={() => onConfirm(msg.id, true)}
                onReject={() => onConfirm(msg.id, false)}
              />
            )}

            {msg.agentRun.rollback?.length ? (
              <div className="mt-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/15 rounded-md px-2 py-1.5 inline-flex items-center gap-1.5">
                <Undo2 className="w-3.5 h-3.5" />
                Puedes escribir <code className="font-mono">deshaz eso</code> para revertir el último turno.
              </div>
            ) : null}

            {msg.agentRun.truncated ? (
              <div className="mt-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/15 rounded-md px-2 py-1.5 inline-flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Respuesta truncada por presupuesto de tiempo. Pídela en pasos más pequeños.
              </div>
            ) : null}

            {msg.agentRun.usage ? (
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-surface-500">
                {typeof msg.agentRun.usage.totalTokens === 'number' && (
                  <span>{msg.agentRun.usage.totalTokens.toLocaleString()} tokens</span>
                )}
                {typeof msg.agentRun.usage.estimatedCostUsd === 'number' && msg.agentRun.usage.estimatedCostUsd > 0 && (
                  <span>· ${msg.agentRun.usage.estimatedCostUsd.toFixed(4)}</span>
                )}
                {typeof msg.agentRun.iterations === 'number' && msg.agentRun.iterations > 0 && (
                  <span>· {msg.agentRun.iterations} {msg.agentRun.iterations === 1 ? 'iter' : 'iters'}</span>
                )}
              </div>
            ) : null}
          </div>
        )}

        {msg.role === 'assistant' && !msg.error && (
          <button
            onClick={() => onCopy(msg.id, msg.content)}
            className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
            title="Copiar respuesta"
          >
            {copiedId === msg.id
              ? <Check className="w-3 h-3 text-emerald-400" />
              : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

const ChatMessage = memo(ChatMessageImpl, (prev, next) => {
  if (prev.msg.id !== next.msg.id) return false;
  if (prev.msg.content !== next.msg.content) return false;
  if ((prev.msg.agentRun?.steps?.length ?? 0) !== (next.msg.agentRun?.steps?.length ?? 0)) return false;
  if (prev.msg.error !== next.msg.error) return false;
  if (prev.msg.pendingConfirmation !== next.msg.pendingConfirmation) return false;
  if (prev.msg.agentRun?.truncated !== next.msg.agentRun?.truncated) return false;
  if (prev.msg.agentRun?.usage !== next.msg.agentRun?.usage) return false;
  if (prev.msg.agentRun?.rollback?.length !== next.msg.agentRun?.rollback?.length) return false;
  if (prev.traceExpanded !== next.traceExpanded) return false;
  const prevConfirming = prev.confirmingId === prev.msg.id;
  const nextConfirming = next.confirmingId === next.msg.id;
  if (prevConfirming !== nextConfirming) return false;
  const prevCopied = prev.copiedId === prev.msg.id;
  const nextCopied = next.copiedId === next.msg.id;
  if (prevCopied !== nextCopied) return false;
  return true;
});

export default function AgoraAIChat({ workspaceId }: AgoraAIChatProps) {
  const [config, setConfig] = useState<AIProviderConfig>(loadAIProviderConfig);
  const mode: AgentMode = 'agent';
  const [userInstructions, setUserInstructions] = useState<string>('');
  const [accessPolicy, setAccessPolicy] = useState<AgentAccessPolicy>(loadAgentAccessPolicy);
  const [traceExpanded, setTraceExpanded] = useState<boolean>(loadAgentTraceExpanded);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog>(getModelCatalogSync);

  useEffect(() => {
    let cancelled = false;
    void loadModelCatalog().then((catalog) => { if (!cancelled) setModelCatalog(catalog); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = () => {
      setConfig(loadAIProviderConfig());
      setAccessPolicy(loadAgentAccessPolicy());
      setTraceExpanded(loadAgentTraceExpanded());
      setUserInstructions(loadAgentUserInstructions(workspaceId || PERSONAL_WORKSPACE_ID));
    };
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, handler);
  }, [workspaceId]);

  const toggleTraceExpanded = useCallback(() => {
    setTraceExpanded(prev => {
      const next = !prev;
      saveAgentTraceExpanded(next);
      return next;
    });
  }, []);

  const setProvider = useCallback((provider: AIProvider) => {
    setShowProviderMenu(false);
    saveAIProviderConfig({ ...loadAIProviderConfig(), provider });
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);
  // Historial cerrado por defecto: el RightPanel es solo chat. El usuario
  // abre el historial como overlay clickeando el botón "Historial".
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<AgentChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rollbackQueue, setRollbackQueue] = useState<AgentRollbackAction[]>([]);
  const [dryRun, setDryRun] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('agora-ai-dryrun') === '1';
  });
  const [nextTurnHints, setNextTurnHints] = useState<Set<'plan' | 'think'>>(new Set());
  const [showSlashHelp, setShowSlashHelp] = useState<SlashCommandHelp[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyHydratedRef = useRef(false);
  const sessionDefaultsRef = useRef({ provider: config.provider, mode });
  const sendingRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const userScrolledUpRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const meta = PROVIDER_META[config.provider];
  const resolvedWorkspaceId = workspaceId || PERSONAL_WORKSPACE_ID;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUserInstructions(loadAgentUserInstructions(resolvedWorkspaceId));
  }, [resolvedWorkspaceId]);
  const canSend = !loading && (!meta.needsKey || Boolean(config.apiKey));
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  useEffect(() => {
    sessionDefaultsRef.current = { provider: config.provider, mode };
  }, [config.provider, mode]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // Detecta si el usuario hizo scroll-up manual; si lo hizo, no autoscrolleamos
  // (no peleamos con su lectura). Vuelve al modo seguir-fondo cuando llega abajo.
  useEffect(() => {
    const node = bottomRef.current?.parentElement;
    if (!node) return;
    const onScroll = () => {
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      userScrolledUpRef.current = distanceFromBottom > 80;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll al fondo coalescido por rAF + behavior 'auto' para no pelear con la
  // lectura durante streaming SSE (antes 'smooth' por cada token).
  useEffect(() => {
    if (userScrolledUpRef.current) return;
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }, [messages, loading]);

  useEffect(() => {
    const loaded = loadChatSessions(resolvedWorkspaceId);
    const firstSession = loaded[0];
    if (firstSession) {
      setSessions(loaded);
      setActiveSessionId(firstSession.id);
      setMessages(firstSession.messages);
      setRollbackQueue(firstSession.rollbackQueue || []);
      // Modo chat eliminado: el agente siempre opera en modo 'agent'.
    } else {
      const fresh = createEmptyChatSession({
        workspaceId: resolvedWorkspaceId,
        provider: sessionDefaultsRef.current.provider,
        mode: sessionDefaultsRef.current.mode
      });
      const saved = saveChatSessions(resolvedWorkspaceId, [fresh]);
      setSessions(saved);
      setActiveSessionId(fresh.id);
      setMessages([]);
      setRollbackQueue([]);
    }
    setInput('');
    historyHydratedRef.current = true;
  }, [resolvedWorkspaceId]);

  useEffect(() => {
    if (!historyHydratedRef.current || !activeSessionId) return;
    setSessions(prev => {
      const current = prev.find((session) => session.id === activeSessionId);
      const nextSession: AgentChatSession = {
        id: activeSessionId,
        title: deriveChatSessionTitle(messages),
        workspaceId: resolvedWorkspaceId,
        provider: current?.provider || config.provider,
        mode,
        messages,
        rollbackQueue,
        createdAt: current?.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      return saveChatSessions(resolvedWorkspaceId, upsertChatSession(prev, nextSession));
    });
  }, [activeSessionId, config.provider, messages, mode, resolvedWorkspaceId, rollbackQueue]);

  const updateMode = useCallback((_nextMode: AgentMode) => {
    // Modo chat eliminado: el agente siempre opera en modo 'agent'.
  }, []);

  const updateAccessProfile = useCallback((profile: Exclude<AgentAccessProfileId, 'custom'>) => {
    saveAgentAccessProfile(profile);
    setAccessPolicy(loadAgentAccessPolicy());
  }, []);

  const fetchContext = useCallback(async (signal: AbortSignal): Promise<string> => {
    try {
      const data = await fetchZod(
        `/api/agora-ai/context?workspaceId=${encodeURIComponent(resolvedWorkspaceId)}`,
        agentContextResponseSchema,
        { signal }
      );
      return data.context ?? '';
    } catch {
      return '';
    }
  }, [resolvedWorkspaceId]);

  const executeAgoraTool = useCallback(async (
    action: string,
    args: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<AgentToolExecutionResult> => {
    const res = await authFetch('/api/agora-ai/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        action,
        workspaceId: resolvedWorkspaceId,
        llmEndpoint: config.endpoint || undefined,
        llmModel: config.model || undefined,
        accessPolicy,
        ...args
      })
    });
    const raw = await res.text();
    let result: AgentToolExecutionResult;
    try {
      result = raw ? JSON.parse(raw) as AgentToolExecutionResult : {
        ok: false,
        name: action,
        callId: `client-${action}`,
        summary: 'La tool no devolvió JSON',
        error: 'Respuesta vacía'
      };
    } catch {
      result = {
        ok: false,
        name: action,
        callId: `client-${action}`,
        summary: raw.slice(0, 500) || 'La tool no devolvió JSON válido',
        error: raw.slice(0, 1000) || 'JSON inválido'
      };
    }
    if (!res.ok || !result.ok) {
      publishAgentProblem({
        severity: res.status === 429 ? 'warning' : 'error',
        message: `Tool ${action} falló`,
        detail: result.error || result.summary,
        code: action
      });
    }
    const writeActions = new Set([
      'create_document',
      'update_document',
      'rename_document',
      'move_document',
      'delete_document',
      'create_folder',
      'restore_document'
    ]);
    if (typeof window !== 'undefined' && result.ok && writeActions.has(action)) {
      const detail: AgentDocumentsMutatedEventDetail = {
        workspaceId: resolvedWorkspaceId,
        source: 'agora-ai',
        mutations: [{ action, result }]
      };
      dispatchAgoraEvent(AGORA_EVENTS.documentsMutated, detail);
    }
    return result;
  }, [resolvedWorkspaceId, config.endpoint, config.model, accessPolicy]);

  const emitAgentWorkspaceEvents = useCallback((agentRun?: AgentRun) => {
    if (typeof window === 'undefined' || !agentRun) return;
    const {
      openDocumentsEvent,
      mutatedEvent,
      toolEvents,
      workerCommandEvents,
      uiCommandEvents,
      diagnosticEvents,
      shouldRefreshDocuments
    } = collectAgentWorkspaceEffects(agentRun, resolvedWorkspaceId);
    toolEvents.forEach((event) => {
      dispatchAgoraEvent(AGORA_EVENTS.agentToolResult, event);
    });
    workerCommandEvents.forEach((event) => {
      dispatchAgoraEvent(AGORA_EVENTS.workerCommandResult, event);
      if (!event.ok) {
        publishAgentProblem({
          severity: 'warning',
          message: `Comando worker falló: ${event.command}`,
          detail: [
            event.cwd ? `cwd: ${event.cwd}` : null,
            event.exitCode !== undefined ? `exitCode: ${event.exitCode ?? 'null'}` : null,
            event.stderr ? `stderr:\n${event.stderr}` : null,
            event.stdout ? `stdout:\n${event.stdout}` : null
          ].filter(Boolean).join('\n\n'),
          code: 'run_worker_command'
        });
      }
    });
    uiCommandEvents.forEach((event) => {
      dispatchAgoraEvent(AGORA_EVENTS.agentUiCommand, event);
    });
    diagnosticEvents.forEach((event) => {
      dispatchAgoraEvent(AGORA_EVENTS.agentDiagnostic, event);
      publishAgentProblem({
        severity: event.severity,
        message: event.message,
        detail: event.detail,
        code: event.code
      });
    });
    if (mutatedEvent) {
      dispatchAgoraEvent(AGORA_EVENTS.documentsMutated, mutatedEvent);
    }
    if (shouldRefreshDocuments) {
      dispatchAgoraEvent(AGORA_EVENTS.docsChanged);
    }
    if (openDocumentsEvent) {
      dispatchAgoraEvent(AGORA_EVENTS.openDocuments, openDocumentsEvent);
    }
  }, [resolvedWorkspaceId]);

  const updateMessageById = useCallback((messageId: string, updater: (current: UIChatMessage) => UIChatMessage) => {
    setMessages(prev => prev.map(message => (
      message.id === messageId ? updater(message) : message
    )));
  }, []);

  const runServerAgentStream = useCallback(async (
    history: UIChatMessage[],
    assistantMessageId: string,
    signal: AbortSignal,
    streamUserInstructions: string,
    dryRunFlag: boolean
  ): Promise<AgentResponseBody> => {
    const token = await getAuthToken();
    const res = await fetch(apiUrl('/api/agora-ai/stream'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal,
      body: JSON.stringify({
        messages: history.map(serializeMessageForHistory),
        workspaceId: resolvedWorkspaceId,
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model || meta.defaultModel,
        mode,
        accessPolicy,
        userInstructions: streamUserInstructions,
        dryRun: dryRunFlag
      })
    });

    if (!res.ok) {
      const text = await res.text();
      publishAgentProblem({
        severity: res.status === 429 ? 'warning' : 'error',
        message: `No se pudo iniciar Agora AI (${res.status})`,
        detail: text,
        code: 'agora-ai-stream'
      });
      throw new Error(text || `Error ${res.status} al iniciar el stream del agente`);
    }
    if (!res.body) {
      publishAgentProblem({
        severity: 'error',
        message: 'El stream de Agora AI no devolvió cuerpo',
        code: 'agora-ai-stream'
      });
      throw new Error('El servidor no devolvió un stream válido');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latestStatus = '';
    let finalPayload: AgentResponseBody | null = null;
    const liveSteps: AgentTraceStep[] = [];

    const syncPartialRun = (reply: string) => {
      updateMessageById(assistantMessageId, (current) => ({
        ...current,
        content: reply,
        agentRun: {
          mode,
          provider: config.provider,
          iterations: liveSteps.length,
          steps: [...liveSteps],
          finalReply: reply,
          rollback: current.agentRun?.rollback || []
        }
      }));
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        separatorIndex = buffer.indexOf('\n\n');

        const dataLine = rawEvent
          .split('\n')
          .find(line => line.startsWith('data: '));

        if (!dataLine) continue;

        const event = parseAgentStreamEvent(dataLine.slice(6));
        if (!event) {
          console.warn('[agora-ai] evento SSE inválido, ignorado');
          continue;
        }
        if (event.type === 'status') {
          latestStatus = event.status;
          setStreamStatus(event.status);
          if (/reintento|fallo de red|respondió\s+\d+/i.test(event.status)) {
            publishAgentProblem({
              severity: 'warning',
              message: 'Agora AI está reintentando una llamada al proveedor',
              detail: event.status,
              code: 'agora-ai-retry'
            });
          }
          updateMessageById(assistantMessageId, current => ({
            ...current,
            content: current.content || event.status
          }));
          continue;
        }

        if (event.type === 'step') {
          liveSteps.push(event.step);
          const preview = event.step.type === 'plan' && event.step.content
            ? event.step.content
            : event.step.type === 'final' && event.step.content
              ? event.step.content
              : undefined;
          syncPartialRun(preview || liveSteps.at(-1)?.content || latestStatus || 'Ejecutando agente…');
          continue;
        }

        if (event.type === 'complete') {
          finalPayload = {
            reply: event.reply,
            agentRun: event.agentRun
          };
          updateMessageById(assistantMessageId, current => ({
            ...current,
            content: event.reply,
            agentRun: event.agentRun,
            pendingConfirmation: event.agentRun.pendingConfirmation
          }));
          continue;
        }

        if (event.type === 'error') {
          publishAgentProblem({
            severity: 'error',
            message: 'Error en stream de Agora AI',
            detail: event.error,
            code: 'agora-ai-stream'
          });
          throw new Error(event.error);
        }
      }
    }

    if (!finalPayload) {
      publishAgentProblem({
        severity: 'error',
        message: 'El stream de Agora AI terminó sin respuesta final',
        detail: latestStatus,
        code: 'agora-ai-stream'
      });
      throw new Error('El stream terminó sin respuesta final del agente');
    }

    return finalPayload;
  }, [accessPolicy, config.apiKey, config.model, config.provider, meta.defaultModel, mode, resolvedWorkspaceId, updateMessageById]);

  const callOllamaDirect = useCallback(async (
    msgs: Array<Record<string, unknown>>,
    signal: AbortSignal,
    useTools: boolean
  ): Promise<OllamaChatResponse> => {
    const raw = config.endpoint.trim() || 'http://localhost:11434';
    const base = raw.replace(/\/+$/, '');
    const url = base.endsWith('/api/chat') ? base : `${base}/api/chat`;
    const payload: Record<string, unknown> = {
      model: config.model || meta.defaultModel,
      messages: msgs,
      stream: false
    };
    if (useTools) {
      const availableTools = toOllamaTools(accessPolicy);
      if (availableTools.length > 0) {
        payload.tools = availableTools;
        // Disable extended thinking when tools are available — qwen3 often
        // wastes the thinking budget concluding "I don't have access" instead
        // of invoking the tools.  Disabling think forces tool-first behaviour.
        payload.think = false;
      }
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    return await res.json() as OllamaChatResponse;
  }, [accessPolicy, config.endpoint, config.model, meta.defaultModel]);

  const runOllamaLoop = useCallback(async (
    history: UIChatMessage[],
    signal: AbortSignal
  ): Promise<AgentRun> => {
    const normalizedPolicy = normalizeAgentAccessPolicy(accessPolicy);
    const context = normalizedPolicy.capabilities.workspaceContext ? await fetchContext(signal) : '';
    const systemMsg = buildAgoraSystemPrompt({
      mode,
      contextPrompt: context,
      workspaceId: resolvedWorkspaceId,
      accessPolicy: normalizedPolicy,
      userInstructions
    });
    const steps: AgentTraceStep[] = [];
    const rollback: AgentRollbackAction[] = [];
    const loopMessages: Array<Record<string, unknown>> = [
      { role: 'system', content: systemMsg },
      ...history.map(serializeMessageForHistory)
    ];

    let finalReply = '';
    let pendingConfirmation: AgentPendingConfirmation | undefined;

    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const response = await callOllamaDirect(loopMessages, signal, mode === 'agent');
      const rawContent = response.message?.content ?? '';
      // Ollama models (e.g. qwen3) may return thinking in a separate field
      const nativeThinking = response.message?.thinking?.trim() || null;
      const { thinking: tagThinking, visible } = extractThinkingSegments(rawContent);
      const thinking = nativeThinking || tagThinking;

      if (thinking) {
        steps.push(createStep({
          id: `thinking-${iteration}`,
          type: 'thinking',
          title: 'Razonamiento del agente',
          content: thinking
        }));
      }
      if (visible) {
        steps.push(createStep({
          id: `plan-${iteration}`,
          type: 'plan',
          title: 'Plan / respuesta intermedia',
          content: visible
        }));
      }

      const toolCalls = (response.message?.tool_calls ?? [])
        .map((call, index): AgentToolCall | null => {
          const name = call.function?.name?.trim();
          if (!name) return null;
          // Defensive: Ollama may return arguments as a JSON string instead of object
          let parsedArgs: Record<string, unknown> = {};
          const rawArgs = call.function?.arguments;
          if (rawArgs && typeof rawArgs === 'object') {
            parsedArgs = rawArgs;
          } else if (typeof rawArgs === 'string') {
            try { parsedArgs = JSON.parse(rawArgs); } catch { parsedArgs = {}; }
          }
          return {
            id: `ollama-${iteration}-${index + 1}`,
            name,
            args: parsedArgs
          };
        })
        .filter((call): call is AgentToolCall => Boolean(call));

      if (!toolCalls.length || mode !== 'agent') {
        finalReply = visible || finalReply || 'Listo.';
        steps.push(createStep({
          id: `final-${iteration}`,
          type: 'final',
          title: 'Respuesta final',
          content: finalReply
        }));
        return {
          mode,
          provider: 'ollama',
          iterations: iteration,
          steps,
          finalReply,
          pendingConfirmation,
          rollback
        };
      }

      loopMessages.push({
        role: 'assistant',
        content: rawContent || null,
        tool_calls: toolCalls.map(toolCall => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: toolCall.args
          }
        }))
      });

      // Emit tool_call steps before parallel execution
      for (const toolCall of toolCalls) {
        steps.push(createStep({
          id: `call-${toolCall.id}`,
          type: 'tool_call',
          title: `Ejecutando ${toolCall.name}`,
          call: toolCall
        }));
      }

      // Execute tools with bounded concurrency so local/Ollama loops do not
      // stampede the internal API when a model emits many tool calls at once.
      const settled = await runWithConcurrency(toolCalls, 4, async (toolCall) => ({
        toolCall,
        result: await executeAgoraTool(toolCall.name, toolCall.args, signal)
      }));
      const toolResults = settled.map((item, i) => {
        if (item?.status === 'fulfilled') return item.value;
        const toolCall = toolCalls[i] ?? {
          id: `missing-${iteration}-${i}`,
          name: 'unknown_tool',
          args: {}
        };
        const reason = item?.status === 'rejected' ? String(item.reason) : 'desconocido';
        return {
          toolCall,
          result: {
            ok: false,
            name: toolCall.name,
            callId: toolCall.id,
            summary: `Error inesperado: ${reason}`,
            error: reason
          } as AgentToolExecutionResult
        };
      });

      for (const { toolCall, result } of toolResults) {
        if (result.rollback?.length) rollback.push(...result.rollback);
        steps.push(createStep({
          id: `result-${toolCall.id}`,
          type: result.ok ? 'tool_result' : 'error',
          title: result.ok ? `Resultado de ${toolCall.name}` : `Error en ${toolCall.name}`,
          result,
          content: result.summary
        }));
        loopMessages.push({
          role: 'tool',
          name: toolCall.name,
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
        if (result.requiresConfirmation && result.pendingConfirmation && !pendingConfirmation) {
          pendingConfirmation = result.pendingConfirmation;
        }
      }

      if (pendingConfirmation) {
        finalReply = visible || toolResults[0]?.result.summary || '';
        return {
          mode,
          provider: 'ollama',
          iterations: iteration,
          steps,
          finalReply,
          pendingConfirmation,
          rollback
        };
      }
    }

    finalReply = finalReply || 'Se alcanzó el límite de acciones del agente.';
    steps.push(createStep({
      id: `final-${steps.length + 1}`,
      type: 'final',
      title: 'Respuesta final',
      content: finalReply
    }));

    return {
      mode,
      provider: 'ollama',
      iterations: 10,
      steps,
      finalReply,
      pendingConfirmation,
      rollback
    };
  }, [accessPolicy, callOllamaDirect, executeAgoraTool, fetchContext, mode, resolvedWorkspaceId, userInstructions]);

  const copyMessage = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = setTimeout(() => {
      setCopiedId(null);
      copiedTimeoutRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
  }, []);

  const activateSession = useCallback((sessionId: string) => {
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return;
    setActiveSessionId(target.id);
    setMessages(target.messages);
    setRollbackQueue(target.rollbackQueue || []);
    setInput('');
    if (target.mode !== mode) {
      updateMode(target.mode);
    }
  }, [mode, sessions, updateMode]);

  const startNewChat = useCallback(() => {
    const fresh = createEmptyChatSession({
      workspaceId: resolvedWorkspaceId,
      provider: config.provider,
      mode
    });
    const next = saveChatSessions(resolvedWorkspaceId, upsertChatSession(sessions, fresh));
    setSessions(next);
    setActiveSessionId(fresh.id);
    setMessages([]);
    setRollbackQueue([]);
    setInput('');
    textareaRef.current?.focus();
  }, [config.provider, mode, resolvedWorkspaceId, sessions]);

  const deleteActiveChat = useCallback(() => {
    if (!activeSessionId) return;
    const remaining = sessions.filter((session) => session.id !== activeSessionId);
    if (remaining.length === 0) {
      const fresh = createEmptyChatSession({
        workspaceId: resolvedWorkspaceId,
        provider: config.provider,
        mode
      });
      const saved = saveChatSessions(resolvedWorkspaceId, [fresh]);
      setSessions(saved);
      setActiveSessionId(fresh.id);
      setMessages([]);
      setRollbackQueue([]);
      setInput('');
      return;
    }

    const saved = saveChatSessions(resolvedWorkspaceId, remaining);
    const nextActive = saved[0];
    setSessions(saved);
    if (!nextActive) return;
    setActiveSessionId(nextActive.id);
    setMessages(nextActive.messages);
    setRollbackQueue(nextActive.rollbackQueue || []);
    setInput('');
    if (nextActive.mode !== mode) {
      updateMode(nextActive.mode);
    }
  }, [activeSessionId, config.provider, mode, resolvedWorkspaceId, sessions, updateMode]);

  const clearPendingConfirmation = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => (
      msg.id === messageId
        ? { ...msg, pendingConfirmation: undefined }
        : msg
    )));
  }, []);

  const runRollback = useCallback(async (signal: AbortSignal) => {
    if (!rollbackQueue.length) {
      return 'No hay acciones recientes para deshacer.';
    }

    const applied = [...rollbackQueue].reverse();
    const summaries: string[] = [];
    for (const action of applied) {
      const result = await executeAgoraTool(action.action, action.args, signal);
      summaries.push(result.summary);
    }
    setRollbackQueue([]);
    return `Deshice ${applied.length} acción(es):\n- ${summaries.join('\n- ')}`;
  }, [executeAgoraTool, rollbackQueue]);

  const sendMessage = useCallback(async () => {
    const rawText = input.trim();
    const now = Date.now();
    if (!rawText || loading || !canSend) return;

    // Slash commands locales — interceptan antes del provider.
    const slash = parseSlashCommand(rawText, {
      onClear: () => {
        setMessages([]);
        setRollbackQueue([]);
      },
      onShowHelp: (cmds) => setShowSlashHelp(cmds)
    });
    let text = rawText;
    if (slash.kind === 'handled') {
      slash.sideEffect?.();
      setInput('');
      return;
    }
    if (slash.kind === 'flag') {
      if (slash.flag === 'dry-run') {
        const next = !dryRun;
        setDryRun(next);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('agora-ai-dryrun', next ? '1' : '0');
        }
        setMessages(prev => [...prev, toAssistantMessage(
          next
            ? 'Dry-run ON. Las tools destructivas (delete_*, update_document, write_worker_file, overwrite_document) no aplicarán cambios reales hasta que escribas /dryrun otra vez.'
            : 'Dry-run OFF. Las tools del agente vuelven a aplicar cambios reales.'
        )]);
      } else {
        setNextTurnHints(prev => {
          const next = new Set(prev);
          next.add(slash.flag as 'plan' | 'think');
          return next;
        });
        setMessages(prev => [...prev, toAssistantMessage(
          slash.flag === 'plan'
            ? 'Plan-mode activo para el próximo mensaje. El agente debe publicar un plan antes de actuar.'
            : 'Razonamiento extendido activo para el próximo mensaje.'
        )]);
      }
      setInput('');
      return;
    }
    if (slash.kind === 'inject-system') {
      text = slash.injection;
    }

    if (sendingRef.current || now - lastSendAtRef.current < 650) {
      publishAgentProblem({
        severity: 'warning',
        message: 'Solicitud de Agora AI ignorada por envío demasiado rápido',
        detail: 'Se evitó duplicar una llamada al proveedor/API porque ya había una solicitud en curso o acababa de enviarse otra.',
        code: 'agora-ai-throttle'
      });
      return;
    }
    sendingRef.current = true;
    lastSendAtRef.current = now;

    const userMsg: UIChatMessage = { id: uid(), role: 'user', content: text };
    const history = [...messages, userMsg];
    const isUndoRequest = mode === 'agent' && UNDO_COMMAND.test(text);
    const shouldStreamServerAgent = !isUndoRequest && mode === 'agent' && config.provider !== 'ollama';
    const assistantMessageId = shouldStreamServerAgent ? uid() : null;

    setMessages(shouldStreamServerAgent
      ? [...history, {
        id: assistantMessageId as string,
        role: 'assistant',
        content: 'Preparando agente…',
        agentRun: {
          mode,
          provider: config.provider,
          iterations: 0,
          steps: [],
          finalReply: 'Preparando agente…',
          rollback: []
        }
      }]
      : history);
    setInput('');
    setLoading(true);
    setStreamStatus('');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {

      if (isUndoRequest) {
        const undoReply = await runRollback(controller.signal);
        setMessages(prev => [...prev, toAssistantMessage(undoReply)]);
        return;
      }

      let reply = '';
      let agentRun: AgentRun | undefined;

      // Inyecta hints de slash flags (/plan, /think) sólo en este turno.
      const turnHintLines: string[] = [];
      if (nextTurnHints.has('plan')) turnHintLines.push('PLAN_MODE: empieza llamando agent_plan_set y publicando un plan antes de cualquier acción destructiva.');
      if (nextTurnHints.has('think')) turnHintLines.push('THINK_MODE: razona explícitamente antes de cada tool call. Prefiere precisión sobre velocidad.');
      const effectiveUserInstructions = turnHintLines.length > 0
        ? `${userInstructions}\n\n${turnHintLines.join('\n')}`.trim()
        : userInstructions;
      if (nextTurnHints.size > 0) setNextTurnHints(new Set());

      if (config.provider === 'ollama') {
        agentRun = await runOllamaLoop(history, controller.signal);
        reply = agentRun.finalReply;
        emitAgentWorkspaceEvents(agentRun);
      } else if (shouldStreamServerAgent && assistantMessageId) {
        // Reintento con backoff exponencial ante errores de red transitorios
        // (NetBird drop, lock screen del iPad). Sólo reintenta si el server
        // no recibió la request o devolvió 5xx — nunca si el user abortó.
        const MAX_RETRIES = 2;
        const BASE_BACKOFF_MS = 1500;
        let attempt = 0;
        let streamed: AgentResponseBody | null = null;
        while (true) {
          try {
            streamed = await runServerAgentStream(
              history,
              assistantMessageId,
              controller.signal,
              effectiveUserInstructions,
              dryRun
            );
            break;
          } catch (streamErr) {
            if (controller.signal.aborted) throw streamErr;
            const isAbort = streamErr instanceof DOMException && streamErr.name === 'AbortError';
            if (isAbort) throw streamErr;
            const message = streamErr instanceof Error ? streamErr.message : String(streamErr);
            const isTransient = /failed to fetch|network|timeout|ECONNRESET|EAI_AGAIN|HTTP\/2|stream|reset/i.test(message)
              || /\b5\d\d\b/.test(message);
            if (!isTransient || attempt >= MAX_RETRIES) throw streamErr;
            attempt += 1;
            const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
            setStreamStatus(`Reconectando con Agora AI (intento ${attempt}/${MAX_RETRIES})…`);
            publishAgentProblem({
              severity: 'warning',
              message: `Reintentando stream de Agora AI (intento ${attempt}/${MAX_RETRIES})`,
              detail: message,
              code: 'agora-ai-stream-retry'
            });
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                controller.signal.removeEventListener('abort', onAbort);
                resolve();
              }, delay);
              const onAbort = () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              };
              controller.signal.addEventListener('abort', onAbort, { once: true });
            });
          }
        }
        if (!streamed) throw new Error('Stream de Agora AI no devolvió payload');
        reply = streamed.reply;
        agentRun = streamed.agentRun;
        emitAgentWorkspaceEvents(agentRun);
      } else {
        const chatMsgs = history.map(serializeMessageForHistory);
        const data = await fetchZod('/api/agora-ai', agentResponseBodySchema, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: chatMsgs,
            workspaceId: resolvedWorkspaceId,
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model || meta.defaultModel,
            mode,
            accessPolicy,
            userInstructions: effectiveUserInstructions,
            dryRun
          })
        });

        if (data.status !== 'success' || data.error) {
          publishAgentProblem({
            severity: 'error',
            message: 'Agora AI falló',
            detail: (data.error as string) ?? 'Error desconocido',
            code: 'agora-ai-request'
          });
          setMessages(prev => [...prev, toAssistantMessage((data.error as string) ?? 'Error desconocido', undefined, true)]);
          return;
        }
        reply = data.reply as string;
        agentRun = data.agentRun as AgentRun | undefined;
        if (agentRun) {
          emitAgentWorkspaceEvents(agentRun);
        }
      }

      if (agentRun?.rollback?.length) {
        setRollbackQueue(agentRun.rollback);
      }
      if (!shouldStreamServerAgent) {
        setMessages(prev => [...prev, toAssistantMessage(reply, agentRun)]);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Error de red';
      publishAgentProblem({
        severity: 'error',
        message: 'Error enviando mensaje a Agora AI',
        detail: msg,
        code: 'agora-ai-send'
      });
      if (assistantMessageId) {
        updateMessageById(assistantMessageId, current => ({
          ...current,
          content: msg,
          error: true,
          agentRun: undefined,
          pendingConfirmation: undefined
        }));
      } else {
        setMessages(prev => [...prev, toAssistantMessage(msg, undefined, true)]);
      }
    } finally {
      sendingRef.current = false;
      // Sólo limpiamos abortRef si todavía apunta al controller que creamos
      // en este turno: si llegó otro sendMessage y reasignó la ref, dejarla.
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
      setStreamStatus('');
      textareaRef.current?.focus();
    }
  }, [accessPolicy, input, loading, canSend, messages, mode, runRollback, config.provider, config.apiKey, config.model, meta.defaultModel, resolvedWorkspaceId, runOllamaLoop, emitAgentWorkspaceEvents, runServerAgentStream, updateMessageById, userInstructions, dryRun, nextTurnHints]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }, [sendMessage]);

  const handleConfirmation = useCallback(async (messageId: string, approve: boolean) => {
    const target = messages.find(message => message.id === messageId)?.pendingConfirmation;
    if (!target) return;

    clearPendingConfirmation(messageId);
    if (!approve) {
      setMessages(prev => [...prev, toAssistantMessage('Operación cancelada por el usuario.')]);
      return;
    }

    try {
      setConfirmingId(messageId);
      const controller = new AbortController();
      const result = await executeAgoraTool(target.toolName, { ...target.args, confirmed: true }, controller.signal);
      if (!result.ok) {
        publishAgentProblem({
          severity: 'error',
          message: `Falló la confirmación de ${target.toolName}`,
          detail: result.error || result.summary,
          code: target.toolName
        });
      }
      if (result.rollback?.length) {
        setRollbackQueue(result.rollback);
      }
      const run: AgentRun = {
        mode: 'agent',
        provider: config.provider,
        iterations: 1,
        steps: [
          createStep({
            id: `confirm-${target.toolCallId}`,
            type: 'confirmation',
            title: 'Confirmación del usuario',
            content: `Se confirmó la acción ${target.toolName}.`
          }),
          createStep({
            id: `confirmed-result-${target.toolCallId}`,
            type: result.ok ? 'tool_result' : 'error',
            title: result.ok ? `Resultado de ${target.toolName}` : `Error en ${target.toolName}`,
            result,
            content: result.summary
          })
        ],
        finalReply: result.summary,
        rollback: result.rollback
      };
      emitAgentWorkspaceEvents(run);
      setMessages(prev => [...prev, toAssistantMessage(result.summary, run, !result.ok)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la confirmación';
      publishAgentProblem({
        severity: 'error',
        message: 'Error al confirmar acción del agente',
        detail: message,
        code: target.toolName
      });
      setMessages(prev => [...prev, toAssistantMessage(message, undefined, true)]);
    } finally {
      setConfirmingId(null);
    }
  }, [messages, clearPendingConfirmation, executeAgoraTool, config.provider, emitAgentWorkspaceEvents]);

  const handleConfirmStable = useCallback((messageId: string, approve: boolean) => {
    void handleConfirmation(messageId, approve);
  }, [handleConfirmation]);

  const handleCopyStable = useCallback((id: string, content: string) => {
    void copyMessage(id, content);
  }, [copyMessage]);

  // Auto-confirm en god mode: si llega un pendingConfirmation y el perfil
  // activo lo permite, se aprueba sin pedir input al usuario.
  const autoConfirmedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!profileAutoConfirms(accessPolicy.profile)) return;
    const target = messages.find(message => message.pendingConfirmation && !autoConfirmedRef.current.has(message.id));
    if (!target) return;
    autoConfirmedRef.current.add(target.id);
    void handleConfirmation(target.id, true);
  }, [accessPolicy.profile, messages, handleConfirmation]);

  return (
    <div className="flex h-full bg-surface-900 text-surface-200 overflow-hidden relative">
      {/* Historial como modal overlay sobre el chat — el panel queda limpio
          mostrando solo el chat. Se invoca con el botón "Historial". */}
      {showHistory && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 z-40 w-72 max-w-[90%] bg-surface-950 border-r border-surface-700 shadow-2xl shadow-black/40 flex flex-col">
            <div className="px-3 py-2 border-b border-surface-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-surface-200">
                  <History className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-medium">Historial local</span>
                </div>
                <p className="text-[10px] text-surface-500 mt-0.5">Privado en tu navegador · sin Firebase</p>
              </div>
              <button
                type="button"
                onClick={() => { startNewChat(); setShowHistory(false); }}
                className="p-1 rounded text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition"
                title="Nuevo chat"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => { activateSession(session.id); setShowHistory(false); }}
                    className={`w-full text-left rounded-lg border px-2.5 py-2 transition ${
                      isActive
                        ? 'border-sky-500/40 bg-sky-500/10 text-surface-100'
                        : 'border-surface-800 bg-surface-900/60 text-surface-300 hover:border-surface-700 hover:bg-surface-900'
                    }`}
                  >
                    <div className="text-xs font-medium truncate">{session.title || 'Nuevo chat'}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-surface-500">
                      <span className="truncate">{session.messages.length} msg</span>
                      <span>{formatSessionTimestamp(session.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700 bg-surface-900 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setShowHistory(value => !value)}
            className="p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition"
            title="Historial de conversaciones"
            aria-label="Historial de conversaciones"
          >
            <History className="w-4 h-4" />
          </button>
          <Bot className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="text-sm font-medium text-surface-100 truncate">Agora AI</span>
        </div>
        <div className="flex items-center gap-1">
          {rollbackQueue.length > 0 && (
            <button
              type="button"
              onClick={() => setInput('deshaz eso')}
              className="p-1 rounded text-amber-400 hover:bg-amber-500/10 transition"
              title="Preparar comando de deshacer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleTraceExpanded}
            className={`p-1 rounded transition ${traceExpanded ? 'text-sky-300 bg-sky-500/10' : 'text-surface-500 hover:text-surface-200 hover:bg-surface-700'}`}
            title={traceExpanded ? 'Colapsar razonamientos y acciones' : 'Expandir todos los razonamientos y acciones'}
            aria-label="Alternar detalle de trazas"
            aria-pressed={traceExpanded}
          >
            {traceExpanded ? <ChevronsDownUp className="w-3.5 h-3.5" /> : <ChevronsUpDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={startNewChat}
            className="p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition"
            title="Nuevo chat"
            aria-label="Nuevo chat"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>
          {(messages.length > 0 || activeSession) && (
            <button
              onClick={deleteActiveChat}
              className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
              title="Eliminar conversación actual"
              aria-label="Eliminar conversación"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('agora:open-ai-config'))}
            className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
            title="Configuración de IA"
            aria-label="Configuración"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="scrollbar-agora flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-surface-500 gap-4 select-none px-4">
            <Bot className="w-10 h-10 text-surface-700" />
            <div>
              <p className="text-sm text-surface-300">Dale una tarea al agente</p>
              <p className="text-xs mt-1 max-w-md text-surface-500">
                El agente puede trabajar con documentos, snippets, glosario semántico, tablero Kanban, formalización, ST y worker/terminal cuando esté conectado.
              </p>
              {!meta.needsKey || config.apiKey ? null : (
                <p className="text-xs text-amber-400 mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Configura tu API key primero
                </p>
              )}
            </div>
            {/* Quick prompts estilo Copilot — sugerencias contextuales */}
            <div className="grid grid-cols-1 gap-1.5 w-full max-w-sm select-text">
              {[
                { icon: '📋', label: 'Resume el documento abierto' },
                { icon: '🗂️', label: 'Organiza los archivos por tema' },
                { icon: '🧮', label: 'Formaliza la última sección a ST' },
                { icon: '↩️', label: 'Deshaz la última acción' }
              ].map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => {
                    setInput(prompt.label);
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className="flex items-center gap-2 rounded-md border border-surface-800 bg-surface-900 px-3 py-2 text-left text-xs text-surface-300 transition hover:border-sky-500/40 hover:bg-surface-800/60 hover:text-white"
                >
                  <span aria-hidden>{prompt.icon}</span>
                  <span className="truncate">{prompt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            msg={msg}
            traceExpanded={traceExpanded}
            confirmingId={confirmingId}
            copiedId={copiedId}
            onConfirm={handleConfirmStable}
            onCopy={handleCopyStable}
          />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 flex items-center gap-2 text-surface-400 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{streamStatus || 'Ejecutando agente…'}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t border-surface-700 p-2 bg-surface-900 min-w-0">
        {(dryRun || nextTurnHints.size > 0 || showSlashHelp) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
            {dryRun && (
              <span className="px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-700 text-amber-200">
                DRY-RUN — escribe /dryrun para desactivar
              </span>
            )}
            {nextTurnHints.has('plan') && (
              <span className="px-2 py-0.5 rounded-full bg-sky-900/40 border border-sky-700 text-sky-200">
                Plan-mode (1 turno)
              </span>
            )}
            {nextTurnHints.has('think') && (
              <span className="px-2 py-0.5 rounded-full bg-violet-900/40 border border-violet-700 text-violet-200">
                Razonamiento extendido (1 turno)
              </span>
            )}
            {showSlashHelp && (
              <div className="w-full mt-1 p-2 rounded-lg bg-surface-800 border border-surface-600">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-surface-300 font-medium">Comandos disponibles</span>
                  <button
                    onClick={() => setShowSlashHelp(null)}
                    className="text-surface-500 hover:text-surface-200"
                    aria-label="Cerrar"
                  >×</button>
                </div>
                <ul className="space-y-0.5">
                  {showSlashHelp.map(cmd => (
                    <li key={cmd.command} className="flex gap-2">
                      <code className="text-sky-400 min-w-[5rem]">{cmd.command}</code>
                      <span className="text-surface-400">{cmd.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex items-end gap-2 min-w-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={meta.needsKey && !config.apiKey ? 'Configura tu API key primero…' : 'Pídele una acción al agente…'}
            disabled={loading || !canSend}
            rows={1}
            wrap="soft"
            className="scrollbar-agora flex-1 min-w-0 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-400 focus:outline-none focus:border-sky-500 transition resize-none disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ minHeight: '36px', maxHeight: '120px', overflowY: 'auto', overflowX: 'hidden', wordBreak: 'break-word' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          {loading ? (
            <button
              onClick={stopGeneration}
              className="flex-shrink-0 p-2 rounded-lg bg-mandy-600 hover:bg-mandy-500 text-white transition"
              title="Detener generación"
              aria-label="Detener"
            >
              <Square className="w-4 h-4" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || !canSend}
              className="flex-shrink-0 p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition"
              title="Enviar (Enter)"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Footer: pills de Modelo (con dropdown rápido), Modo, Permisos y Contexto.
            La pill de contexto muestra tokens estimados vs ventana del modelo. */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-0.5 text-[10px] min-w-0">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProviderMenu(value => !value)}
                title="Cambiar proveedor (click derecho para configurar)"
                onContextMenu={(event) => {
                  event.preventDefault();
                  window.dispatchEvent(new CustomEvent('agora:open-ai-config'));
                }}
                className="flex items-center gap-1 rounded-md border border-surface-700 bg-surface-900 px-1.5 py-0.5 text-surface-200 transition hover:border-sky-500/40 hover:text-white"
              >
                <Bot className="w-3 h-3" />
                <span className={`${meta.color} truncate max-w-[8rem]`}>{meta.label.split('(')[0]?.trim() || meta.label}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {showProviderMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProviderMenu(false)}
                    aria-hidden
                  />
                  <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[10rem] rounded-md border border-surface-700 bg-surface-900 shadow-xl shadow-black/40 py-1">
                    {(Object.keys(PROVIDER_META) as AIProvider[]).map((providerId) => {
                      const providerMeta = PROVIDER_META[providerId];
                      const isActive = providerId === config.provider;
                      return (
                        <button
                          key={providerId}
                          type="button"
                          onClick={() => setProvider(providerId)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition ${
                            isActive ? 'bg-sky-500/10 text-white' : 'text-surface-200 hover:bg-surface-800'
                          }`}
                        >
                          <Bot className={`w-3 h-3 ${providerMeta.color}`} />
                          <span className="flex-1 truncate">{providerMeta.label.split('(')[0]?.trim() || providerId}</span>
                          {isActive && <Check className="w-3 h-3 text-sky-400" />}
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-surface-700" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowProviderMenu(false);
                        window.dispatchEvent(new CustomEvent('agora:open-ai-config'));
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] text-surface-300 hover:bg-surface-800 transition"
                    >
                      <Settings className="w-3 h-3" />
                      <span>API key, modelo…</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <label
              title={`Permisos: ${AGENT_ACCESS_PROFILES[accessPolicy.profile === 'custom' ? 'workspace' : accessPolicy.profile]?.description || 'Personalizado'}`}
              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition ${
                profileAutoConfirms(accessPolicy.profile)
                  ? 'border-mandy-500/50 bg-mandy-500/10 text-mandy-100 hover:border-mandy-400'
                  : 'border-surface-700 bg-surface-900 text-surface-200 hover:border-surface-600'
              }`}
            >
              <Shield className={`w-3 h-3 ${profileAutoConfirms(accessPolicy.profile) ? 'text-mandy-300' : 'text-surface-400'}`} />
              <select
                value={accessPolicy.profile}
                onChange={(event) => updateAccessProfile(event.target.value as Exclude<AgentAccessProfileId, 'custom'>)}
                className="max-w-[7rem] bg-transparent text-[10px] outline-none cursor-pointer"
                style={{ color: 'inherit' }}
              >
                {AGENT_ACCESS_PROFILE_ORDER.map((profile) => (
                  <option key={profile} value={profile} className="bg-surface-900 text-surface-100">
                    {AGENT_ACCESS_PROFILES[profile].shortLabel}
                  </option>
                ))}
                {accessPolicy.profile === 'custom' && (
                  <option value="custom" disabled className="bg-surface-900 text-surface-100">
                    Custom
                  </option>
                )}
              </select>
            </label>
            {(() => {
              const lastUsage = [...messages].reverse().find(message => message.agentRun?.usage?.totalTokens);
              const usedTokens = lastUsage?.agentRun?.usage?.totalTokens
                ?? approxTokens(messages.map(message => message.content).join('\n') + input);
              const window = contextWindowForModel(config.provider, config.model || meta.defaultModel, modelCatalog);
              const ratio = Math.min(1, usedTokens / window);
              const tone = ratio > 0.85 ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                : ratio > 0.5 ? 'text-sky-200 border-sky-500/30 bg-sky-500/5'
                : 'text-surface-300 border-surface-700 bg-surface-900';
              return (
                <span
                  title={`${usedTokens.toLocaleString()} / ${window.toLocaleString()} tokens (≈ ${(ratio * 100).toFixed(0)}%) — ventana del modelo. ${accessPolicy.capabilities.workspaceContext ? 'Contexto del workspace activo.' : 'Contexto del workspace desactivado.'}`}
                  className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition ${tone}`}
                >
                  <ListTree className="w-3 h-3" />
                  <span className="font-mono">{formatNumber(usedTokens)}/{formatNumber(window)}</span>
                </span>
              );
            })()}
          </div>
          <div className="text-surface-400 hidden sm:flex items-center gap-1 shrink-0">
            <kbd className="rounded border border-surface-700 bg-surface-950 px-1 py-0.5 font-mono text-[9px] text-surface-300">Enter</kbd>
            <span>enviar</span>
            <span className="opacity-60">·</span>
            <kbd className="rounded border border-surface-700 bg-surface-950 px-1 py-0.5 font-mono text-[9px] text-surface-300">⇧Enter</kbd>
            <span>salto</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
