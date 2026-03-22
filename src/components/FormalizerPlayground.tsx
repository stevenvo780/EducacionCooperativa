'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Zap, Play, Check, X, Copy, BarChart2 } from 'lucide-react';
import { formalize, type LogicProfile } from '@stevenvo780/autologic';
import { evaluate, type STEvalResult } from '@stevenvo780/st-lang/api';
import { OutputViewer, ViewModeToggle, type OutputViewMode } from '@/components/editor/STOutputViewer';
import SnippetGallery from '@/components/SnippetGallery';
import type { Snippet } from '@/services/snippetApi';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

/* ── Tipos ──────────────────────────────────────────────────── */

interface FormalizeResult {
  id: string;
  input: string;
  profile: LogicProfile;
  ok: boolean;
  stCode: string;
  patterns: string[];
  atomCount: number;
  formulaCount: number;
  elapsed: number;
  timestamp: number;
  evalResult?: STEvalResult;
}

/* ── Perfiles disponibles ───────────────────────────────────── */

const PROFILES: { value: LogicProfile; label: string; short: string }[] = [
  { value: 'classical.propositional', label: 'Proposicional clásica', short: 'PROP' },
  { value: 'classical.first_order', label: 'Primer orden clásica', short: 'FOL' },
  { value: 'intuitionistic.propositional', label: 'Intuicionista', short: 'INT' },
  { value: 'modal.k', label: 'Modal K', short: 'MOD' },
  { value: 'epistemic.s5', label: 'Epistémica S5', short: 'EPI' },
  { value: 'deontic.standard', label: 'Deóntica', short: 'DEO' },
  { value: 'temporal.ltl', label: 'Temporal LTL', short: 'TMP' },
  { value: 'paraconsistent.belnap', label: 'Paraconsistente (Belnap)', short: 'PAR' },
  { value: 'aristotelian.syllogistic', label: 'Silogística aristotélica', short: 'SYL' },
  { value: 'arithmetic', label: 'Aritmética', short: 'ARI' },
  { value: 'probabilistic.basic', label: 'Probabilística', short: 'PRO' }
];

const PROFILE_PREFIXES: Array<{ prefix: string; profile: LogicProfile }> = [
  { prefix: 'PROP ·', profile: 'classical.propositional' },
  { prefix: 'FOL ·', profile: 'classical.first_order' },
  { prefix: 'SYL ·', profile: 'aristotelian.syllogistic' },
  { prefix: 'MOD ·', profile: 'modal.k' },
  { prefix: 'EPI ·', profile: 'epistemic.s5' },
  { prefix: 'DEO ·', profile: 'deontic.standard' },
  { prefix: 'TMP ·', profile: 'temporal.ltl' },
  { prefix: 'INT ·', profile: 'intuitionistic.propositional' },
  { prefix: 'PAR ·', profile: 'paraconsistent.belnap' },
  { prefix: 'ARI ·', profile: 'arithmetic' },
  { prefix: 'PRO ·', profile: 'probabilistic.basic' }
];

function inferProfileFromSnippet(snippet?: Snippet): LogicProfile | null {
  if (!snippet || snippet.category !== 'formalization') return null;
  const match = PROFILE_PREFIXES.find((item) => snippet.title.startsWith(item.prefix));
  return match?.profile ?? null;
}

/* ── Componente principal ───────────────────────────────────── */

