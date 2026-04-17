'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Bot, Send, Settings, X, ChevronDown, ChevronUp,
  Loader2, Trash2, Copy, Check, AlertCircle, Sparkles, Undo2,
  History, MessageSquarePlus, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { authFetch, getAuthToken } from '@/services/apiClient';
import {
  createEmptyChatSession,
  deriveChatSessionTitle,
  loadChatSessions,
  saveChatSessions,
  upsertChatSession
} from '@/lib/agora-ai/chatHistory';
import { loadClientConfig, saveClientConfig } from '@/lib/clientConfigStorage';
import { AgentThinkingBlock } from '@/components/chat/AgentThinkingBlock';
import { ToolCallBlock } from '@/components/chat/ToolCallBlock';
import { InlineConfirmation } from '@/components/chat/InlineConfirmation';
import { buildAgoraSystemPrompt, extractThinkingSegments } from '@/lib/agora-ai/systemPrompt';
import { toOllamaTools } from '@/lib/agora-ai/toolDefinitions';
import { collectAgentWorkspaceEffects } from '@/lib/agora-ai/uiEvents';
import type {
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
  AgentTraceStep,
  AIProvider
} from '@/lib/agora-ai/types';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  endpoint: string;
}

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

const CONFIG_KEY = 'agoraAIConfig';
const AGENT_MODE_KEY = 'agoraAIMode';
const UNDO_COMMAND = /^\s*(deshaz|undo|revierte|rollback)/i;

const PROVIDER_META: Record<AIProvider, { label: string; color: string; defaultModel: string; needsKey: boolean; modelPlaceholder: string }> = {
  openai: {
    label: 'ChatGPT (OpenAI)',
    color: 'text-emerald-400',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    modelPlaceholder: 'gpt-4o-mini, gpt-4o, o1-mini…'
  },
  anthropic: {
    label: 'Claude (Anthropic)',
    color: 'text-amber-400',
    defaultModel: 'claude-haiku-4-5-20251001',
    needsKey: true,
    modelPlaceholder: 'claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-6…'
  },
  ollama: {
    label: 'Ollama',
    color: 'text-sky-400',
    defaultModel: 'llama3.2',
    needsKey: false,
    modelPlaceholder: 'llama3.2, mistral, gemma3…'
  },
  gemini: {
    label: 'Gemini (Google)',
    color: 'text-violet-400',
    defaultModel: 'gemini-2.0-flash',
    needsKey: true,
    modelPlaceholder: 'gemini-2.0-flash, gemini-1.5-pro…'
  }
};

const DEFAULT_CONFIG: AIProviderConfig = {
  provider: 'ollama',
  apiKey: '',
  model: '',
  endpoint: ''
};

const CONFIG_STORAGE = {
  storageKey: CONFIG_KEY,
  defaults: DEFAULT_CONFIG,
  sensitiveKeys: ['apiKey'] as const
};

function loadConfig(): AIProviderConfig {
  return loadClientConfig(CONFIG_STORAGE);
}

function saveConfig(cfg: AIProviderConfig) {
  saveClientConfig(CONFIG_STORAGE, cfg);
}

function loadMode(): AgentMode {
  if (typeof window === 'undefined') return 'agent';
  const raw = window.localStorage.getItem(AGENT_MODE_KEY);
  return raw === 'chat' ? 'chat' : 'agent';
}

