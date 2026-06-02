'use client';

import { useState, useRef, useEffect, useId, type FormEvent } from 'react';
import { Bot, Send, Loader2, User, Sparkles, KeyRound } from 'lucide-react';
import type { ChatMessage } from './types';

interface ChatPanelProps {
  messages: ChatMessage[];
  streaming: boolean;
  authReady: boolean;
  noKeysConfigured: boolean;
  onSend: (text: string) => void | Promise<void>;
}

export default function ChatPanel({ messages, streaming, authReady, noKeysConfigured, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const inputId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streaming]);

  const canSend = authReady && !noKeysConfigured;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || streaming || !canSend) return;
    setInput('');
    void onSend(text);
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-surface-700/80 bg-surface-800/60 backdrop-blur">
      <header className="flex items-center gap-2 border-b border-surface-700/80 px-4 py-3">
        <Sparkles className="h-4 w-4 text-mandy-400" aria-hidden />
        <h2 className="text-sm font-semibold text-surface-50">Co-pilot</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-surface-400">
          NL → ST
        </span>
      </header>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 text-sm"
      >
        {messages.length === 0 && (
          <div className="text-surface-400 text-xs leading-relaxed">
            Describe lo que quieres formalizar en lenguaje natural.
            <br />
            Ejemplo: <em className="text-surface-300">&quot;Si llueve entonces el suelo está mojado, y llueve. Conclusión: el suelo está mojado.&quot;</em>
            <br />
            La IA propondrá una fórmula ST que aparecerá en el editor central.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-2 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                message.role === 'user'
                  ? 'bg-mandy-500/20 text-mandy-300'
                  : 'bg-accent-purple/30 text-accent-purple-light'
              }`}
            >
              {message.role === 'user' ? (
                <User className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                message.role === 'user'
                  ? 'bg-mandy-500/10 text-surface-50 border border-mandy-500/30'
                  : 'bg-surface-700/60 text-surface-100 border border-surface-600/60'
              }`}
            >
              {message.content || (message.role === 'assistant' && streaming ? (
                <span className="inline-flex items-center gap-1 text-surface-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  pensando…
                </span>
              ) : '')}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-surface-700/80 p-3 space-y-2"
      >
        {!authReady && (
          <p className="text-[11px] text-amber-400">
            Inicia sesión para usar el co-pilot IA.
          </p>
        )}
        {authReady && noKeysConfigured && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
            <p className="text-[11px] leading-relaxed text-amber-300">
              No hay ninguna API key configurada.{' '}
              <a
                href="/settings?tab=agent"
                className="underline underline-offset-2 hover:text-amber-200"
              >
                Configura una en Ajustes → Agente IA
              </a>{' '}
              para usar el co-pilot.
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            id={inputId}
            name="copilot-prompt"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Formaliza esto…"
            rows={2}
            disabled={streaming || !canSend}
            className="flex-1 resize-none rounded-lg border border-surface-600 bg-surface-900/80 px-3 py-2 text-xs text-surface-50 placeholder:text-surface-500 focus:border-mandy-500 focus:outline-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={streaming || !canSend || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg bg-mandy-500 text-white hover:bg-mandy-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar"
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
