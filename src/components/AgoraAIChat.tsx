'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Bot, Send, Settings, ChevronDown,
  Loader2, Trash2, Copy, Check, AlertCircle, Undo2,
  History, MessageSquarePlus, Shield, Square,
  ListTree, ChevronsDownUp, ChevronsUpDown, FileText, RotateCcw, Clock
} from 'lucide-react';
import { apiUrl, authFetch, getAuthToken } from '@/services/apiClient';
import { fetchZod } from '@/lib/fetch-zod';
import { agentContextResponseSchema } from '@agora/contracts';
import {
  deriveChatSessionTitle,
  loadChatSessions,
  saveChatSessions
} from '@/lib/agora-ai/chatHistory';
import { useAgentChatHistory } from '@/hooks/useAgentChatHistory';
import type { RemoteAgentChat, RemoteAgentChatMessage } from '@/lib/agora-ai/agentChatApi';
import { AgentThinkingBlock } from '@/components/chat/AgentThinkingBlock';
import { ToolCallBlock } from '@/components/chat/ToolCallBlock';
import { InlineConfirmation } from '@/components/chat/InlineConfirmation';
import { buildAgoraSystemPrompt, extractThinkingSegments } from '@/lib/agora-ai/systemPrompt';
import {
  detectCapabilityBlock,
  extractReferencedDocuments,
  serializeMessageForHistory,
  stripPreviousTurnContext
} from '@/lib/agora-ai/chatHelpers';
import { toOllamaTools } from '@/lib/agora-ai/toolDefinitions';
import { collectAgentWorkspaceEffects } from '@/lib/agora-ai/uiEvents';
import { AGORA_EVENTS, dispatchAgoraEvent } from '@/lib/agora-events';
import { parseSlashCommand, SLASH_COMMANDS, type SlashCommandHelp } from '@/lib/agora-ai/slashCommands';
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
import { listAgentSecrets, type AgentKeyProvider } from '@/lib/agora-ai/agentKeysApi';
import { AGENT_ACCESS_PROFILE_ORDER, AGENT_ACCESS_PROFILES, normalizeAgentAccessPolicy, profileAutoConfirms, resolveAgentMaxIterations } from '@/lib/agora-ai/accessPolicy';
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
  AgentDocumentTarget,
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

/**
 * `AgentStoredChatMessage` extendido con metadata de UI local.
 * `hasHiddenTools` se setea cuando el mensaje viene del backend con
 * toolCalls/toolResults pero sin un `agentRun` reconstruido (chats
 * previos a la migración de persistencia de eventos del agente).
 */
type UIChatMessage = AgentStoredChatMessage & { hasHiddenTools?: boolean };

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

// Bug 1/2/3: helpers extraídos a `chatHelpers.ts` para que sean
// importables desde tests sin tener que parsear JSX. La separación también
// deja el componente más enfocado en el render.

