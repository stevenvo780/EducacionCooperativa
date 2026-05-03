'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Bot, Send, Settings, ChevronDown,
  Loader2, Trash2, Copy, Check, AlertCircle, Sparkles, Undo2,
  History, MessageSquarePlus, Shield
} from 'lucide-react';
import { authFetch, getAuthToken } from '@/services/apiClient';
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
import {
  AI_SETTINGS_CHANGED_EVENT,
  PROVIDER_META,
  loadAIProviderConfig,
  loadAgentAccessPolicy,
  saveAgentAccessProfile,
  loadAgentMode,
  saveAgentMode,
  type AIProviderConfig
} from '@/lib/agora-ai/clientSettings';
import { AGENT_ACCESS_PROFILE_ORDER, AGENT_ACCESS_PROFILES, normalizeAgentAccessPolicy } from '@/lib/agora-ai/accessPolicy';
import type {
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
  AgentDiagnosticEventDetail,
  AgentToolExecutionResult,
  AgentTraceStep,
  AgentUiCommandEventDetail
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

function truncateDebug(value: string | undefined, max = 3000) {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}\n\n[...truncado por Agora AI...]` : value;
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
      <pre className="bg-surface-950 rounded-md p-3 my-2 overflow-x-auto text-xs leading-relaxed">
        <code className={`${className || ''} text-surface-200 font-mono`} {...props}>{children}</code>
      </pre>
    ) : (
      <code className="bg-surface-700 text-sky-300 px-1 rounded text-[0.85em] font-mono" {...props}>{children}</code>
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: (props: any) => <a {...props} className="text-sky-400 underline hover:text-sky-300" target="_blank" rel="noopener noreferrer" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ul: (props: any) => <ul {...props} className="list-disc pl-4 my-0.5 space-y-0" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ol: (props: any) => <ol {...props} className="list-decimal pl-4 my-0.5 space-y-0" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p: (props: any) => <p {...props} className="my-0.5 leading-snug" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockquote: (props: any) => <blockquote {...props} className="border-l-2 border-surface-600 pl-3 my-2 text-surface-400 italic" />
} as const;

export default function AgoraAIChat({ workspaceId }: AgoraAIChatProps) {
  const [config, setConfig] = useState<AIProviderConfig>(loadAIProviderConfig);
  const [mode, setMode] = useState<AgentMode>(loadAgentMode);
  const [accessPolicy, setAccessPolicy] = useState<AgentAccessPolicy>(loadAgentAccessPolicy);

  useEffect(() => {
    const handler = () => {
      setConfig(loadAIProviderConfig());
      setMode(loadAgentMode());
      setAccessPolicy(loadAgentAccessPolicy());
    };
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, handler);
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rollbackQueue, setRollbackQueue] = useState<AgentRollbackAction[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyHydratedRef = useRef(false);
  const sessionDefaultsRef = useRef({ provider: config.provider, mode });
  const sendingRef = useRef(false);
  const lastSendAtRef = useRef(0);

  const meta = PROVIDER_META[config.provider];
  const resolvedWorkspaceId = workspaceId || PERSONAL_WORKSPACE_ID;
  const canSend = !loading && (!meta.needsKey || Boolean(config.apiKey));
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  useEffect(() => {
    sessionDefaultsRef.current = { provider: config.provider, mode };
  }, [config.provider, mode]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const loaded = loadChatSessions(resolvedWorkspaceId);
    if (loaded.length > 0) {
      const [firstSession] = loaded;
      setSessions(loaded);
      setActiveSessionId(firstSession.id);
      setMessages(firstSession.messages);
      setRollbackQueue(firstSession.rollbackQueue || []);
      if (firstSession.mode !== sessionDefaultsRef.current.mode) {
        setMode(firstSession.mode);
        saveAgentMode(firstSession.mode);
      }
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

  const updateMode = useCallback((nextMode: AgentMode) => {
    setMode(nextMode);
    saveAgentMode(nextMode);
  }, []);

  const updateAccessProfile = useCallback((profile: Exclude<AgentAccessProfileId, 'custom'>) => {
    saveAgentAccessProfile(profile);
    setAccessPolicy(loadAgentAccessPolicy());
  }, []);

  const fetchContext = useCallback(async (signal: AbortSignal): Promise<string> => {
    try {
      const res = await authFetch(
        `/api/agora-ai/context?workspaceId=${encodeURIComponent(resolvedWorkspaceId)}`,
        { signal }
      );
      if (!res.ok) return '';
      const data = await res.json() as { context?: string };
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
      window.dispatchEvent(new CustomEvent('agora:documents-mutated', { detail }));
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
      window.dispatchEvent(new CustomEvent('agora:agent-tool-result', { detail: event }));
    });
    workerCommandEvents.forEach((event) => {
      window.dispatchEvent(new CustomEvent('agora:worker-command-result', { detail: event }));
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
      window.dispatchEvent(new CustomEvent<AgentUiCommandEventDetail>('agora:agent-ui-command', { detail: event }));
    });
    diagnosticEvents.forEach((event) => {
      window.dispatchEvent(new CustomEvent<AgentDiagnosticEventDetail>('agora:agent-diagnostic', { detail: event }));
      publishAgentProblem({
        severity: event.severity,
        message: event.message,
        detail: event.detail,
        code: event.code
      });
    });
    if (mutatedEvent) {
      window.dispatchEvent(new CustomEvent('agora:documents-mutated', { detail: mutatedEvent }));
    }
    if (shouldRefreshDocuments) {
      window.dispatchEvent(new Event('agora:docs-changed'));
    }
    if (openDocumentsEvent) {
      window.dispatchEvent(new CustomEvent('agora:open-documents', { detail: openDocumentsEvent }));
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
    signal: AbortSignal
  ): Promise<AgentResponseBody> => {
    const token = await getAuthToken();
    const res = await fetch('/api/agora-ai/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal,
      body: JSON.stringify({
        messages: history.map(message => ({ role: message.role, content: message.content })),
        workspaceId: resolvedWorkspaceId,
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model || meta.defaultModel,
        mode,
        accessPolicy
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

        const event = JSON.parse(dataLine.slice(6)) as AgentStreamEvent;
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
      payload.tools = toOllamaTools();
      // Disable extended thinking when tools are available — qwen3 often
      // wastes the thinking budget concluding "I don't have access" instead
      // of invoking the tools.  Disabling think forces tool-first behaviour.
      payload.think = false;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    return await res.json() as OllamaChatResponse;
  }, [config.endpoint, config.model, meta.defaultModel]);

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
      accessPolicy: normalizedPolicy
    });
    const steps: AgentTraceStep[] = [];
    const rollback: AgentRollbackAction[] = [];
    const loopMessages: Array<Record<string, unknown>> = [
      { role: 'system', content: systemMsg },
      ...history.map(message => ({ role: message.role, content: message.content }))
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
        finalReply = visible || toolResults[0].result.summary;
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
  }, [accessPolicy, callOllamaDirect, executeAgoraTool, fetchContext, mode, resolvedWorkspaceId]);

  const copyMessage = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
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
    const [nextActive] = saved;
    setSessions(saved);
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
    const text = input.trim();
    const now = Date.now();
    if (!text || loading || !canSend) return;
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

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (isUndoRequest) {
        const undoReply = await runRollback(controller.signal);
        setMessages(prev => [...prev, toAssistantMessage(undoReply)]);
        return;
      }

      let reply = '';
      let agentRun: AgentRun | undefined;

      if (config.provider === 'ollama') {
        agentRun = await runOllamaLoop(history, controller.signal);
        reply = agentRun.finalReply;
        emitAgentWorkspaceEvents(agentRun);
      } else if (shouldStreamServerAgent && assistantMessageId) {
        const streamed = await runServerAgentStream(history, assistantMessageId, controller.signal);
        reply = streamed.reply;
        agentRun = streamed.agentRun;
        emitAgentWorkspaceEvents(agentRun);
      } else {
        const chatMsgs = history.map(message => ({ role: message.role, content: message.content }));
        const res = await authFetch('/api/agora-ai', {
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
            accessPolicy
          })
        });

        const data = await res.json() as AgentResponseBody;
        if (!res.ok || data.error) {
          publishAgentProblem({
            severity: res.status === 429 ? 'warning' : 'error',
            message: `Agora AI falló (${res.status})`,
            detail: data.error ?? 'Error desconocido',
            code: 'agora-ai-request'
          });
          setMessages(prev => [...prev, toAssistantMessage(data.error ?? 'Error desconocido', undefined, true)]);
          return;
        }
        reply = data.reply;
        agentRun = data.agentRun;
        emitAgentWorkspaceEvents(agentRun);
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
      abortRef.current = null;
      setLoading(false);
      setStreamStatus('');
      textareaRef.current?.focus();
    }
  }, [accessPolicy, input, loading, canSend, messages, mode, runRollback, config.provider, config.apiKey, config.model, meta.defaultModel, resolvedWorkspaceId, runOllamaLoop, emitAgentWorkspaceEvents, runServerAgentStream, updateMessageById]);

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

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-surface-500 gap-4 select-none px-4">
            <Bot className="w-10 h-10 text-surface-700" />
            <div>
              <p className="text-sm text-surface-300">{mode === 'agent' ? 'Dale una tarea al agente' : `Pregúntale a ${meta.label}`}</p>
              <p className="text-xs mt-1 max-w-md text-surface-500">
                {mode === 'agent'
                  ? 'El agente puede trabajar con documentos, snippets, glosario semántico, tablero Kanban, formalización, ST y worker/terminal cuando esté conectado.'
                  : 'En modo chat responderá con contexto del workspace, sin ejecutar acciones de escritura.'}
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
              {(mode === 'agent'
                ? [
                    { icon: '📋', label: 'Resume el documento abierto' },
                    { icon: '🗂️', label: 'Organiza los archivos por tema' },
                    { icon: '🧮', label: 'Formaliza la última sección a ST' },
                    { icon: '↩️', label: 'Deshaz la última acción' }
                  ]
                : [
                    { icon: '💡', label: '¿Cuáles son las ideas principales del workspace?' },
                    { icon: '🔍', label: 'Busca menciones de un concepto específico' },
                    { icon: '📚', label: 'Explica este glosario en términos simples' },
                    { icon: '🧪', label: 'Revisa la lógica del documento' }
                  ]
              ).map((prompt) => (
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

        {messages.map(msg => {
          const visibleSteps = msg.agentRun?.steps.filter(step => step.type !== 'final') ?? [];
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`group relative max-w-[88%] rounded-lg px-3 py-1.5 text-sm leading-normal ${
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
                <div className="break-words max-w-none">
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
                        return <AgentThinkingBlock key={step.id} content={step.content} />;
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
                      return <ToolCallBlock key={step.id} step={step} />;
                    })}

                    {msg.pendingConfirmation && (
                      <InlineConfirmation
                        pending={msg.pendingConfirmation}
                        busy={confirmingId === msg.id}
                        onConfirm={() => void handleConfirmation(msg.id, true)}
                        onReject={() => void handleConfirmation(msg.id, false)}
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
                    onClick={() => void copyMessage(msg.id, msg.content)}
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
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 flex items-center gap-2 text-surface-400 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{mode === 'agent' ? (streamStatus || 'Ejecutando agente…') : 'Pensando…'}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t border-surface-700 p-2 bg-surface-900">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={meta.needsKey && !config.apiKey ? 'Configura tu API key primero…' : mode === 'agent' ? 'Pídele una acción al agente… (ej: organiza, resume, crea, mueve, deshaz eso)' : 'Escribe un mensaje… (Enter para enviar, Shift+Enter nueva línea)'}
            disabled={loading || !canSend}
            rows={1}
            className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder-surface-600 focus:outline-none focus:border-sky-500 transition resize-none disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ minHeight: '36px', maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || loading || !canSend}
            className="flex-shrink-0 p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition"
            title="Enviar (Enter)"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {/* Footer estilo Copilot: pills de Modelo, Modo y Contexto a la
            izquierda; hint de Enter a la derecha. Click en pill abre el
            modal de configuración correspondiente. */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-0.5 text-[10px]">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('agora:open-ai-config'))}
              title="Cambiar modelo / proveedor"
              className="flex items-center gap-1 rounded-md border border-surface-700 bg-surface-900 px-1.5 py-0.5 text-surface-300 transition hover:border-sky-500/40 hover:text-white"
            >
              <Bot className="w-3 h-3" />
              <span className={`${meta.color} truncate max-w-[8rem]`}>{meta.label}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            <button
              type="button"
              onClick={() => updateMode(mode === 'agent' ? 'chat' : 'agent')}
              title={mode === 'agent' ? 'Cambiar a modo Chat (solo lectura)' : 'Cambiar a modo Agente (con tools)'}
              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition ${
                mode === 'agent'
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-200 hover:border-violet-500/60'
                  : 'border-surface-700 bg-surface-900 text-surface-300 hover:border-surface-600'
              }`}
            >
              {mode === 'agent' ? <Sparkles className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
              <span>{mode === 'agent' ? 'Agente' : 'Chat'}</span>
            </button>
            <label
              title="Nivel de permisos del agente"
              className="flex items-center gap-1 rounded-md border border-surface-700 bg-surface-900 px-1.5 py-0.5 text-surface-300 transition hover:border-surface-600"
            >
              <Shield className="w-3 h-3 text-mandy-300" />
              <select
                value={accessPolicy.profile}
                onChange={(event) => updateAccessProfile(event.target.value as Exclude<AgentAccessProfileId, 'custom'>)}
                className="max-w-[6.5rem] bg-transparent text-[10px] text-surface-200 outline-none"
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
              title={accessPolicy.capabilities.workspaceContext
                ? (resolvedWorkspaceId === PERSONAL_WORKSPACE_ID ? 'Contexto: workspace personal' : 'Contexto: workspace activo')
                : 'Contexto automático desactivado'}
              className="hidden sm:flex items-center gap-1 rounded-md border border-surface-800 bg-surface-900/50 px-1.5 py-0.5 text-surface-400"
            >
              <Check className={`w-3 h-3 ${accessPolicy.capabilities.workspaceContext ? 'text-emerald-500' : 'text-surface-600'}`} />
              <span>Contexto</span>
            </span>
          </div>
          <div className="text-surface-600 flex items-center gap-1">
            <kbd className="rounded border border-surface-700 bg-surface-950 px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
            <span>enviar · </span>
            <kbd className="rounded border border-surface-700 bg-surface-950 px-1 py-0.5 font-mono text-[9px]">Shift+Enter</kbd>
            <span className="hidden sm:inline">salto</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
