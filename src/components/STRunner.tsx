'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, RotateCcw, Trash2, ChevronDown, Zap, BookOpen, Terminal } from 'lucide-react';
import { useSTInterpreter, type STHistoryEntry } from '@/hooks/useSTInterpreter';

// ── Constantes ──────────────────────────────────────────────

const DEFAULT_SCRIPT = `// ST — Motor de Lógica Formal
// Escribe tu script ST aquí

logic classical.propositional

// Declara axiomas
axiom a1 : P -> Q
axiom a2 : P

// Deriva por Modus Ponens
derive Q from {a1, a2}

// Verifica tautología
check valid ((P -> Q) -> (!Q -> !P))

// Tabla de verdad
truth_table (P & Q)
`;

const EXAMPLES: { label: string; code: string }[] = [
  {
    label: 'Modus Ponens',
    code: `logic classical.propositional
axiom a1 : P -> Q
axiom a2 : P
derive Q from {a1, a2}`
  },
  {
    label: 'Tabla de verdad',
    code: `logic classical.propositional
truth_table (P -> Q)`
  },
  {
    label: 'Contramodelo',
    code: `logic classical.propositional
countermodel (P -> Q)`
  },
  {
    label: 'Equivalencia lógica',
    code: `logic classical.propositional
check equivalent (P -> Q), (! P | Q)`
  },
  {
    label: 'Derivación encadenada',
    code: `logic classical.propositional
axiom a1 : P -> Q
axiom a2 : Q -> R
axiom a3 : P
derive R from {a1, a2, a3}`
  },
  {
    label: 'De Morgan',
    code: `logic classical.propositional
check equivalent (!(P & Q)), (!P | !Q)
check equivalent (!(P | Q)), (!P & !Q)`
  },
  {
    label: 'Prueba desde teoría',
    code: `logic classical.propositional
axiom a1 : P -> Q
axiom a2 : Q -> R
axiom a3 : P
prove R`
  },
  {
    label: 'Capa textual',
    code: `logic classical.propositional
let p1 = passage [[doc.md#section1]]
let f1 = formalize p1 as (P -> Q)
claim c1 : P -> Q
support c1 <- f1
confidence c1 = 0.9
context c1 = "Análisis del documento"
render claims`
  }
];