function truncateDebug(value: string | undefined, max = 3000) {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}\n\n[...truncado por Agora AI...]` : value;
}

// Convierte un cuerpo 429 del backend en un mensaje amigable. El backend manda
// `{ error, reason, retryAfter }` (retryAfter en segundos). NUNCA mostramos el
// JSON crudo y SIEMPRE usamos `retryAfter` real para el tiempo de espera (el
// texto `error` del backend a veces dice "1s" aunque retryAfter sea ~14 min).
function formatRateLimitMessage(rawBody: string): string {
  let retryAfterSec: number | null = null;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === 'object') {
      const value = (parsed as Record<string, unknown>).retryAfter;
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        retryAfterSec = Math.ceil(value);
      }
    }
  } catch { /* cuerpo no-JSON: caemos al mensaje sin tiempo concreto */ }

  if (retryAfterSec === null) {
    return 'Demasiadas solicitudes a Agora AI. Esperá un momento antes de intentar de nuevo.';
  }
  const wait = retryAfterSec >= 60
    ? `~${Math.ceil(retryAfterSec / 60)} min`
    : `~${retryAfterSec} s`;
  return `Demasiadas solicitudes a Agora AI. Intentá de nuevo en ${wait}.`;
}

type ChatCreatedSideEvent = { type: 'chat-created'; chatId: string };
type ContextTruncatedSideEvent = { type: 'context-truncated'; removedCount: number; summary: string };

function parseAgentStreamEvent(raw: string): AgentStreamEvent | ChatCreatedSideEvent | ContextTruncatedSideEvent | null {
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
  // Evento out-of-band emitido por el stream backend cuando crea/resuelve el
  // chat persistido. No forma parte del union `AgentStreamEvent` (que es
  // contrato compartido). El consumidor lo trata como side-channel.
  if (type === 'chat-created' && typeof obj.chatId === 'string') {
    return { type: 'chat-created', chatId: obj.chatId };
  }
  if (
    type === 'context-truncated' &&
    typeof obj.removedCount === 'number' &&
    typeof obj.summary === 'string'
  ) {
    return { type: 'context-truncated', removedCount: obj.removedCount, summary: obj.summary };
  }
  return null;
}

function publishAgentProblem(detail: {
  severity?: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  detail?: string;
  code?: string;
}) {
  dispatchAgoraEvent(AGORA_EVENTS.problem, {
    source: 'agora-ai',
    uri: 'global',
    severity: detail.severity ?? 'warning',
    message: detail.message,
    detail: truncateDebug(detail.detail),
    code: detail.code
  });
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

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

const STREAM_BUFFER_CAP_BYTES = 4 * 1024 * 1024;
const MAX_LIVE_STEPS = 1000;

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
});

interface ChatMessageProps {
  msg: UIChatMessage;
  traceExpanded: boolean;
  confirmingId: string | null;
  copiedId: string | null;
  onConfirm: (messageId: string, approve: boolean) => void;
  onCopy: (id: string, content: string) => void;
  onOpenDocument: (doc: AgentDocumentTarget) => void;
  onRevert: (messageId: string) => void;
}

function ChatMessageImpl({ msg, traceExpanded, confirmingId, copiedId, onConfirm, onCopy, onOpenDocument, onRevert }: ChatMessageProps) {
  const visibleSteps = msg.agentRun?.steps.filter(step => step.type !== 'final') ?? [];
  const rawDisplayContent = msg.role === 'assistant' ? stripPreviousTurnContext(msg.content) : msg.content;
  // Bug #8: evita renderizar displayContent duplicado cuando un plan step ya
  // muestra exactamente el mismo texto. Ocurre cuando el agentRun terminó y
  // msg.content == finalReply == el content del step plan intermedio.
  const planStepContents = msg.agentRun
    ? new Set(visibleSteps.filter(s => s.type === 'plan').map(s => (s.content ?? '').trim()))
    : null;
  const displayContent = (planStepContents && planStepContents.has(rawDisplayContent.trim()))
    ? ''
    : rawDisplayContent;
  const referencedDocuments = msg.role === 'assistant'
    ? extractReferencedDocuments(msg.agentRun)
    : [];
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
        {msg.role === 'assistant' && msg.hasHiddenTools && !msg.agentRun && (
          <div className="flex items-center gap-1 mb-1.5 text-[10px] text-surface-500 border border-surface-700 bg-surface-900/60 rounded px-1.5 py-0.5 w-fit" title="Este mensaje se guardó antes de la migración al sistema de historial persistente. El detalle de tools y thinking no está disponible.">
            <Clock className="w-3 h-3 flex-shrink-0" />
            Chat antiguo · sin detalle de tools
          </div>
        )}
        {displayContent ? (
          <div className="max-w-full overflow-hidden [overflow-wrap:anywhere]">
            {msg.role === 'user' ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</span>
            ) : (
              <MarkdownContent content={displayContent} />
            )}
          </div>
        ) : null}
        {referencedDocuments.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-surface-500">
              <FileText className="w-3 h-3" /> Documentos referenciados
            </span>
            {referencedDocuments.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onOpenDocument(doc)}
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200 hover:border-sky-400 hover:bg-sky-500/20 transition max-w-[18rem] truncate"
                title={doc.folder ? `${doc.folder}/${doc.name}` : doc.name}
              >
                <FileText className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{doc.name}</span>
              </button>
            ))}
          </div>
        )}

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
                      <MarkdownContent content={step.content || ''} />
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
                {msg.agentRun.truncationReason === 'output'
                  ? 'Respuesta cortada por el límite de tokens del modelo tras varias continuaciones. Pídela en partes.'
                  : 'Respuesta truncada por presupuesto de tiempo. Pídela en pasos más pequeños.'}
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
        {msg.role === 'user' && (
          <button
            onClick={() => onRevert(msg.id)}
            className="absolute top-1/2 -translate-y-1/2 -left-7 p-1 rounded opacity-0 group-hover:opacity-100 text-surface-500 hover:text-sky-300 hover:bg-surface-700 transition"
            title="Volver a este punto (descarta los mensajes posteriores)"
            aria-label="Volver a este punto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

const ChatMessage = memo(ChatMessageImpl, (prev, next) => {
  if (prev.msg.id !== next.msg.id) return false;
  if (prev.msg.content !== next.msg.content) return false;
  if (prev.msg.agentRun !== next.msg.agentRun) return false;
  if (prev.msg.error !== next.msg.error) return false;
  if (prev.msg.pendingConfirmation !== next.msg.pendingConfirmation) return false;
  if (prev.traceExpanded !== next.traceExpanded) return false;
  if (prev.onOpenDocument !== next.onOpenDocument) return false;
  if (prev.onRevert !== next.onRevert) return false;
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
  const [serverKeyProviders, setServerKeyProviders] = useState<Set<AgentKeyProvider>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    void loadModelCatalog().then((catalog) => { if (!cancelled) setModelCatalog(catalog); });
    return () => { cancelled = true; };
  }, []);

  const refreshServerKeys = useCallback(async () => {
    try {
      const items = await listAgentSecrets();
      setServerKeyProviders(new Set(items.map((it) => it.provider)));
    } catch {
      setServerKeyProviders(new Set());
    }
  }, []);

  useEffect(() => { void refreshServerKeys(); }, [refreshServerKeys]);

  useEffect(() => {
    const handler = () => {
      setConfig(loadAIProviderConfig());
      setAccessPolicy(loadAgentAccessPolicy());
      setTraceExpanded(loadAgentTraceExpanded());
      setUserInstructions(loadAgentUserInstructions(workspaceId || PERSONAL_WORKSPACE_ID));
      void refreshServerKeys();
    };
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, handler);
  }, [refreshServerKeys, workspaceId]);

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
  // Sesiones legadas (localStorage) — read-only, sólo para que el user pueda
  // recuperar chats viejos hasta que decida borrarlos. El historial activo
  // ahora vive en el backend (useAgentChatHistory).
  const [sessions, setSessions] = useState<AgentChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Chat persistido activo en backend. `null` significa que el próximo
  // stream lo creará y el evento SSE `chat-created` nos dará el id.
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const remoteHistory = useAgentChatHistory(true);
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
  // Feature: cola de mensajes (estilo Claude Code). Mientras el agente
  // streamea, el user puede encolar mensajes; al terminar el turno se
  // auto-despacha el siguiente. La cola es de sesión (en memoria) — no se
  // persiste. `queuePaused` la detiene cuando un turno falla (p.ej. 429) sin
  // perder los pendientes.
  const [queue, setQueue] = useState<Array<{ id: string; text: string }>>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  // Bug #4: detectamos cuando Ollama local no responde para mostrar UX claro.
  const [ollamaOffline, setOllamaOffline] = useState(false);
  // Bug 2: cuando un turno falla por capability del perfil (p.ej. el agente
  // intentó run_worker_command con perfil Workspace), guardamos el texto del
  // user para ofrecer reenvío automático al cambiar a un perfil más permisivo.
  const [lastFailedSend, setLastFailedSend] = useState<{ text: string; profile: AgentAccessProfileId; reason: string } | null>(null);
  const lastFailedProfileRef = useRef<AgentAccessProfileId>(accessPolicy.profile);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyHydratedRef = useRef(false);
  const sessionDefaultsRef = useRef({ provider: config.provider, mode });
  const sendingRef = useRef(false);
  const lastSendAtRef = useRef(0);
  // Auto-confirm tracker para profile=god-mode. Reset en cada cambio de sesión
  // (startNewChat, activateSession, deleteActiveChat) para evitar leak en
  // sesiones largas — el Set crecía sin tope.
  const autoConfirmedRef = useRef<Set<string>>(new Set());
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  // Bug #3: cuando se envía un nuevo mensaje desde el textarea forzamos scroll
  // al final independientemente de si el user estaba leyendo arriba. El flag
  // lo activa sendMessage y lo consume el effect de scroll.
  const scrollToBottomRef = useRef(false);
  // Bug #3 (parte 2): trackea si el user está cerca del fondo durante el
  // streaming. Si scrolleó manualmente hacia arriba (isAtBottom=false), no
  // forzamos scroll al completar. Virtuoso lo actualiza vía atBottomStateChange.
  const isAtBottomRef = useRef(true);

  const meta = PROVIDER_META[config.provider];
  const resolvedWorkspaceId = workspaceId || PERSONAL_WORKSPACE_ID;

  // Token-counter pill memoizado. Antes era un IIFE inline que recomputaba
  // O(N·L) string concat por cada render del padre — con 200 mensajes y
  // streaming SSE eso eran cientos de joins/segundo. Ahora sólo se recomputa
  // si cambia el contenido real de los mensajes, el input o el modelo activo.
  const tokenCounterInfo = useMemo(() => {
    const lastUsage = [...messages].reverse().find(message => message.agentRun?.usage?.totalTokens);
    const usedTokens = lastUsage?.agentRun?.usage?.totalTokens
      ?? approxTokens(messages.map(message => message.content).join('\n') + input);
    const window = contextWindowForModel(config.provider, config.model || meta.defaultModel, modelCatalog);
    const ratio = Math.min(1, usedTokens / window);
    const tone = ratio > 0.85 ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
      : ratio > 0.5 ? 'text-sky-200 border-sky-500/30 bg-sky-500/5'
      : 'text-surface-300 border-surface-700 bg-surface-900';
    return { usedTokens, window, ratio, tone };
  }, [messages, input, modelCatalog, config.provider, config.model, meta.defaultModel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUserInstructions(loadAgentUserInstructions(resolvedWorkspaceId));
  }, [resolvedWorkspaceId]);

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);
  const hasKeyForProvider = !meta.needsKey || serverKeyProviders.has(config.provider as AgentKeyProvider);
  const canSend = !loading && hasKeyForProvider;
  // El textarea NO se bloquea durante el streaming: el user debe poder
  // escribir para ENCOLAR el siguiente mensaje. Sólo se deshabilita por
  // indisponibilidad real (sin API key del provider). `canSend` sigue
  // gateando la acción de envío directo vs encolar.
  const inputDisabled = !hasKeyForProvider;
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const activeRemoteChat: RemoteAgentChat | null = currentChatId
    ? (remoteHistory.chats.find((chat) => chat.id === currentChatId) ?? null)
    : null;
  const hasActiveChat = Boolean(currentChatId || activeSession || messages.length > 0);

  // Bolita de estado del agente en el header. Reusa los flags ya existentes:
  // `loading` (streaming en curso) y el `error` del último mensaje. No
  // introduce estado nuevo.
  const agentStatus = useMemo<{ tone: 'idle' | 'thinking' | 'error' | 'ok'; label: string }>(() => {
    if (loading) return { tone: 'thinking', label: streamStatus || 'Pensando…' };
    const last = messages[messages.length - 1];
    if (last?.error) return { tone: 'error', label: 'Error en la última respuesta' };
    const hasAssistantReply = messages.some((m) => m.role === 'assistant' && !m.error);
    if (hasAssistantReply) return { tone: 'ok', label: 'Última respuesta completada' };
    return { tone: 'idle', label: 'Inactivo' };
  }, [loading, streamStatus, messages]);

  useEffect(() => {
    sessionDefaultsRef.current = { provider: config.provider, mode };
  }, [config.provider, mode]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Detección temprana de Ollama: si el provider activo es 'ollama', hacemos
  // un ping rápido (2s) a /api/tags. Si falla, marcamos ollamaOffline=true
  // antes de que el user envíe un mensaje — así el banner aparece de entrada
  // y el textarea queda enviable pero con guía visible para cambiar provider.
  useEffect(() => {
    if (config.provider !== 'ollama') {
      setOllamaOffline(false);
      return;
    }
    const raw = config.endpoint.trim() || 'http://localhost:11434';
    const base = raw.replace(/\/+$/, '').replace(/\/api\/chat$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    let cancelled = false;
    fetch(`${base}/api/tags`, { method: 'GET', signal: controller.signal })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setOllamaOffline(true);
        else setOllamaOffline(false);
      })
      .catch(() => {
        if (cancelled) return;
        setOllamaOffline(true);
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [config.provider, config.endpoint]);

  useEffect(() => {
    // Cargamos los chats legados de localStorage SOLO para preview read-only
    // en el historial. No los reactivamos como sesión viva — eso correría
    // contra el backend persistente. El user los puede revisar y borrar
    // manualmente desde el panel "Chats antiguos".
    const loaded = loadChatSessions(resolvedWorkspaceId);
    setSessions(loaded);
    setActiveSessionId(null);
    setCurrentChatId(null);
    currentChatIdRef.current = null;
    setMessages([]);
    setRollbackQueue([]);
    setInput('');
    historyHydratedRef.current = true;
  }, [resolvedWorkspaceId]);

  // El historial activo se persiste server-side por el stream
  // (POST `/api/agora-ai/chats/<id>/messages` desde el backend en cada turno).
  // Sólo mantenemos las sesiones legadas (localStorage) en memoria como
  // lectura — sin re-escribirlas.
  const sessionsRef = useRef<AgentChatSession[]>(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const updateMode = useCallback((_nextMode: AgentMode) => {}, []);

  const updateAccessProfile = useCallback((profile: Exclude<AgentAccessProfileId, 'custom'>) => {
    saveAgentAccessProfile(profile);
    setAccessPolicy(loadAgentAccessPolicy());
    // Bug 4: tras cambiar de perfil devolvemos foco al textarea para evitar la
    // sensación de "Enviar disabled brevemente" mientras el select pierde el
    // focus y el componente re-renderiza por el `AI_SETTINGS_CHANGED_EVENT`.
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
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
      const isRateLimited = res.status === 429;
      publishAgentProblem({
        severity: isRateLimited ? 'warning' : 'error',
        message: isRateLimited ? formatRateLimitMessage(raw) : `Tool ${action} falló`,
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
      dispatchAgoraEvent(AGORA_EVENTS.docsChanged, { workspaceId: resolvedWorkspaceId ?? null });
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
        model: config.model || meta.defaultModel,
        mode,
        accessPolicy,
        userInstructions: streamUserInstructions,
        dryRun: dryRunFlag,
        // Si ya hay un chat persistido vivo, el backend hace append. Si es
        // null, el stream crea uno y emite `chat-created` con el id.
        ...(currentChatIdRef.current ? { chatId: currentChatIdRef.current } : {})
      })
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        const friendly = formatRateLimitMessage(text);
        publishAgentProblem({
          severity: 'warning',
          message: friendly,
          detail: text,
          code: 'agora-ai-stream'
        });
        throw new Error(friendly);
      }
      publishAgentProblem({
        severity: 'error',
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
    let liveStepsCapWarned = false;

    // Throttle de syncPartialRun: el SSE puede emitir step events cada pocos
    // ms y antes hacíamos un setMessages por cada uno → re-render de TODOS los
    // mensajes con KaTeX/ReactMarkdown por step. Ahora coalescemos a max 1
    // flush cada 250ms y un flush final al cerrar el stream.
    const FLUSH_MS = 250;
    let lastFlushAt = 0;
    let pendingReply: string | null = null;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const flushPartialRun = () => {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      if (pendingReply === null) return;
      const reply = pendingReply;
      pendingReply = null;
      lastFlushAt = Date.now();
      // Snapshot estable del array de steps. El cap a 1 setMessages/250ms
      // evita la cascada de re-renders mientras se mantiene la "vivacidad"
      // visual del progreso.
      const snapshot = liveSteps.slice();
      updateMessageById(assistantMessageId, (current) => ({
        ...current,
        content: reply,
        agentRun: {
          mode,
          provider: config.provider,
          iterations: snapshot.length,
          steps: snapshot,
          finalReply: reply,
          rollback: current.agentRun?.rollback || []
        }
      }));
    };

    const syncPartialRun = (reply: string) => {
      pendingReply = reply;
      const since = Date.now() - lastFlushAt;
      if (since >= FLUSH_MS) {
        flushPartialRun();
        return;
      }
      if (pendingTimer) return;
      pendingTimer = setTimeout(flushPartialRun, FLUSH_MS - since);
    };

    let bufferOverflowed = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > STREAM_BUFFER_CAP_BYTES) {
        if (!bufferOverflowed) {
          bufferOverflowed = true;
          publishAgentProblem({
            severity: 'warning',
            message: 'Stream de Agora AI excedió el cap de buffer (4MB)',
            detail: 'Considera iniciar un nuevo chat para liberar memoria. La respuesta parcial recibida hasta ahora se mantiene.',
            code: 'agora-ai-stream-overflow'
          });
        }
        const lastSeparator = buffer.lastIndexOf('\n\n');
        if (lastSeparator >= 0) {
          buffer = buffer.slice(lastSeparator + 2);
        } else {
          buffer = '';
        }
        continue;
      }

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
        if (event.type === 'chat-created') {
          if (currentChatIdRef.current !== event.chatId) {
            currentChatIdRef.current = event.chatId;
            setCurrentChatId(event.chatId);
            void remoteHistory.refresh();
          }
          continue;
        }
        if (event.type === 'context-truncated') {
          publishAgentProblem({
            severity: 'info',
            message: `Compactamos ${event.removedCount} mensajes viejos del contexto para liberar tokens.`,
            detail: event.summary
          });
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
          updateMessageById(assistantMessageId, current => {
            const nextContent = event.status;
            if (current.content === nextContent) return current;
            return { ...current, content: nextContent };
          });
          continue;
        }

        if (event.type === 'step') {
          if (liveSteps.length >= MAX_LIVE_STEPS) {
            if (!liveStepsCapWarned) {
              liveStepsCapWarned = true;
              publishAgentProblem({
                severity: 'warning',
                message: `Agora AI excedió ${MAX_LIVE_STEPS} steps en vivo`,
                detail: 'Los steps adicionales no se mostrarán para evitar congelar el navegador. La ejecución del agente continúa en el servidor.',
                code: 'agora-ai-live-steps-cap'
              });
            }
          } else {
            liveSteps.push(event.step);
          }
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
          // Cancelar cualquier flush pendiente para evitar pisar el complete final.
          if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
          pendingReply = null;
          updateMessageById(assistantMessageId, current => ({
            ...current,
            content: event.reply,
            agentRun: event.agentRun,
            pendingConfirmation: event.agentRun.pendingConfirmation
          }));
          continue;
        }

        if (event.type === 'error') {
          if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
          pendingReply = null;
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

    // Stream cerrado naturalmente: flushear cualquier estado parcial pendiente.
    flushPartialRun();

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
  }, [accessPolicy, config.model, config.provider, meta.defaultModel, mode, remoteHistory, resolvedWorkspaceId, updateMessageById]);

  // Memoizar el array de tools por accessPolicy: toOllamaTools recorre la
  // tabla de ~140 definitions y arma un payload pesado.
  const ollamaToolsForPolicy = useMemo(() => toOllamaTools(accessPolicy), [accessPolicy]);

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
      if (ollamaToolsForPolicy.length > 0) {
        payload.tools = ollamaToolsForPolicy;
        // Disable extended thinking when tools are available — qwen3 often
        // wastes the thinking budget concluding "I don't have access" instead
        // of invoking the tools.  Disabling think forces tool-first behaviour.
        payload.think = false;
      }
    }
    // Timeout 8s sobre el fetch a Ollama local. Sin esto, si el server no
    // corre (ERR_FAILED en navegadores algunos toman >40s antes de fallar),
    // el panel queda "Ejecutando agente…" colgado. El signal externo
    // (controller del turno) sigue funcionando como cancelación del user.
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 8000);
    const onExternalAbort = () => timeoutController.abort();
    signal.addEventListener('abort', onExternalAbort, { once: true });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: timeoutController.signal,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      return await res.json() as OllamaChatResponse;
    } catch (err) {
      // Distinguimos abort externo (user pulsó stop) de timeout interno.
      if (signal.aborted) throw err;
      if (timeoutController.signal.aborted) {
        throw new Error(`Ollama timeout: el servidor en ${url} no respondió en 8s. Verificá que esté corriendo o cambiá de proveedor.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onExternalAbort);
    }
  }, [ollamaToolsForPolicy, config.endpoint, config.model, meta.defaultModel]);

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

    const maxIterations = resolveAgentMaxIterations(normalizedPolicy);
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const response = await callOllamaDirect(loopMessages, signal, true);
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

      if (!toolCalls.length) {
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
      iterations: maxIterations,
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

  const remoteMessageToUi = useCallback((message: RemoteAgentChatMessage): UIChatMessage | null => {
    // Sólo mostramos roles user/assistant en la UI. Los mensajes 'tool'
    // viven embebidos en `agentRun.toolResults` del assistant correspondiente.
    if (message.role !== 'user' && message.role !== 'assistant') return null;
    // Bug 1: si el backend persistió el `content` enriquecido con la sección
    // "[contexto del turno previo — tools ejecutadas]", la quitamos para no
    // renderizar el bloque duplicado al rehidratar el chat.
    const content = message.role === 'assistant'
      ? stripPreviousTurnContext(message.content)
      : message.content;
    // Detectar mensajes con tools persistidas pero sin agentRun reconstruido.
    // Los chats guardados antes de la migración de eventos del agente sólo
    // tienen toolCalls/toolResults como blobs opacos — no los suficiente para
    // reconstruir un AgentRun tipado (Opción A: badge informativo en lugar de
    // intentar una reconstrucción frágil).
    const hasHiddenTools = message.role === 'assistant' && (
      (Array.isArray(message.toolCalls) && message.toolCalls.length > 0) ||
      (Array.isArray(message.toolResults) && message.toolResults.length > 0)
    );
    return {
      id: message.id,
      role: message.role,
      content,
      ...(hasHiddenTools ? { hasHiddenTools: true } : {})
    };
  }, []);

  const activateRemoteChat = useCallback(async (chatId: string) => {
    autoConfirmedRef.current.clear();
    setLoadingMessages(true);
    try {
      const remoteMessages = await remoteHistory.loadMessages(chatId);
      const uiMessages = remoteMessages
        .map(remoteMessageToUi)
        .filter((m): m is UIChatMessage => m !== null);
      setActiveSessionId(null);
      setCurrentChatId(chatId);
      currentChatIdRef.current = chatId;
      setMessages(uiMessages);
      setRollbackQueue([]);
      setQueue([]);
      setQueuePaused(false);
      setInput('');
    } catch (error) {
      publishAgentProblem({
        severity: 'error',
        message: 'No se pudo cargar el chat',
        detail: error instanceof Error ? error.message : String(error),
        code: 'agora-ai-chat-load'
      });
    } finally {
      setLoadingMessages(false);
    }
  }, [remoteHistory, remoteMessageToUi]);

  // Activar sesión legada (localStorage, read-only). Mantiene flujo viejo
  // hasta que el user borre el chat antiguo.
  const activateSession = useCallback((sessionId: string) => {
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return;
    autoConfirmedRef.current.clear();
    setActiveSessionId(target.id);
    setCurrentChatId(null);
    currentChatIdRef.current = null;
    setMessages(target.messages);
    setRollbackQueue(target.rollbackQueue || []);
    setQueue([]);
    setQueuePaused(false);
    setInput('');
    if (target.mode !== mode) {
      updateMode(target.mode);
    }
  }, [mode, sessions, updateMode]);

  const startNewChat = useCallback(() => {
    // No pre-creamos el chat en backend — el stream lo crea en el primer
    // turno y emite `chat-created`. Esto evita chats vacíos huérfanos.
    autoConfirmedRef.current.clear();
    setActiveSessionId(null);
    setCurrentChatId(null);
    currentChatIdRef.current = null;
    setMessages([]);
    setRollbackQueue([]);
    setQueue([]);
    setQueuePaused(false);
    setInput('');
    textareaRef.current?.focus();
  }, []);

  const deleteActiveChat = useCallback(() => {
    autoConfirmedRef.current.clear();
    setQueue([]);
    setQueuePaused(false);
    // Caso 1: chat persistido activo → DELETE al backend, refresh listado.
    if (currentChatId) {
      const targetId = currentChatId;
      setCurrentChatId(null);
      currentChatIdRef.current = null;
      setMessages([]);
      setRollbackQueue([]);
      setInput('');
      remoteHistory.removeChat(targetId).catch((error) => {
        publishAgentProblem({
          severity: 'error',
          message: 'No se pudo eliminar el chat persistido',
          detail: error instanceof Error ? error.message : String(error),
          code: 'agora-ai-chat-delete'
        });
      });
      return;
    }
    // Caso 2: sesión legada activa → borrar de localStorage.
    if (activeSessionId) {
      const remaining = sessions.filter((session) => session.id !== activeSessionId);
      const saved = saveChatSessions(resolvedWorkspaceId, remaining);
      setSessions(saved);
      setActiveSessionId(null);
      setMessages([]);
      setRollbackQueue([]);
      setInput('');
      return;
    }
    // Caso 3: chat nuevo sin id todavía (no creado en backend) → sólo reset UI.
    setMessages([]);
    setRollbackQueue([]);
    setInput('');
  }, [activeSessionId, currentChatId, remoteHistory, resolvedWorkspaceId, sessions]);

  const renameCurrentChat = useCallback(async () => {
    if (!currentChatId) return;
    const fallback = deriveChatSessionTitle(messages);
    const next = window.prompt('Nuevo título para el chat:', fallback);
    if (!next || !next.trim()) return;
    try {
      await remoteHistory.renameChat(currentChatId, next.trim());
    } catch (error) {
      publishAgentProblem({
        severity: 'error',
        message: 'No se pudo renombrar el chat',
        detail: error instanceof Error ? error.message : String(error),
        code: 'agora-ai-chat-rename'
      });
    }
  }, [currentChatId, messages, remoteHistory]);

  // Feature "volver a este punto" (checkpoint estilo Copilot): descarta este
  // turno y todos los posteriores, re-prellenando el input con el texto del
  // user para re-preguntar desde ahí. Trunca (no fork) y persiste el descarte
  // para que sobreviva recarga / cross-device.
  const revertToMessage = useCallback(async (messageId: string) => {
    if (loading) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const target = messages[idx];
    if (!target || target.role !== 'user') return;
    if (messages.length - 1 === idx) {
      // Nada posterior que descartar: solo re-prellenar el input.
      setInput(target.content);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Esto descartará los mensajes posteriores. ¿Continuar?');
      if (!ok) return;
    }

    const prefillText = target.content;
    const kept = messages.slice(0, idx);
    // Índice 0-based de este turno entre los mensajes de rol user. El stream
    // persiste 1 doc user por turno en orden, así que mapea 1:1 con el backend
    // aun para mensajes en vivo (cuyo id local no es el doc id de Firestore).
    const userIndex = kept.filter((m) => m.role === 'user').length;

    // Persistencia primero para no dejar UI/backend desincronizados.
    if (currentChatId) {
      try {
        await remoteHistory.truncateFromUserIndex(currentChatId, userIndex);
      } catch (error) {
        publishAgentProblem({
          severity: 'error',
          message: 'No se pudo truncar la conversación persistida',
          detail: error instanceof Error ? error.message : String(error),
          code: 'agora-ai-chat-truncate'
        });
        return;
      }
      void remoteHistory.refresh();
    } else if (activeSessionId) {
      const updated = sessions.map((session) => (
        session.id === activeSessionId ? { ...session, messages: kept, updatedAt: Date.now() } : session
      ));
      const saved = saveChatSessions(resolvedWorkspaceId, updated);
      setSessions(saved);
    }

    autoConfirmedRef.current.clear();
    setMessages(kept);
    setInput(prefillText);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [loading, messages, currentChatId, remoteHistory, activeSessionId, sessions, resolvedWorkspaceId]);

  const handleRevertStable = useCallback((messageId: string) => {
    void revertToMessage(messageId);
  }, [revertToMessage]);

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

  // Núcleo de envío: despacha `rawTextArg`. `sendMessage` (entrada del
  // textarea) y el auto-dispatcher de la cola comparten este camino. No lee
  // `input` directamente para poder ejecutarse con texto encolado sin tocar
  // el textarea.
  const dispatchMessage = useCallback(async (rawTextArg: string) => {
    const rawText = rawTextArg.trim();
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

    // Bug #3: forzar scroll al fondo en el siguiente render tras añadir los mensajes.
    scrollToBottomRef.current = true;
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
    setLoading(true);
    setStreamStatus('');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let succeeded = true;
    try {

      if (isUndoRequest) {
        const undoReply = await runRollback(controller.signal);
        setMessages(prev => [...prev, toAssistantMessage(undoReply)]);
        return true;
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
      } else {
        if (!assistantMessageId) {
          throw new Error('Stream de Agora AI sin assistantMessageId');
        }
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
      }

      if (agentRun?.rollback?.length) {
        setRollbackQueue(agentRun.rollback);
      }
      if (config.provider === 'ollama') {
        setOllamaOffline(false);
        setMessages(prev => [...prev, toAssistantMessage(reply, agentRun)]);
      }
      // Bug 2: si el turno terminó con una tool bloqueada por capability,
      // guardamos el texto del usuario para ofrecer reintento al cambiar de
      // perfil. Si pasó sin bloqueo, limpiamos cualquier failure previo.
      const capabilityReason = detectCapabilityBlock(agentRun);
      if (capabilityReason) {
        lastFailedProfileRef.current = accessPolicy.profile;
        setLastFailedSend({ text, profile: accessPolicy.profile, reason: capabilityReason });
      } else {
        setLastFailedSend(null);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      succeeded = false;
      const errMsg = err instanceof Error ? err.message : 'Error de red';
      // Bug #4: si el proveedor es Ollama y el error es de conexión,
      // mostramos banner específico en lugar del mensaje genérico.
      const isOllamaFetch = config.provider === 'ollama' && /failed to fetch|network|ECONNREFUSED|ollama timeout|err_failed|err_connection|load failed/i.test(errMsg);
      if (isOllamaFetch) {
        setOllamaOffline(true);
        if (assistantMessageId) {
          updateMessageById(assistantMessageId, current => ({
            ...current,
            content: 'El servidor Ollama local no responde.',
            error: true,
            agentRun: undefined,
            pendingConfirmation: undefined
          }));
        }
      } else {
        setOllamaOffline(false);
        publishAgentProblem({
          severity: 'error',
          message: 'Error enviando mensaje a Agora AI',
          detail: errMsg,
          code: 'agora-ai-send'
        });
        if (assistantMessageId) {
          updateMessageById(assistantMessageId, current => ({
            ...current,
            content: errMsg,
            error: true,
            agentRun: undefined,
            pendingConfirmation: undefined
          }));
        } else {
          setMessages(prev => [...prev, toAssistantMessage(errMsg, undefined, true)]);
        }
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
    return succeeded;
  }, [loading, canSend, messages, mode, runRollback, config.provider, runOllamaLoop, emitAgentWorkspaceEvents, runServerAgentStream, updateMessageById, userInstructions, dryRun, nextTurnHints, accessPolicy.profile]);

  // Entrada desde el textarea. Si el agente ya está respondiendo (`loading`),
  // en vez de bloquear, ENCOLA el texto y limpia el input — el auto-dispatcher
  // lo despachará al terminar el turno actual. Si está libre, despacha directo.
  const sendMessage = useCallback(async () => {
    const rawText = input.trim();
    if (!rawText) return;
    if (loading) {
      setQueue((prev) => [...prev, { id: uid(), text: rawText }]);
      setQueuePaused(false);
      setInput('');
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    setInput('');
    await dispatchMessage(rawText);
  }, [input, loading, dispatchMessage]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueuePaused(false);
  }, []);

  const resumeQueue = useCallback(() => {
    setQueuePaused(false);
  }, []);

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

  const handleOpenDocumentStable = useCallback((doc: AgentDocumentTarget) => {
    if (typeof window === 'undefined') return;
    dispatchAgoraEvent(AGORA_EVENTS.openDocuments, {
      workspaceId: resolvedWorkspaceId,
      documents: [doc],
      focusFolder: doc.folder,
      source: 'agora-ai'
    });
  }, [resolvedWorkspaceId]);

  // Bug 2: reenvía el último mensaje que falló por capability del perfil
  // anterior. Sólo prellena el textarea y le da foco — el envío lo dispara el
  // user con Enter. Hacerlo automático arriesga reenviar con perfil incorrecto
  // si el cambio de perfil aún no se persistió en el orchestrator del backend.
  const retryFailedSend = useCallback(() => {
    if (!lastFailedSend) return;
    const { text } = lastFailedSend;
    setLastFailedSend(null);
    setInput(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [lastFailedSend]);

  const dismissFailedSend = useCallback(() => {
    setLastFailedSend(null);
  }, []);

  // Bug #3: cuando se envía un nuevo turno forzamos scroll al fondo.
  // Lo consumimos en un useEffect separado para que corra después del commit
  // del render que añadió el nuevo mensaje de user + placeholder assistant.
  useEffect(() => {
    if (!scrollToBottomRef.current) return;
    scrollToBottomRef.current = false;
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
  }, [messages]);

  // Bug #3 (parte 2): al completar el streaming (loading: true → false),
  // scroll al fondo si el user estaba cerca del fondo durante el stream.
  // Si scrolleó manualmente hacia arriba (isAtBottomRef.current = false),
  // no forzamos — está leyendo y no queremos interrumpirle.
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (wasLoading && !loading && isAtBottomRef.current) {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
    }
  }, [loading]);

  // Auto-dispatcher de la cola de mensajes. Cuando el turno actual termina
  // (`loading` true → false) y hay mensajes encolados y la cola no está en
  // pausa, despacha el siguiente. Si ese mensaje falla (429, error de red),
  // pausa la cola SIN perder los pendientes restantes. Usa refs para leer
  // siempre el último `dispatchMessage`/cola y evitar closures rancios.
  const dispatchMessageRef = useRef(dispatchMessage);
  useEffect(() => { dispatchMessageRef.current = dispatchMessage; }, [dispatchMessage]);
  const queueDrainingRef = useRef(false);
  const prevLoadingForQueueRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevLoadingForQueueRef.current;
    prevLoadingForQueueRef.current = loading;
    if (!(wasLoading && !loading)) return;
    if (queuePaused || queue.length === 0 || queueDrainingRef.current) return;
    const next = queue[0];
    if (!next) return;
    queueDrainingRef.current = true;
    setQueue((prev) => prev.slice(1));
    void (async () => {
      try {
        const ok = await dispatchMessageRef.current(next.text);
        if (!ok) setQueuePaused(true);
      } catch {
        setQueuePaused(true);
      } finally {
        queueDrainingRef.current = false;
      }
    })();
  }, [loading, queue, queuePaused]);

  // Auto-confirm en god mode: si llega un pendingConfirmation y el perfil
  // activo lo permite, se aprueba sin pedir input al usuario.
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
                  <span className="text-sm font-medium">Historial</span>
                </div>
                <p className="text-[10px] text-surface-500 mt-0.5">
                  {loadingMessages
                    ? 'Cargando conversación…'
                    : remoteHistory.loading
                      ? 'Sincronizando…'
                      : 'Sincronizado en tu cuenta · todos los dispositivos'}
                </p>
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
              {remoteHistory.error && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-300">
                  {remoteHistory.error}
                </div>
              )}
              {remoteHistory.chats.length === 0 && !remoteHistory.loading && (
                <div className="text-[10px] text-surface-500 px-1 py-2">
                  No tenés chats todavía. Mandá tu primer mensaje y se guardará automáticamente.
                </div>
              )}
              {remoteHistory.chats.map((chat) => {
                const isActive = chat.id === currentChatId;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => { void activateRemoteChat(chat.id); setShowHistory(false); }}
                    className={`w-full text-left rounded-lg border px-2.5 py-2 transition ${
                      isActive
                        ? 'border-sky-500/40 bg-sky-500/10 text-surface-100'
                        : 'border-surface-800 bg-surface-900/60 text-surface-300 hover:border-surface-700 hover:bg-surface-900'
                    }`}
                  >
                    <div className="text-xs font-medium truncate">{chat.title || 'Nuevo chat'}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-surface-500">
                      <span className="truncate">{chat.provider ?? '—'}</span>
                      <span>{formatSessionTimestamp(chat.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}

              {sessions.length > 0 && (
                <>
                  <div className="mt-3 pt-2 border-t border-surface-800">
                    <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-surface-500">
                      Chats antiguos · solo este dispositivo
                    </div>
                  </div>
                  {sessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => { activateSession(session.id); setShowHistory(false); }}
                        className={`w-full text-left rounded-lg border px-2.5 py-2 transition opacity-90 ${
                          isActive
                            ? 'border-amber-500/40 bg-amber-500/10 text-surface-100'
                            : 'border-surface-800 bg-surface-900/40 text-surface-400 hover:border-surface-700 hover:bg-surface-900'
                        }`}
                      >
                        <div className="text-xs font-medium truncate">{session.title || 'Nuevo chat'}</div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-surface-500">
                          <span className="truncate">{session.messages.length} msg · local</span>
                          <span>{formatSessionTimestamp(session.updatedAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
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
          <span
            className={`flex-shrink-0 w-2 h-2 rounded-full ${
              agentStatus.tone === 'thinking'
                ? 'bg-amber-400 animate-pulse'
                : agentStatus.tone === 'error'
                  ? 'bg-mandy-500'
                  : agentStatus.tone === 'ok'
                    ? 'bg-emerald-500'
                    : 'bg-surface-600'
            }`}
            title={agentStatus.label}
            aria-label={`Estado del agente: ${agentStatus.label}`}
            role="status"
          />
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
          {currentChatId && (
            <button
              onClick={() => { void renameCurrentChat(); }}
              className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
              title={activeRemoteChat?.title ? `Renombrar "${activeRemoteChat.title}"` : 'Renombrar chat'}
              aria-label="Renombrar chat"
            >
              <ListTree className="w-3.5 h-3.5" />
            </button>
          )}
          {hasActiveChat && (
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
            onClick={() => dispatchAgoraEvent(AGORA_EVENTS.openAiConfig)}
            className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
            title="Configuración de IA"
            aria-label="Configuración"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="scrollbar-agora flex-1 overflow-hidden min-h-0 relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-surface-500 gap-4 select-none px-4">
            <Bot className="w-10 h-10 text-surface-700" />
            <div>
              <p className="text-sm text-surface-300">Dale una tarea al agente</p>
              <p className="text-xs mt-1 max-w-md text-surface-500">
                El agente puede trabajar con documentos, snippets, glosario semántico, tablero Kanban, formalización, ST y worker/terminal cuando esté conectado.
              </p>
              {hasKeyForProvider ? null : (
                <p className="text-xs text-amber-400 mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Configura tu API key en Ajustes → Agora IA
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
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            className="scrollbar-agora h-full"
            followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
            atBottomStateChange={(atBottom) => { isAtBottomRef.current = atBottom; }}
            atBottomThreshold={150}
            increaseViewportBy={{ top: 600, bottom: 600 }}
            computeItemKey={(_, msg) => msg.id}
            itemContent={(_index, msg) => (
              <div className="px-3 py-1">
                <ChatMessage
                  msg={msg}
                  traceExpanded={traceExpanded}
                  confirmingId={confirmingId}
                  copiedId={copiedId}
                  onConfirm={handleConfirmStable}
                  onCopy={handleCopyStable}
                  onOpenDocument={handleOpenDocumentStable}
                  onRevert={handleRevertStable}
                />
              </div>
            )}
            components={{
              Footer: () => (
                <div className="px-3 pt-1 pb-2">
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 flex items-center gap-2 text-surface-400 text-sm">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{streamStatus || 'Ejecutando agente…'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            }}
          />
        )}
      </div>

      <div className="flex-shrink-0 border-t border-surface-700 p-2 bg-surface-900 min-w-0">
        {/* Bug #4: Ollama local no responde — banner con acción clara. */}
        {ollamaOffline && config.provider === 'ollama' && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">El servidor Ollama local no responde.</div>
              <div className="text-amber-300/80 mt-0.5">
                Verificá que Ollama esté corriendo en{' '}
                <code className="font-mono">{(config.endpoint?.trim() || 'http://localhost:11434')}</code>.
                También podés cambiar a otro proveedor.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOllamaOffline(false);
                dispatchAgoraEvent(AGORA_EVENTS.openAiConfig);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-amber-100 hover:bg-amber-500/30 transition flex-shrink-0"
              title="Abrir configuración del proveedor"
            >
              <Settings className="w-3 h-3" />
              Configurar
            </button>
          </div>
        )}
        {/* Bug 2: banner de reintento cuando el último turno falló por
            capability del perfil. Sólo se muestra si el user ya cambió a un
            perfil distinto desde el fallo — así no parece "cri-cri" si sigue
            en el mismo perfil bloqueado. */}
        {lastFailedSend && lastFailedSend.profile !== accessPolicy.profile && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">El turno previo falló por permisos del perfil <code className="font-mono">{lastFailedSend.profile}</code>.</div>
              <div className="text-amber-300/80 mt-0.5 truncate" title={lastFailedSend.text}>
                Cambiaste a <code className="font-mono">{accessPolicy.profile}</code>. ¿Reintentar el mismo prompt?
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={retryFailedSend}
                className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-amber-100 hover:bg-amber-500/30 transition"
                title="Cargar el último prompt fallido en el textarea para reenviarlo"
              >
                <RotateCcw className="w-3 h-3" />
                Reintentar
              </button>
              <button
                type="button"
                onClick={dismissFailedSend}
                className="rounded-md px-1 text-amber-300 hover:text-amber-100"
                aria-label="Descartar"
                title="Descartar"
              >
                ×
              </button>
            </div>
          </div>
        )}
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
        {queue.length > 0 && (
          <div className="mb-2 rounded-lg border border-surface-700 bg-surface-925/60 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-surface-400">
                <Clock className="h-3 w-3" />
                En cola ({queue.length})
              </span>
              <button
                type="button"
                onClick={clearQueue}
                className="rounded px-1.5 py-0.5 text-[10px] text-surface-400 transition hover:bg-surface-800 hover:text-surface-100"
                title="Vaciar la cola"
              >
                Vaciar
              </button>
            </div>
            {queuePaused && (
              <div className="mb-1.5 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">Cola en pausa.</span> El último mensaje falló; los pendientes se conservan.
                </div>
                <button
                  type="button"
                  onClick={resumeQueue}
                  className="flex-shrink-0 rounded border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-amber-100 transition hover:bg-amber-500/30"
                  title="Reanudar el envío de la cola"
                >
                  Reanudar
                </button>
              </div>
            )}
            <ul className="space-y-1">
              {queue.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-md border border-surface-800 bg-surface-900/70 px-2 py-1 text-xs text-surface-300"
                >
                  <span className="flex-shrink-0 font-mono text-[10px] text-surface-500">{index + 1}.</span>
                  <span className="min-w-0 flex-1 truncate" title={item.text}>{item.text}</span>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(item.id)}
                    className="flex-shrink-0 rounded p-0.5 text-surface-500 transition hover:bg-surface-800 hover:text-mandy-300"
                    aria-label="Quitar de la cola"
                    title="Quitar de la cola"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-end gap-2 min-w-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              const next = e.target.value;
              setInput(next);
              // Autocomplete en vivo: mostrar lista filtrada cuando empieza con /.
              const trimmed = next.trim();
              if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
                const q = trimmed.toLowerCase();
                const filtered = SLASH_COMMANDS.filter(c => c.command.toLowerCase().startsWith(q));
                setShowSlashHelp(filtered.length > 0 ? filtered : SLASH_COMMANDS);
              } else if (showSlashHelp) {
                setShowSlashHelp(null);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={!hasKeyForProvider ? 'Configura tu API key en Ajustes…' : loading ? 'Escribe para encolar el siguiente mensaje…' : 'Pídele una acción al agente…'}
            disabled={inputDisabled}
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
            <>
              {input.trim() && hasKeyForProvider && (
                <button
                  onClick={() => void sendMessage()}
                  className="flex-shrink-0 p-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition"
                  title="Encolar mensaje (Enter) — se enviará al terminar el turno actual"
                  aria-label="Encolar mensaje"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={stopGeneration}
                className="flex-shrink-0 p-2 rounded-lg bg-mandy-600 hover:bg-mandy-500 text-white transition"
                title="Detener generación"
                aria-label="Detener"
              >
                <Square className="w-4 h-4" fill="currentColor" />
              </button>
            </>
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
                  dispatchAgoraEvent(AGORA_EVENTS.openAiConfig);
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
                        dispatchAgoraEvent(AGORA_EVENTS.openAiConfig);
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
            <span
              title={`${tokenCounterInfo.usedTokens.toLocaleString()} / ${tokenCounterInfo.window.toLocaleString()} tokens (≈ ${(tokenCounterInfo.ratio * 100).toFixed(0)}%) — ventana del modelo. ${accessPolicy.capabilities.workspaceContext ? 'Contexto del workspace activo.' : 'Contexto del workspace desactivado.'}`}
              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition ${tokenCounterInfo.tone}`}
            >
              <ListTree className="w-3 h-3" />
              <span className="font-mono">{formatNumber(tokenCounterInfo.usedTokens)}/{formatNumber(tokenCounterInfo.window)}</span>
            </span>
          </div>
          <div className="text-surface-400 hidden sm:flex items-center gap-1 shrink-0">
            <kbd className="rounded border border-surface-700 bg-surface-950 px-1 py-0.5 font-mono text-[10px] text-surface-300">Enter</kbd>
            <span>enviar</span>
            <span className="opacity-60">·</span>
            <kbd className="rounded border border-surface-700 bg-surface-950 px-1 py-0.5 font-mono text-[10px] text-surface-300">⇧Enter</kbd>
            <span>salto</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