export default function FormalizerPlayground({ workspaceId = PERSONAL_WORKSPACE_ID }: { workspaceId?: string }) {
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<LogicProfile>('classical.propositional');
  const [results, setResults] = useState<FormalizeResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState(false);
  const [viewMode, setViewMode] = useState<OutputViewMode>('graphic');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const runFormalize = useCallback((text: string, prof: LogicProfile) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const t0 = performance.now();
    let result: FormalizeResult;
    try {
      const r = formalize(trimmed, {
        profile: prof,
        language: 'es',
        atomStyle: 'keywords',
        includeComments: true
      });
      let evalResult: STEvalResult | undefined;
      if (r.ok && r.stCode.trim()) {
        try {
          evalResult = evaluate(r.stCode);
        } catch { /* ignore eval errors */ }
      }
      result = {
        id: crypto.randomUUID(),
        input: trimmed,
        profile: prof,
        ok: r.ok,
        stCode: r.stCode,
        patterns: r.analysis.detectedPatterns,
        atomCount: r.atoms.size,
        formulaCount: r.formulas.length,
        elapsed: Math.round(performance.now() - t0),
        timestamp: Date.now(),
        evalResult
      };
    } catch (err) {
      result = {
        id: crypto.randomUUID(),
        input: trimmed,
        profile: prof,
        ok: false,
        stCode: `// ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`,
        patterns: [],
        atomCount: 0,
        formulaCount: 0,
        elapsed: Math.round(performance.now() - t0),
        timestamp: Date.now()
      };
    }

    setResults(prev => [result, ...prev]);
    setSelectedResult(result.id);
  }, []);

  const handleFormalize = useCallback(() => {
    runFormalize(input, profile);
  }, [input, profile, runFormalize]);

  // Auto-run con debounce
  useEffect(() => {
    if (!autoRun || !input.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runFormalize(input, profile);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, profile, autoRun, runFormalize]);

  const handleInsertFormalizationSnippet = useCallback((content: string, snippet?: Snippet) => {
    const inferredProfile = inferProfileFromSnippet(snippet);
    setInput(content);
    if (inferredProfile) {
      setProfile(inferredProfile);
    }
    textareaRef.current?.focus();
  }, []);

  const clearHistory = useCallback(() => {
    setResults([]);
    setSelectedResult(null);
  }, []);

  const activeResult = results.find(r => r.id === selectedResult);

  const reRunST = useCallback(() => {
    if (!activeResult || !activeResult.stCode.trim()) return;
    try {
      const evalResult = evaluate(activeResult.stCode);
      setResults(prev => prev.map(r =>
        r.id === activeResult.id ? { ...r, evalResult } : r
      ));
    } catch { /* ignore */ }
  }, [activeResult]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  // Stats globales
  const totalRuns = results.length;
  const successRuns = results.filter(r => r.ok).length;
  const avgTime = totalRuns > 0 ? Math.round(results.reduce((s, r) => s + r.elapsed, 0) / totalRuns) : 0;

  return (
    <div className="h-full overflow-auto bg-[#0a0a0f] text-slate-200">
      {/* ── Header compacto ─────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-medium text-slate-400">Formalizador ST</span>
          <span className="rounded bg-cyan-950/50 px-1.5 py-0.5 text-[9px] font-mono text-cyan-400/70 border border-cyan-900/30">
            v2
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {totalRuns > 0 && <span>{successRuns}/{totalRuns} OK · {avgTime}ms avg</span>}
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} className="accent-cyan-500 h-3 w-3" />
            Auto
          </label>
        </div>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">

          {/* ── Panel izquierdo: Input ──────────────────────── */}
          <div className="space-y-3">
            {/* Textarea */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
                <span className="text-xs font-medium text-slate-400">Texto de entrada</span>
                <span className="text-[10px] text-slate-600 font-mono">{input.length} chars</span>
              </div>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleFormalize();
                  }
                }}
                placeholder="Escribe o pega texto en lenguaje natural aquí...&#10;&#10;Ejemplo: Si llueve entonces la calle se moja. Llueve. Por lo tanto, la calle se moja."
                rows={8}
                className="w-full resize-y bg-transparent px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-700 font-mono leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Controles */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value as LogicProfile)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-500/60"
              >
                {PROFILES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              <button
                onClick={handleFormalize}
                disabled={!input.trim()}
                className="rounded-lg bg-cyan-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Formalizar (Ctrl+Enter)
              </button>

              {results.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-500 transition hover:text-red-400 hover:border-red-800"
                >
                  Limpiar historial
                </button>
              )}
            </div>

            {/* Snippets dinámicos */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <SnippetGallery
                workspaceId={workspaceId}
                allowedCategories={['formalization']}
                hideClose
                title="Snippets de formalización"
                emptyLabel="Todavía no hay snippets de formalización en este workspace."
                onInsert={handleInsertFormalizationSnippet}
              />
            </div>

            {/* Historial */}
            {results.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <div className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Historial ({results.length})
                  </span>
                  <div className="flex gap-2 text-[10px] text-slate-600">
                    <span className="flex items-center gap-0.5 text-green-500">{successRuns} <Check className="w-3 h-3" /></span>
                    {totalRuns - successRuns > 0 && (
                      <span className="flex items-center gap-0.5 text-red-500">{totalRuns - successRuns} <X className="w-3 h-3" /></span>
                    )}
                  </div>
                </div>
                <div className="max-h-[300px] overflow-auto divide-y divide-slate-800/50">
                  {results.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedResult(r.id)}
                      className={`w-full text-left px-4 py-2 transition text-[11px] leading-4 ${
                        r.id === selectedResult
                          ? 'bg-cyan-950/30 border-l-2 border-cyan-500'
                          : 'hover:bg-slate-900/60 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={r.ok ? 'text-green-500' : 'text-red-500'}>
                          {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </span>
                        <span className="text-slate-400 truncate flex-1">
                          {r.input.slice(0, 80)}{r.input.length > 80 ? '…' : ''}
                        </span>
                        <span className="text-slate-600 font-mono shrink-0">
                          {PROFILES.find(p => p.value === r.profile)?.short || '?'} · {r.elapsed}ms
                        </span>
                      </div>
                      {r.patterns.length > 0 && (
                        <div className="mt-0.5 flex gap-1 flex-wrap">
                          {r.patterns.map(p => (
                            <span key={p} className="rounded bg-cyan-950/40 px-1.5 py-0.5 text-[9px] text-cyan-500/70">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Panel derecho: Output ─────────────────────── */}
          <div className="space-y-3">
            {activeResult ? (
              <>
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                    activeResult.ok
                      ? 'bg-green-950/50 text-green-400 border border-green-800/40'
                      : 'bg-red-950/50 text-red-400 border border-red-800/40'
                  }`}>
                    {activeResult.ok
                      ? <><Check className="w-3 h-3 inline mr-1" />Formalizado</>
                      : <><X className="w-3 h-3 inline mr-1" />Error</>}
                  </span>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] text-slate-400 border border-slate-800">
                    {PROFILES.find(p => p.value === activeResult.profile)?.label}
                  </span>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] text-slate-500 border border-slate-800 font-mono">
                    {activeResult.atomCount} átomos · {activeResult.formulaCount} fórmulas · {activeResult.elapsed}ms
                  </span>
                  {activeResult.patterns.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {activeResult.patterns.map(p => (
                        <span key={p} className="rounded-full bg-cyan-950/40 px-2.5 py-1 text-[10px] font-medium text-cyan-400 border border-cyan-900/40">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Código ST */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
                    <span className="text-xs font-medium text-slate-400">Salida ST</span>
                    <button
                      onClick={() => copyToClipboard(activeResult.stCode)}
                      className="text-[10px] text-slate-600 hover:text-cyan-400 transition"
                    >
                      <Copy className="w-3 h-3 inline mr-1" />Copiar
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[500px] whitespace-pre-wrap">
                    <STHighlight code={activeResult.stCode} />
                  </pre>
                </div>

                {/* ── Ejecución ST ─────────────────────── */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">Ejecución ST</span>
                      {activeResult.evalResult && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          activeResult.evalResult.ok
                            ? 'bg-green-950/50 text-green-400 border border-green-900/40'
                            : 'bg-red-950/50 text-red-400 border border-red-900/40'
                        }`}>
                          {activeResult.evalResult.ok
                            ? <><Check className="w-3 h-3 inline mr-1" />OK</>
                            : <><X className="w-3 h-3 inline mr-1" />Error</>}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {activeResult.evalResult && (
                        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
                      )}
                      <button
                        onClick={reRunST}
                        disabled={!activeResult.stCode.trim()}
                        className="rounded bg-emerald-700 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Play className="w-3 h-3 inline mr-1" />Ejecutar
                      </button>
                    </div>
                  </div>
                  {activeResult.evalResult ? (
                    <div className="max-h-[400px] overflow-auto">
                      <OutputViewer result={activeResult.evalResult} mode={viewMode} />
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-xs text-slate-600">
                      {activeResult.ok
                        ? 'Presiona Ejecutar para correr el código ST'
                        : 'La formalización contiene errores — no se puede ejecutar'}
                    </div>
                  )}
                </div>

                {/* Input original */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <span className="text-[10px] font-medium text-slate-500 block mb-1">Texto original</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{activeResult.input}</p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 flex items-center justify-center h-[400px]">
                <div className="text-center space-y-3">
                  <Zap className="w-12 h-12 opacity-20 text-cyan-400" />
                  <p className="text-sm text-slate-600">
                    Escribe texto y presiona <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono">Ctrl+Enter</kbd> para formalizar
                  </p>
                  <p className="text-xs text-slate-700">
                    O inserta un snippet dinámico de formalización desde la biblioteca
                  </p>
                </div>
              </div>
            )}

            {/* Tabla batch cuando hay múltiples resultados */}
            {results.length > 3 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <details>
                  <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-400 select-none border-b border-slate-800 hover:text-slate-300">
                    <BarChart2 className="w-3.5 h-3.5 inline mr-1" />Resumen de resultados ({results.length} ejecuciones)
                  </summary>
                  <div className="overflow-auto max-h-[300px]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-900/60 sticky top-0">
                        <tr className="text-left text-slate-500">
                          <th className="px-3 py-2 font-medium">Estado</th>
                          <th className="px-3 py-2 font-medium">Texto</th>
                          <th className="px-3 py-2 font-medium">Perfil</th>
                          <th className="px-3 py-2 font-medium">Patrones</th>
                          <th className="px-3 py-2 font-medium text-right">Átomos</th>
                          <th className="px-3 py-2 font-medium text-right">Fórmulas</th>
                          <th className="px-3 py-2 font-medium text-right">ms</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {results.map(r => (
                          <tr
                            key={r.id}
                            onClick={() => setSelectedResult(r.id)}
                            className={`cursor-pointer transition ${
                              r.id === selectedResult ? 'bg-cyan-950/20' : 'hover:bg-slate-900/40'
                            }`}
                          >
                            <td className="px-3 py-1.5">
                              <span className={r.ok ? 'text-green-500' : 'text-red-500'}>
                                {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-slate-400 max-w-[200px] truncate">
                              {r.input.slice(0, 60)}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500 font-mono">
                              {PROFILES.find(p => p.value === r.profile)?.short}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex gap-1 flex-wrap">
                                {r.patterns.map(p => (
                                  <span key={p} className="text-cyan-600 text-[9px]">{p}</span>
                                ))}
                                {r.patterns.length === 0 && <span className="text-slate-700">—</span>}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-500 font-mono">{r.atomCount}</td>
                            <td className="px-3 py-1.5 text-right text-slate-500 font-mono">{r.formulaCount}</td>
                            <td className="px-3 py-1.5 text-right text-slate-600 font-mono">{r.elapsed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Highlight básico para código ST ────────────────────────── */

function STHighlight({ code }: { code: string }) {
  const lines = code.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="select-none text-slate-700 w-8 text-right mr-3 shrink-0">{i + 1}</span>
          <span>{colorize(line)}</span>
        </div>
      ))}
    </>
  );
}

function colorize(line: string): React.ReactNode {
  const trimmed = line.trim();

  // Comentarios
  if (trimmed.startsWith('//')) {
    if (trimmed.startsWith('// ═') || trimmed.startsWith('// ──')) {
      return <span className="text-slate-700">{line}</span>;
    }
    return <span className="text-slate-600 italic">{line}</span>;
  }

  // Logic declaration
  if (trimmed.startsWith('logic ')) {
    return (
      <span>
        <span className="text-purple-400 font-semibold">logic</span>
        <span className="text-purple-300">{line.slice(line.indexOf('logic') + 5)}</span>
      </span>
    );
  }

  // Interpret
  if (trimmed.startsWith('interpret ')) {
    const match = trimmed.match(/^interpret\s+"([^"]+)"\s+as\s+(.+)$/);
    if (match) {
      return (
        <span>
          <span className="text-blue-400">interpret</span>
          <span className="text-slate-500"> &quot;</span>
          <span className="text-emerald-400">{match[1]}</span>
          <span className="text-slate-500">&quot;</span>
          <span className="text-blue-400"> as </span>
          <span className="text-amber-300 font-semibold">{match[2]}</span>
        </span>
      );
    }
  }

  // Axiom
  if (trimmed.startsWith('axiom ')) {
    const match = trimmed.match(/^axiom\s+(\S+)\s*=\s*(.+)$/);
    if (match) {
      return (
        <span>
          <span className="text-red-400 font-semibold">axiom</span>
          <span className="text-amber-300"> {match[1]}</span>
          <span className="text-slate-500"> = </span>
          <span className="text-cyan-300">{highlightFormula(match[2])}</span>
        </span>
      );
    }
    const matchSimple = trimmed.match(/^axiom\s+(\S+)\s*:\s*(.+)$/);
    if (matchSimple) {
      return (
        <span>
          <span className="text-red-400 font-semibold">axiom</span>
          <span className="text-amber-300"> {matchSimple[1]}</span>
          <span className="text-slate-500"> : </span>
          <span className="text-cyan-300">{matchSimple[2]}</span>
        </span>
      );
    }
  }

  // Derive
  if (trimmed.startsWith('derive ')) {
    const match = trimmed.match(/^derive\s+(.+?)\s+from\s+\{(.+)\}$/);
    if (match) {
      return (
        <span>
          <span className="text-green-400 font-semibold">derive</span>
          <span className="text-cyan-300"> {highlightFormula(match[1])}</span>
          <span className="text-green-400"> from</span>
          <span className="text-slate-500"> {'{'}</span>
          <span className="text-amber-300">{match[2]}</span>
          <span className="text-slate-500">{'}'}</span>
        </span>
      );
    }
  }

  // Check
  if (trimmed.startsWith('check ')) {
    return (
      <span>
        <span className="text-yellow-400 font-semibold">check</span>
        <span className="text-yellow-200">{line.slice(line.indexOf('check') + 5)}</span>
      </span>
    );
  }

  return <span className="text-slate-400">{line}</span>;
}

function highlightFormula(formula: string): React.ReactNode {
  // Resaltar operadores lógicos
  const parts = formula.split(/(\->|<->|&|\||\!|\[\]|<>|\(|\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (['->','<->','&','|','!','[]','<>'].includes(part)) {
          return <span key={i} className="text-pink-400 font-bold">{part}</span>;
        }
        if (part === '(' || part === ')') {
          return <span key={i} className="text-slate-500">{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