// ── Subcomponentes ──────────────────────────────────────────

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        ok
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-red-500/20 text-red-400'
      }`}
    >
      {ok ? '✓ OK' : '✗ Error'}
    </span>
  );
}

function OutputLine({ line }: { line: string }) {
  // Colorear según prefijo
  let className = 'text-slate-300';
  if (line.startsWith('✓')) className = 'text-emerald-400';
  else if (line.startsWith('✗')) className = 'text-red-400';
  else if (line.startsWith('◎')) className = 'text-blue-400';
  else if (line.startsWith('⊘')) className = 'text-amber-400';
  else if (line.startsWith('?')) className = 'text-yellow-400';
  else if (line.startsWith('⚠')) className = 'text-orange-400';
  else if (line.startsWith('→')) className = 'text-cyan-400 font-semibold';
  else if (line.startsWith('  Prueba:')) className = 'text-purple-400';
  else if (line.startsWith('    ')) className = 'text-slate-400 font-mono text-xs';
  else if (line.includes('---') || line.includes('-+-')) className = 'text-slate-600';

  return <div className={className}>{line}</div>;
}

function HistoryPanel({ entries }: { entries: STHistoryEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Ejecuta código ST para ver resultados aquí
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2 p-2">
      {entries.map(entry => (
        <div key={entry.id} className="border border-slate-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700">
            <code className="text-xs text-slate-400 truncate max-w-[70%]">
              {entry.input.split('\n')[0]}
              {entry.input.includes('\n') ? ' ...' : ''}
            </code>
            <StatusBadge ok={entry.result.ok} />
          </div>
          <div className="p-3 bg-slate-900/50 font-mono text-sm space-y-0.5">
            {entry.result.stdout &&
              entry.result.stdout.split('\n').map((line, i) => (
                <OutputLine key={i} line={line} />
              ))}
            {entry.result.stderr && (
              <div className="text-red-400 text-xs mt-1 whitespace-pre-wrap">
                {entry.result.stderr}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Componente principal ────────────────────────────────────

export type STRunnerMode = 'script' | 'repl';

interface STRunnerProps {
  /** Código inicial */
  initialCode?: string;
  /** Modo inicial */
  initialMode?: STRunnerMode;
  /** Altura del componente (CSS) */
  height?: string;
  /** Callback cuando se ejecuta código */
  onExecute?: (code: string, result: any) => void;
  /** Clase CSS extra */
  className?: string;
}

export default function STRunner({
  initialCode,
  initialMode = 'script',
  height = '100%',
  onExecute,
  className = ''
}: STRunnerProps) {
  const { run, execLine, quick, reset, history, clearHistory, theorySummary, profiles, isRunning } =
    useSTInterpreter();

  const [mode, setMode] = useState<STRunnerMode>(initialMode);
  const [code, setCode] = useState(initialCode || DEFAULT_SCRIPT);
  const [replInput, setReplInput] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replInputRef = useRef<HTMLInputElement>(null);
  const [replHistory, setReplHistory] = useState<string[]>([]);
  const [replHistoryIdx, setReplHistoryIdx] = useState(-1);

  // ── Ejecutar script completo ──
  const handleRun = useCallback(() => {
    const result = run(code);
    onExecute?.(code, result);
  }, [code, run, onExecute]);

  // ── Ejecutar línea REPL ──
  const handleReplSubmit = useCallback(() => {
    const line = replInput.trim();
    if (!line) return;

    const result = execLine(line);
    onExecute?.(line, result);
    setReplHistory(prev => [...prev, line]);
    setReplHistoryIdx(-1);
    setReplInput('');
  }, [replInput, execLine, onExecute]);

  // ── Quick eval ──
  const handleQuickEval = useCallback(() => {
    const expr = replInput.trim();
    if (!expr) return;
    const result = quick(expr);
    onExecute?.(expr, result);
    setReplHistory(prev => [...prev, expr]);
    setReplHistoryIdx(-1);
    setReplInput('');
  }, [replInput, quick, onExecute]);

  // ── Navegación historial REPL ──
  const handleReplKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleReplSubmit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (replHistory.length > 0) {
          const newIdx =
            replHistoryIdx === -1
              ? replHistory.length - 1
              : Math.max(0, replHistoryIdx - 1);
          setReplHistoryIdx(newIdx);
          setReplInput(replHistory[newIdx]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (replHistoryIdx >= 0) {
          const newIdx = replHistoryIdx + 1;
          if (newIdx >= replHistory.length) {
            setReplHistoryIdx(-1);
            setReplInput('');
          } else {
            setReplHistoryIdx(newIdx);
            setReplInput(replHistory[newIdx]);
          }
        }
      }
    },
    [handleReplSubmit, replHistory, replHistoryIdx]
  );

  // ── Atajos de teclado ──
  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      // Tab → 2 espacios
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;
        setCode(value.substring(0, start) + '  ' + value.substring(end));
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [handleRun]
  );

  // ── Cargar ejemplo ──
  const loadExample = useCallback((exCode: string) => {
    setCode(exCode);
    setShowExamples(false);
  }, []);

  // ── Resumen de teoría (sidebar info) ──
  const theoryInfo = useMemo(() => {
    if (!theorySummary) return null;
    return (
      <div className="text-xs text-slate-500 px-3 py-1 border-t border-slate-700 flex gap-3 flex-wrap">
        {theorySummary.profile && (
          <span>
            Perfil: <span className="text-slate-400">{theorySummary.profile}</span>
          </span>
        )}
        {theorySummary.axioms.length > 0 && (
          <span>
            Axiomas: <span className="text-emerald-400">{theorySummary.axioms.length}</span>
          </span>
        )}
        {theorySummary.theorems.length > 0 && (
          <span>
            Teoremas: <span className="text-blue-400">{theorySummary.theorems.length}</span>
          </span>
        )}
        {theorySummary.claims.length > 0 && (
          <span>
            Claims: <span className="text-purple-400">{theorySummary.claims.length}</span>
          </span>
        )}
      </div>
    );
  }, [theorySummary]);

  return (
    <div
      className={`flex flex-col bg-slate-950 text-slate-200 border border-slate-800 rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        {/* Mode toggle */}
        <div className="flex bg-slate-800 rounded-md p-0.5">
          <button
            onClick={() => setMode('script')}
            className={`px-3 py-1 text-xs rounded ${
              mode === 'script'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1" />
            Script
          </button>
          <button
            onClick={() => setMode('repl')}
            className={`px-3 py-1 text-xs rounded ${
              mode === 'repl'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 inline mr-1" />
            REPL
          </button>
        </div>

        <div className="flex-1" />

        {/* Examples dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            Ejemplos
            <ChevronDown className="w-3 h-3" />
          </button>
          {showExamples && (
            <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 w-52">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => loadExample(ex.code)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white first:rounded-t-lg last:rounded-b-lg"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {mode === 'script' && (
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md transition-colors"
            title="Ejecutar (Ctrl+Enter)"
          >
            <Play className="w-3.5 h-3.5" />
            Ejecutar
          </button>
        )}

        <button
          onClick={() => { reset(); clearHistory(); }}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          title="Reiniciar"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={clearHistory}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          title="Limpiar salida"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {mode === 'script' ? (
          /* Script mode: editor arriba, output abajo */
          <>
            <div className="flex-shrink-0 border-b border-slate-800" style={{ height: '45%', minHeight: 120 }}>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={handleCodeKeyDown}
                className="w-full h-full p-3 bg-slate-950 text-slate-200 font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
                placeholder="// Escribe tu script ST aquí..."
              />
            </div>
            <HistoryPanel entries={history} />
          </>
        ) : (
          /* REPL mode: output arriba, input abajo */
          <>
            <HistoryPanel entries={history} />
            {theoryInfo}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-t border-slate-800 flex-shrink-0">
              <span className="text-emerald-400 font-mono text-sm">st&gt;</span>
              <input
                ref={replInputRef}
                value={replInput}
                onChange={e => setReplInput(e.target.value)}
                onKeyDown={handleReplKeyDown}
                className="flex-1 bg-transparent text-slate-200 font-mono text-sm focus:outline-none"
                placeholder="check valid (P -> P)"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                onClick={handleQuickEval}
                className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-slate-800"
                title="Quick eval (auto classical.propositional)"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                onClick={handleReplSubmit}
                disabled={!replInput.trim()}
                className="p-1 text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 rounded hover:bg-slate-800"
                title="Ejecutar (Enter)"
              >
                <Play className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
