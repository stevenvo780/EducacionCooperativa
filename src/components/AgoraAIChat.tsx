'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Bot, Send, Settings, X, ChevronDown, ChevronUp,
  Loader2, Trash2, Copy, Check, AlertCircle
} from 'lucide-react';
import { authFetch } from '@/services/apiClient';
import { loadClientConfig, saveClientConfig } from '@/lib/clientConfigStorage';

// ── Types ────────────────────────────────────────────────────────────────────

type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'gemini';

interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  endpoint: string; // for ollama custom URL
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

interface AgoraAIChatProps {
  workspaceId?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIG_KEY = 'agoraAIConfig';

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
    defaultModel: 'claude-3-5-haiku-20241022',
    needsKey: true,
    modelPlaceholder: 'claude-3-5-haiku-20241022, claude-opus-4-6…'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadConfig(): AIProviderConfig {
  return loadClientConfig(CONFIG_STORAGE);
}

function saveConfig(cfg: AIProviderConfig) {
  saveClientConfig(CONFIG_STORAGE, cfg);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Markdown components for AI responses
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
  ul: (props: any) => <ul {...props} className="list-disc pl-4 my-1 space-y-0.5" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ol: (props: any) => <ol {...props} className="list-decimal pl-4 my-1 space-y-0.5" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p: (props: any) => <p {...props} className="my-1" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockquote: (props: any) => <blockquote {...props} className="border-l-2 border-surface-600 pl-3 my-2 text-surface-400 italic" />
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgoraAIChat({ workspaceId }: AgoraAIChatProps) {
  const [config, setConfig] = useState<AIProviderConfig>(loadConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const meta = PROVIDER_META[config.provider];

  // Abort in-flight AI request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const updateConfig = useCallback((partial: Partial<AIProviderConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      saveConfig(next);
      return next;
    });
  }, []);

  // Fetch workspace context for direct-call providers (Ollama)
  const fetchContext = useCallback(async (signal: AbortSignal): Promise<string> => {
    if (!workspaceId) return '';
    try {
      const res = await authFetch(
        `/api/agora-ai/context?workspaceId=${encodeURIComponent(workspaceId)}`,
        { signal }
      );
      if (!res.ok) return '';
      const data = await res.json() as { context?: string };
      return data.context ?? '';
    } catch {
      return '';
    }
  }, [workspaceId]);

  // Call Ollama directly from the browser (not through server)
  const callOllamaDirect = useCallback(async (
    msgs: Array<{ role: string; content: string }>,
    signal: AbortSignal
  ): Promise<string> => {
    const base = config.endpoint.trim() || 'http://localhost:11434';
    const url = `${base}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: config.model || meta.defaultModel,
        messages: msgs,
        stream: false
      })
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json() as { message?: { content: string } };
    return data.message?.content ?? '';
  }, [config.endpoint, config.model, meta.defaultModel]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const chatMsgs = history.map(m => ({ role: m.role, content: m.content }));
      let reply = '';

      if (config.provider === 'ollama') {
        // Direct browser → Ollama (works with local, LAN, VPN, remote)
        const context = await fetchContext(controller.signal);
        const systemMsg = [
          'Eres un asistente inteligente de Agora, una plataforma educativa colaborativa con lógica formal.',
          'Responde de forma clara, concisa y útil. Puedes usar Markdown.',
          context
        ].filter(Boolean).join('\n\n');

        const fullMsgs = [
          { role: 'system', content: systemMsg },
          ...chatMsgs
        ];
        reply = await callOllamaDirect(fullMsgs, controller.signal);
      } else {
        // Cloud providers go through the server proxy (hides API keys + injects context)
        const res = await authFetch('/api/agora-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: chatMsgs,
            workspaceId,
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model || meta.defaultModel
          })
        });

        const data = await res.json() as { reply?: string; error?: string };
        if (!res.ok || data.error) {
          setMessages(prev => [...prev, {
            id: uid(), role: 'assistant', content: data.error ?? 'Error desconocido', error: true
          }]);
          return;
        }
        reply = data.reply ?? '';
      }

      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: reply }]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Error de red';
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: msg, error: true }]);
    } finally {
      abortRef.current = null;
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, messages, workspaceId, config, meta.defaultModel, fetchContext, callOllamaDirect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }, [sendMessage]);

  const copyMessage = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const clearChat = useCallback(() => setMessages([]), []);

  return (
    <div className="flex flex-col h-full bg-surface-900 text-surface-200 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700 bg-surface-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-medium text-surface-100">Agora AI</span>
          <span className={`text-xs ${meta.color} bg-surface-800 px-1.5 py-0.5 rounded`}>
            {meta.label}
          </span>
          {workspaceId && (
            <span className="text-xs text-surface-500 hidden sm:inline">· contexto activo</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
              title="Limpiar chat"
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

      {/* Config panel */}
      {showConfig && (
        <div className="flex-shrink-0 border-b border-surface-700 bg-surface-950 p-3 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-surface-300 font-medium">Configuración del proveedor de IA</span>
            <button onClick={() => setShowConfig(false)} className="text-surface-500 hover:text-surface-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Provider selector */}
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

          {/* API Key (if needed) */}
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

          {/* Ollama endpoint */}
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
              <p className="text-surface-600 mt-0.5">Ollama remoto necesita <code className="text-amber-400/70">OLLAMA_ORIGINS=*</code> para permitir requests del browser</p>
            </div>
          )}

          {/* Model */}
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

          {workspaceId && (
            <p className="text-surface-500 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" />
              Contexto del workspace incluido automáticamente en cada mensaje
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-surface-500 gap-3 select-none">
            <Bot className="w-10 h-10 text-surface-700" />
            <div>
              <p className="text-sm text-surface-400">Pregúntale a {meta.label}</p>
              <p className="text-xs mt-1">
                {workspaceId
                  ? 'El asistente tiene acceso a los documentos y conceptos de este workspace'
                  : 'Abre desde un workspace para incluir el contexto automáticamente'}
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

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`group relative max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
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
              <div className="whitespace-pre-wrap break-words prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={markdownComponents}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
              {msg.role === 'assistant' && !msg.error && (
                <button
                  onClick={() => void copyMessage(msg.id, msg.content)}
                  className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition"
                  title="Copiar respuesta"
                >
                  {copiedId === msg.id
                    ? <Check className="w-3 h-3 text-emerald-400" />
                    : <Copy className="w-3 h-3" />
                  }
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 flex items-center gap-2 text-surface-400 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Pensando…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-surface-700 p-2 bg-surface-900">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={meta.needsKey && !config.apiKey ? 'Configura tu API key primero…' : 'Escribe un mensaje… (Enter para enviar, Shift+Enter nueva línea)'}
            disabled={loading || (meta.needsKey && !config.apiKey)}
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
            disabled={!input.trim() || loading || (meta.needsKey && !config.apiKey)}
            className="flex-shrink-0 p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition"
            title="Enviar (Enter)"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1 px-1">
          <button
            onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-1 text-[10px] text-surface-600 hover:text-surface-400 transition"
          >
            <span className={meta.color}>{meta.label}</span>
            {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <span className="text-[10px] text-surface-700">Enter · enviar</span>
        </div>
      </div>
    </div>
  );
}
