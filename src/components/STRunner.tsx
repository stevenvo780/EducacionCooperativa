'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, RotateCcw, Trash2, ChevronDown, Zap, BookOpen, Terminal, AlertTriangle, List, Info } from 'lucide-react';
import { useSTInterpreter, type STHistoryEntry } from '@/hooks/useSTInterpreter';
import type { Diagnostic, STEvalResult, SymbolInfo } from '@stevenvo780/st-lang/api';
import STCodeEditor from '@/components/editor/STCodeEditor';

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

function ProblemsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <Info className="w-4 h-4 mr-2" />
        Sin diagnósticos
      </div>
    );
  }

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <span className="text-red-400">✗</span>;
      case 'warning': return <span className="text-amber-400">⚠</span>;
      case 'hint': return <span className="text-blue-400">ℹ</span>;
      default: return <span className="text-slate-400">·</span>;
    }
  };

  const severityClass = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-red-800/50 bg-red-950/30';
      case 'warning': return 'border-amber-800/50 bg-amber-950/30';
      default: return 'border-blue-800/50 bg-blue-950/30';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 px-3 py-2 rounded border text-xs ${severityClass(d.severity)}`}
        >
          <span className="mt-0.5 flex-shrink-0">{severityIcon(d.severity)}</span>
          <div className="flex-1 min-w-0">
            <span className="text-slate-200">{d.message}</span>
            {d.line && (
              <span className="text-slate-500 ml-2">línea {d.line}{d.column ? `:${d.column}` : ''}</span>
            )}
            {d.code && (
              <span className="text-slate-600 ml-2">[{d.code}]</span>
            )}
            {d.suggestion && (
              <div className="text-cyan-400/80 mt-0.5">💡 {d.suggestion}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SymbolsPanel({ symbolsList }: { symbolsList: SymbolInfo[] }) {
  if (symbolsList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <List className="w-4 h-4 mr-2" />
        Sin símbolos definidos
      </div>
    );
  }

  const kindBadge = (kind: string) => {
    const colors: Record<string, string> = {
      axiom: 'bg-emerald-500/20 text-emerald-400',
      theorem: 'bg-blue-500/20 text-blue-400',
      claim: 'bg-purple-500/20 text-purple-400',
      passage: 'bg-amber-500/20 text-amber-400',
      variable: 'bg-slate-500/20 text-slate-400',
      formula: 'bg-cyan-500/20 text-cyan-400'
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${colors[kind] || colors.variable}`}>
        {kind}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {symbolsList.map((sym, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-slate-800 bg-slate-900/50 text-xs hover:bg-slate-800/50 transition-colors"
        >
          {kindBadge(sym.kind)}
          <span className="text-slate-200 font-mono">{sym.name}</span>
          {sym.location?.line && (
            <span className="text-slate-600 ml-auto">:{sym.location.line}</span>
          )}
        </div>
      ))}
    </div>
  );
}

type OutputTab = 'output' | 'problems' | 'symbols';

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
  onExecute?: (code: string, result: STEvalResult) => void;
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
  const { run, execLine, quick, reset, history, clearHistory, theorySummary, profiles, isRunning, getSymbols, lastDiagnostics } =
    useSTInterpreter();

  const [mode, setMode] = useState<STRunnerMode>(initialMode);
  const [code, setCode] = useState(initialCode || DEFAULT_SCRIPT);
  const [replInput, setReplInput] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const replInputRef = useRef<HTMLInputElement>(null);
  const [replHistory, setReplHistory] = useState<string[]>([]);
  const [replHistoryIdx, setReplHistoryIdx] = useState(-1);
  const [activeTab, setActiveTab] = useState<OutputTab>('output');
  const [currentSymbols, setCurrentSymbols] = useState<SymbolInfo[]>([]);

  // ── Ejecutar script completo ──
  const handleRun = useCallback(() => {
    const result = run(code);
    setCurrentSymbols(getSymbols(code));
    if (result.diagnostics && result.diagnostics.length > 0) {
      setActiveTab('problems');
    } else {
      setActiveTab('output');
    }
    onExecute?.(code, result);
  }, [code, run, getSymbols, onExecute]);

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
        setCode(`${value.substring(0, start)}  ${value.substring(end)}`);
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
          /* Script mode: editor arriba, output con tabs abajo */
          <>
            <div className="flex-shrink-0 border-b border-slate-800" style={{ height: '45%', minHeight: 120 }}>
              <STCodeEditor
                value={code}
                onChange={setCode}
                onKeyDown={handleCodeKeyDown}
                placeholder="// Escribe tu script ST aquí..."
                className="bg-slate-950"
              />
            </div>
            {/* Output tabs */}
            <div className="flex items-center gap-0 bg-slate-900 border-b border-slate-800 flex-shrink-0 px-1">
              <button
                onClick={() => setActiveTab('output')}
                className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                  activeTab === 'output'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Terminal className="w-3 h-3 inline mr-1" />
                Salida
              </button>
              <button
                onClick={() => setActiveTab('problems')}
                className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                  activeTab === 'problems'
                    ? 'border-amber-500 text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Problemas
                {lastDiagnostics.length > 0 && (
                  <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                    lastDiagnostics.some(d => d.severity === 'error')
                      ? 'bg-red-500/30 text-red-400'
                      : 'bg-amber-500/30 text-amber-400'
                  }`}>
                    {lastDiagnostics.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('symbols')}
                className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                  activeTab === 'symbols'
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <List className="w-3 h-3 inline mr-1" />
                Símbolos
                {currentSymbols.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-400">
                    {currentSymbols.length}
                  </span>
                )}
              </button>
            </div>
            {activeTab === 'output' && <HistoryPanel entries={history} />}
            {activeTab === 'problems' && <ProblemsPanel diagnostics={lastDiagnostics} />}
            {activeTab === 'symbols' && <SymbolsPanel symbolsList={currentSymbols} />}
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
