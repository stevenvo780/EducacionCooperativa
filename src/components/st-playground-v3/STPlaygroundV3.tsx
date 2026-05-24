'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { evalStInBrowser, type StPlaygroundEvalResult } from '@/lib/st-eval';
import { listProfiles } from '@stevenvo780/st-lang';
import { apiUrl, getAuthToken } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import ChatPanel from './ChatPanel';
import EditorPanel from './EditorPanel';
import ResultsPanel from './ResultsPanel';
import type { ChatMessage, Suggestion } from './types';

const DEFAULT_PROFILE = 'classical.propositional';
const DEFAULT_FORMULA = `logic ${DEFAULT_PROFILE}\n\ncheck valid (P -> P)\n`;

const SYSTEM_PROMPT = `Eres un asistente experto en lógica formal y en el lenguaje ST (st-lang).
Cuando el usuario describa un argumento en lenguaje natural, formaliza:
- Identifica el perfil lógico más adecuado (classical.propositional, modal.k, intuitionistic.propositional, deontic.standard, epistemic.s5, paraconsistent.belnap, classical.first_order, aristotelian.syllogistic).
- Devuelve SIEMPRE un único bloque de código ST válido entre triples backticks, así:
\`\`\`st
logic <perfil>

axiom a1 : <fórmula>
check valid (<conclusión>)
\`\`\`

Reglas ST:
- conectivas: !, &, |, ->, <->; cuantificadores: forall x. P(x), exists x. P(x); modales: box P, dia P.
- usa "axiom name : formula" para premisas, "derive conclusión from {a1, a2}" para derivaciones, "check valid (...)" para validez, "truth_table (...)" para tablas.
- Mantén la respuesta breve (≤4 líneas de explicación + el bloque).
`;

type MobileTab = 'chat' | 'editor' | 'results';

interface ParsedSSEEvent {
  type: string;
  data: unknown;
}

function parseEventLine(raw: string): ParsedSSEEvent | null {
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && typeof (data as { type?: unknown }).type === 'string') {
      return { type: (data as { type: string }).type, data };
    }
  } catch {
    return null;
  }
  return null;
}