function saveMode(mode: AgentMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AGENT_MODE_KEY, mode);
}

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
  const [config, setConfig] = useState<AIProviderConfig>(loadConfig);
  const [mode, setMode] = useState<AgentMode>(loadMode);
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
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
        saveMode(firstSession.mode);
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

  const updateConfig = useCallback((partial: Partial<AIProviderConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      saveConfig(next);
      return next;
    });
  }, []);

  const updateMode = useCallback((nextMode: AgentMode) => {
    setMode(nextMode);
    saveMode(nextMode);
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
        ...args
      })
    });
    const result = await res.json() as AgentToolExecutionResult;
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
  }, [resolvedWorkspaceId, config.endpoint, config.model]);

  const emitAgentWorkspaceEvents = useCallback((agentRun?: AgentRun) => {
    if (typeof window === 'undefined' || !agentRun) return;
    const { openDocumentsEvent, mutatedEvent } = collectAgentWorkspaceEffects(agentRun, resolvedWorkspaceId);
    if (mutatedEvent) {
      window.dispatchEvent(new CustomEvent('agora:documents-mutated', { detail: mutatedEvent }));
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
        mode
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status} al iniciar el stream del agente`);
    }
    if (!res.body) {
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
          throw new Error(event.error);
        }
      }
    }

    if (!finalPayload) {
      throw new Error('El stream terminó sin respuesta final del agente');
    }

    return finalPayload;
  }, [config.apiKey, config.model, config.provider, meta.defaultModel, mode, resolvedWorkspaceId, updateMessageById]);

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
    const context = await fetchContext(signal);
    const systemMsg = buildAgoraSystemPrompt({
      mode,
      contextPrompt: context,
      workspaceId: resolvedWorkspaceId
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

      // Execute all tools concurrently
      const settled = await Promise.allSettled(
        toolCalls.map(async (toolCall) => ({
          toolCall,
          result: await executeAgoraTool(toolCall.name, toolCall.args, signal)
        }))
      );
      const toolResults = settled.map((item, i) => {
        if (item.status === 'fulfilled') return item.value;
        const toolCall = toolCalls[i];
        return {
          toolCall,
          result: {
            ok: false,
            name: toolCall.name,
            callId: toolCall.id,
            summary: `Error inesperado: ${String(item.reason)}`,
            error: String(item.reason)
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
  }, [callOllamaDirect, executeAgoraTool, fetchContext, mode, resolvedWorkspaceId]);

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
    if (!text || loading || !canSend) return;

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
            mode
          })
        });

        const data = await res.json() as AgentResponseBody;
        if (!res.ok || data.error) {
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
      abortRef.current = null;
      setLoading(false);
      setStreamStatus('');
      textareaRef.current?.focus();
    }
  }, [input, loading, canSend, messages, mode, runRollback, config.provider, config.apiKey, config.model, meta.defaultModel, resolvedWorkspaceId, runOllamaLoop, emitAgentWorkspaceEvents, runServerAgentStream, updateMessageById]);

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
      setMessages(prev => [...prev, toAssistantMessage(message, undefined, true)]);
    } finally {
      setConfirmingId(null);
    }
  }, [messages, clearPendingConfirmation, executeAgoraTool, config.provider, emitAgentWorkspaceEvents]);

  return (
    <div className="flex h-full bg-surface-900 text-surface-200 overflow-hidden">
      <aside className={`${showHistory ? 'w-60 border-r border-surface-700' : 'w-0 border-r-0'} bg-surface-950/70 transition-all duration-200 overflow-hidden flex-shrink-0`}>
        <div className="h-full flex flex-col">
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
              onClick={startNewChat}
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
                  onClick={() => activateSession(session.id)}
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
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700 bg-surface-900 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setShowHistory(value => !value)}
            className="p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition"
            title={showHistory ? 'Ocultar historial local' : 'Mostrar historial local'}
          >
            {showHistory ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <Bot className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="text-sm font-medium text-surface-100 truncate">Agora AI</span>
          <span className={`text-xs ${meta.color} bg-surface-800 px-1.5 py-0.5 rounded whitespace-nowrap`}>
            {meta.label}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${mode === 'agent' ? 'bg-violet-500/15 text-violet-300' : 'bg-surface-800 text-surface-400'}`}>
            {mode === 'agent' ? 'Agente' : 'Chat'}
          </span>
          <span className="text-xs text-surface-500 hidden md:inline">· {resolvedWorkspaceId === PERSONAL_WORKSPACE_ID ? 'workspace personal' : 'contexto activo'}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden sm:flex rounded-md border border-surface-700 overflow-hidden mr-1">
            <button
              type="button"
              onClick={() => updateMode('chat')}
              className={`px-2 py-1 text-[10px] transition ${mode === 'chat' ? 'bg-surface-700 text-surface-100' : 'text-surface-500 hover:text-surface-300'}`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => updateMode('agent')}
              className={`px-2 py-1 text-[10px] transition ${mode === 'agent' ? 'bg-violet-500/15 text-violet-300' : 'text-surface-500 hover:text-surface-300'}`}
            >
              Agente
            </button>
          </div>
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
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>
          {(messages.length > 0 || activeSession) && (
            <button
              onClick={deleteActiveChat}
              className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
              title="Eliminar conversación actual"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setShowConfig(v => !v)}
            className={`p-1 rounded transition ${showConfig ? 'text-sky-400 bg-sky-500/10' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-700'}`}
            title="Configurar IA"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="flex-shrink-0 border-b border-surface-700 bg-surface-950 p-3 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-surface-300 font-medium">Configuración del proveedor de IA</span>
            <button onClick={() => setShowConfig(false)} className="text-surface-500 hover:text-surface-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(Object.keys(PROVIDER_META) as AIProvider[]).map(p => (
              <button
                key={p}
                onClick={() => updateConfig({ provider: p })}
                className={`px-2 py-1.5 rounded border text-left transition ${
                  config.provider === p
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                    : 'border-surface-600 bg-surface-800 text-surface-400 hover:border-surface-500 hover:text-surface-300'
                }`}
              >
                <div className={`font-medium ${PROVIDER_META[p].color}`}>{PROVIDER_META[p].label.split('(')[0]?.trim() || p}</div>
                <div className="text-[10px] text-surface-500 mt-0.5 truncate">{PROVIDER_META[p].label.split('(')[1]?.replace(')', '') ?? ''}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-md border border-violet-500/20 bg-violet-500/5 px-2.5 py-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            <div className="flex-1 min-w-0">
              <p className="text-violet-200 font-medium">Modo {mode === 'agent' ? 'agente' : 'chat'}</p>
              <p className="text-violet-100/80 text-[11px] leading-relaxed">
                {mode === 'agent'
                  ? 'El modelo puede planificar, usar tools, modificar documentos y deshacer cambios.'
                  : 'El modelo responde y asesora, pero no modifica el workspace.'}
              </p>
            </div>
          </div>

          {meta.needsKey && (
            <div>
              <label className="block text-surface-400 mb-1">API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={e => updateConfig({ apiKey: e.target.value })}
                placeholder={`Pega tu ${meta.label} API key`}
                className="w-full bg-surface-800 border border-surface-600 rounded px-2 py-1.5 text-surface-200 placeholder-surface-600 focus:outline-none focus:border-sky-500 transition font-mono"
              />
            </div>
          )}

          {config.provider === 'ollama' && (
            <div>
              <label className="block text-surface-400 mb-1">URL de Ollama</label>
              <input
                type="text"
                value={config.endpoint}
                onChange={e => updateConfig({ endpoint: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full bg-surface-800 border border-surface-600 rounded px-2 py-1.5 text-surface-200 placeholder-surface-600 focus:outline-none focus:border-sky-500 transition font-mono"
              />
              <p className="text-surface-600 mt-1">Local: <code className="text-sky-400/70">http://localhost:11434</code> · Remoto: <code className="text-sky-400/70">http://tu-ip:11434</code></p>
              <p className="text-surface-600 mt-0.5">Ollama remoto necesita <code className="text-amber-400/70">OLLAMA_ORIGINS=*</code> para permitir requests del browser.</p>
            </div>
          )}

          <div>
            <label className="block text-surface-400 mb-1">Modelo (opcional)</label>
            <input
              type="text"
              value={config.model}
              onChange={e => updateConfig({ model: e.target.value })}
              placeholder={meta.modelPlaceholder}
              className="w-full bg-surface-800 border border-surface-600 rounded px-2 py-1.5 text-surface-200 placeholder-surface-600 focus:outline-none focus:border-sky-500 transition font-mono"
            />
            <p className="text-surface-600 mt-1">Por defecto: {meta.defaultModel}</p>
          </div>

          <p className="text-surface-500 flex items-center gap-1 flex-wrap">
            <Check className="w-3 h-3 text-emerald-500" />
            Contexto del workspace incluido automáticamente.
            {mode === 'agent' && <span>· Tools activas · Confirmación obligatoria para borrar.</span>}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-surface-500 gap-3 select-none">
            <Bot className="w-10 h-10 text-surface-700" />
            <div>
              <p className="text-sm text-surface-400">{mode === 'agent' ? 'Dale una tarea al agente' : `Pregúntale a ${meta.label}`}</p>
              <p className="text-xs mt-1 max-w-md">
                {mode === 'agent'
                  ? 'El agente puede trabajar con documentos, snippets, glosario semántico, tablero Kanban, formalización y ejecución ST, además de resumir y comparar contenido.'
                  : 'En modo chat responderá con contexto del workspace, sin ejecutar acciones de escritura.'}
              </p>
              {!meta.needsKey || config.apiKey ? null : (
                <p className="text-xs text-amber-400 mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Configura tu API key primero
                </p>
              )}
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
        <div className="flex items-center justify-between mt-1 px-1 gap-2">
          <button
            onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-1 text-[10px] text-surface-600 hover:text-surface-400 transition"
          >
            <span className={meta.color}>{meta.label}</span>
            {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <div className="flex items-center gap-2 text-[10px] text-surface-700">
            <span className="hidden sm:inline">{mode === 'agent' ? 'Agente activo' : 'Modo chat'}</span>
            <span>Enter · enviar</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