function extractStFormula(text: string): string | null {
  const fenced = text.match(/```(?:st|stlang)?\s*\n([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  // fallback: si arranca con `logic …` reconocible
  const logicLine = text.match(/(^|\n)(logic\s+\S+[\s\S]*?)(?:\n\n|$)/);
  if (logicLine && logicLine[2]) return logicLine[2].trim();
  return null;
}

export default function STPlaygroundV3() {
  const { user, loading: authLoading } = useAuth();
  const authReady = !!user && !authLoading;

  const profiles = useMemo(() => {
    try {
      return listProfiles();
    } catch {
      return [DEFAULT_PROFILE];
    }
  }, []);

  const [formula, setFormula] = useState(DEFAULT_FORMULA);
  const [profile, setProfile] = useState<string>(DEFAULT_PROFILE);
  const [result, setResult] = useState<StPlaygroundEvalResult | null>(null);
  const [validating, setValidating] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');

  const validate = useCallback(() => {
    if (!formula.trim()) return;
    setValidating(true);
    try {
      const r = evalStInBrowser(formula, profile);
      setResult(r);
    } finally {
      setValidating(false);
    }
  }, [formula, profile]);

  const reset = useCallback(() => {
    setFormula(DEFAULT_FORMULA);
    setProfile(DEFAULT_PROFILE);
    setResult(null);
    setSuggestions([]);
  }, []);

  // Cmd/Ctrl + Enter validate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        validate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [validate]);

  const sendToAI = useCallback(async (userText: string) => {
    if (!authReady) return;
    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: userText },
      { id: assistantId, role: 'assistant', content: '' }
    ]);
    setStreaming(true);

    const token = await getAuthToken().catch(() => null);
    if (!token) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: 'No hay sesión activa. Inicia sesión para usar el co-pilot.' } : m
      ));
      setStreaming(false);
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/agora-ai/stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userText }
          ],
          provider: 'anthropic',
          mode: 'chat',
          accessPolicy: 'no-tools',
          userInstructions: '',
          dryRun: false
        })
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error ${res.status}: ${text.slice(0, 200) || 'sin cuerpo'}` }
            : m
        ));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let finalText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf('\n\n');

          const dataLine = rawEvent
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!dataLine) continue;

          const event = parseEventLine(dataLine.slice(6));
          if (!event) continue;

          if (event.type === 'step') {
            const step = (event.data as { step?: { type?: string; content?: string } }).step;
            if (step && (step.type === 'final' || step.type === 'plan') && step.content) {
              assistantText = step.content;
              const idForUpdate = assistantId;
              setMessages((prev) => prev.map((m) =>
                m.id === idForUpdate ? { ...m, content: assistantText } : m
              ));
            }
          } else if (event.type === 'status') {
            const status = (event.data as { status?: string }).status;
            if (status && !assistantText) {
              const idForUpdate = assistantId;
              setMessages((prev) => prev.map((m) =>
                m.id === idForUpdate ? { ...m, content: status } : m
              ));
            }
          } else if (event.type === 'final' || event.type === 'done') {
            const reply = (event.data as { reply?: string }).reply
              ?? (event.data as { content?: string }).content
              ?? assistantText;
            if (typeof reply === 'string' && reply.length > 0) {
              finalText = reply;
            }
          }
        }
      }

      const fullText = finalText || assistantText;
      if (fullText) {
        const idForUpdate = assistantId;
        setMessages((prev) => prev.map((m) =>
          m.id === idForUpdate ? { ...m, content: fullText } : m
        ));

        const proposed = extractStFormula(fullText);
        if (proposed) {
          setFormula(proposed);
          setSuggestions((prev) => [
            {
              id: `s-${Date.now()}`,
              kind: 'IA propuesta',
              label: 'Fórmula propuesta por la IA aplicada al editor',
              formula: proposed
            },
            ...prev
          ].slice(0, 6));

          // detectar perfil
          const profileMatch = proposed.match(/^\s*logic\s+(\S+)/m);
          if (profileMatch && profileMatch[1] && profiles.includes(profileMatch[1])) {
            setProfile(profileMatch[1]);
          }
        }
      } else {
        const idForUpdate = assistantId;
        setMessages((prev) => prev.map((m) =>
          m.id === idForUpdate ? { ...m, content: '(la IA no devolvió contenido)' } : m
        ));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const idForUpdate = assistantId;
      setMessages((prev) => prev.map((m) =>
        m.id === idForUpdate ? { ...m, content: `Error de red: ${message}` } : m
      ));
    } finally {
      setStreaming(false);
    }
  }, [authReady, profiles]);

  return (
    <div className="flex h-screen flex-col bg-surface-900 text-surface-50">
      <header className="flex items-center gap-2 border-b border-surface-700/80 bg-surface-925/80 px-4 py-2 backdrop-blur">
        <Sparkles className="h-4 w-4 text-mandy-400" aria-hidden />
        <h1 className="text-sm font-semibold">ST Playground v3</h1>
        <span className="text-[10px] uppercase tracking-wider text-surface-400">
          AI Co-pilot · NL → ST
        </span>
      </header>

      <nav className="flex border-b border-surface-700/80 md:hidden" role="tablist">
        {(['chat', 'editor', 'results'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={mobileTab === t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 px-2 py-2 text-xs capitalize ${
              mobileTab === t
                ? 'border-b-2 border-mandy-500 text-surface-50'
                : 'text-surface-400'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="flex-1 min-h-0 p-3">
        <div className="hidden h-full min-h-0 grid-cols-12 gap-3 md:grid">
          <div className="col-span-4 min-h-0">
            <ChatPanel
              messages={messages}
              streaming={streaming}
              authReady={authReady}
              onSend={sendToAI}
            />
          </div>
          <div className="col-span-4 min-h-0">
            <EditorPanel
              formula={formula}
              profile={profile}
              profiles={profiles}
              validating={validating}
              onFormulaChange={setFormula}
              onProfileChange={setProfile}
              onValidate={validate}
              onReset={reset}
            />
          </div>
          <div className="col-span-4 min-h-0">
            <ResultsPanel result={result} suggestions={suggestions} />
          </div>
        </div>

        <div className="h-full min-h-0 md:hidden">
          {mobileTab === 'chat' && (
            <ChatPanel
              messages={messages}
              streaming={streaming}
              authReady={authReady}
              onSend={sendToAI}
            />
          )}
          {mobileTab === 'editor' && (
            <EditorPanel
              formula={formula}
              profile={profile}
              profiles={profiles}
              validating={validating}
              onFormulaChange={setFormula}
              onProfileChange={setProfile}
              onValidate={validate}
              onReset={reset}
            />
          )}
          {mobileTab === 'results' && (
            <ResultsPanel result={result} suggestions={suggestions} />
          )}
        </div>
      </main>
    </div>
  );
}
