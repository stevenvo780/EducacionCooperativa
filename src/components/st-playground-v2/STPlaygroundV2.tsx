'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Boxes,
  Check,
  ChevronRight,
  GitBranch,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Terminal,
  Zap
} from 'lucide-react';
import {
  evalStInBrowser,
  type StPlaygroundEvalResult
} from '@/lib/st-eval';
import {
  InProcessLSPClient,
  DiagnosticSeverity,
  type LspCompletionItem,
  type LspDiagnostic,
  type LspDocumentSymbol,
  type LspHover
} from '@/lib/st-lsp-client';
import { ST_PLAYGROUND_V2_EXAMPLES, type StV2Example } from './examples';
import ProofTreeView from './ProofTreeView';

const LspEditor = dynamic(() => import('./LspEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
      Cargando editor…
    </div>
  )
});

const DOC_URI = 'inmemory://playground.st';
const DEFAULT_SOURCE =
  ST_PLAYGROUND_V2_EXAMPLES[0]?.source ??
  'logic classical.propositional\ncheck valid (P -> P)\n';

type BottomTab = 'console' | 'proof' | 'countermodel' | 'truthtable';
type SideTab = 'outline' | 'diagnostics' | 'completion';

interface HoverState {
  hover: LspHover;
  x: number;
  y: number;
}

export default function STPlaygroundV2() {
  const lsp = useMemo(() => new InProcessLSPClient(), []);
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [version, setVersion] = useState(1);
  const [diagnostics, setDiagnostics] = useState<LspDiagnostic[]>([]);
  const [symbols, setSymbols] = useState<LspDocumentSymbol[]>([]);
  const [completions, setCompletions] = useState<LspCompletionItem[]>([]);
  const [completionFilter, setCompletionFilter] = useState('');
  const [hoverInfo, setHoverInfo] = useState<HoverState | null>(null);
  const [result, setResult] = useState<StPlaygroundEvalResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sideTab, setSideTab] = useState<SideTab>('diagnostics');
  const [bottomTab, setBottomTab] = useState<BottomTab>('console');
  const [hasMounted, setHasMounted] = useState(false);
  const editorRef = useRef<{
    focus: () => void;
    goto: (line: number, character: number) => void;
    triggerCompletion: () => void;
  } | null>(null);

  useEffect(() => {
    setHasMounted(true);
    lsp.didOpen(DOC_URI, DEFAULT_SOURCE, 1);
    void lsp.diagnostics(DOC_URI).then(setDiagnostics);
    void lsp.documentSymbol(DOC_URI).then(setSymbols);
    void lsp.completion(DOC_URI, 0, 0).then(setCompletions);
  }, [lsp]);

  // Debounced reanálisis del documento al cambiar.
  useEffect(() => {
    if (!hasMounted) return;
    const handle = window.setTimeout(() => {
      lsp.didChange(DOC_URI, source, version);
      void lsp.diagnostics(DOC_URI).then(setDiagnostics);
      void lsp.documentSymbol(DOC_URI).then(setSymbols);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [source, version, hasMounted, lsp]);

  const handleSourceChange = useCallback((next: string) => {
    setSource(next);
    setVersion((v) => v + 1);
  }, []);

  const handleRun = useCallback(() => {
    startTransition(() => {
      const next = evalStInBrowser(source, null);
      setResult(next);
      if (next.results.some((r) => r.hasProof)) {
        setBottomTab('proof');
      } else if (next.results.some((r) => r.hasCounterModel)) {
        setBottomTab('countermodel');
      } else if (next.results.some((r) => r.hasTruthTable)) {
        setBottomTab('truthtable');
      } else {
        setBottomTab('console');
      }
    });
  }, [source]);

  const handleReset = useCallback(() => {
    setSource(DEFAULT_SOURCE);
    setVersion((v) => v + 1);
    setResult(null);
    setBottomTab('console');
  }, []);

  const handleLoadExample = useCallback((ex: StV2Example) => {
    setSource(ex.source);
    setVersion((v) => v + 1);
    setResult(null);
    setBottomTab('console');
  }, []);

  const handleHover = useCallback(
    async (line: number, character: number, x: number, y: number) => {
      const info = await lsp.hover(DOC_URI, line, character);
      if (!info) {
        setHoverInfo(null);
        return;
      }
      setHoverInfo({ hover: info, x, y });
    },
    [lsp]
  );

  const handleClearHover = useCallback(() => {
    setHoverInfo(null);
  }, []);

  const handleGotoDefinition = useCallback(
    async (line: number, character: number) => {
      const loc = await lsp.definition(DOC_URI, line, character);
      if (!loc) return;
      editorRef.current?.goto(loc.range.start.line, loc.range.start.character);
    },
    [lsp]
  );

  // Atajos globales: Ctrl+Enter (run), Ctrl+Space (completion), F12 (goto).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.ctrlKey || e.metaKey;
      if (isMeta && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      } else if (isMeta && e.code === 'Space') {
        e.preventDefault();
        setSideTab('completion');
        editorRef.current?.triggerCompletion();
      } else if (e.key === 'F12') {
        e.preventDefault();
        // El editor maneja el goto via lookup en la posición actual del caret.
        editorRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  const errorCount = diagnostics.filter(
    (d) => d.severity === DiagnosticSeverity.Error
  ).length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === DiagnosticSeverity.Warning
  ).length;

  const filteredCompletions = useMemo(() => {
    const q = completionFilter.trim().toLowerCase();
    if (!q) return completions.slice(0, 200);
    return completions
      .filter((c) => c.label.toLowerCase().includes(q))
      .slice(0, 200);
  }, [completions, completionFilter]);

  const proofResult = result?.results.find((r) => r.hasProof) ?? null;
  const counterModelResult =
    result?.results.find((r) => r.hasCounterModel) ?? null;
  const truthTableResult =
    result?.results.find((r) => r.hasTruthTable) ?? null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur supports-[backdrop-filter]:bg-slate-950/50">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-4 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-violet-400" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight">
              ST Playground{' '}
              <span className="rounded bg-violet-600/30 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-violet-200">
                v2
              </span>
            </h1>
            <span className="ml-2 hidden text-xs text-slate-500 sm:inline-flex">
              LSP in-process · completado · hover · diagnósticos
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ExamplesMenu onPick={handleLoadExample} />
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm transition-colors hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              Evaluate
              <kbd className="ml-1 hidden rounded bg-violet-700/60 px-1.5 py-0.5 font-mono text-[10px] md:inline-flex">
                Ctrl·Enter
              </kbd>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 px-2 py-4 sm:px-4">
        <div className="grid min-h-[55vh] gap-3 grid-cols-1 lg:[grid-template-columns:minmax(0,1fr)_320px]">
          <section className="flex min-w-0 min-h-[55vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
              <span>Editor ST</span>
              <span className="font-mono text-[11px] text-slate-500">
                {source.split('\n').length} líneas · {source.length} chars
              </span>
            </div>
            <div
              className="relative flex-1 min-h-[50vh] min-w-0 w-full"
              style={{
                resize: 'vertical',
                overflow: 'auto'
              }}
            >
              {hasMounted ? (
                <LspEditor
                  ref={editorRef}
                  value={source}
                  diagnostics={diagnostics}
                  completions={completions}
                  onChange={handleSourceChange}
                  onHover={handleHover}
                  onClearHover={handleClearHover}
                  onGotoDefinition={handleGotoDefinition}
                />
              ) : (
                <textarea
                  aria-label="Editor ST (fallback)"
                  className="h-full min-h-[50vh] w-full resize-none bg-transparent p-3 font-mono text-sm text-slate-100 focus:outline-none"
                  value={source}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  spellCheck={false}
                />
              )}
              {hoverInfo && (
                <div
                  className="pointer-events-none absolute z-20 max-w-md rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg"
                  style={{ left: hoverInfo.x + 12, top: hoverInfo.y + 12 }}
                >
                  <pre className="whitespace-pre-wrap font-mono text-[12px] leading-snug text-slate-100">
                    {hoverInfo.hover.contents.value}
                  </pre>
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="flex items-center border-b border-slate-800 bg-slate-900/60">
              <SideTabBtn
                active={sideTab === 'diagnostics'}
                onClick={() => setSideTab('diagnostics')}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                badge={
                  errorCount + warningCount > 0
                    ? errorCount + warningCount
                    : undefined
                }
                badgeTone={errorCount > 0 ? 'red' : 'amber'}
              >
                Errores
              </SideTabBtn>
              <SideTabBtn
                active={sideTab === 'outline'}
                onClick={() => setSideTab('outline')}
                icon={<Boxes className="h-3.5 w-3.5" />}
                badge={symbols.length > 0 ? symbols.length : undefined}
              >
                Outline
              </SideTabBtn>
              <SideTabBtn
                active={sideTab === 'completion'}
                onClick={() => setSideTab('completion')}
                icon={<Zap className="h-3.5 w-3.5" />}
              >
                Snippets
              </SideTabBtn>
            </div>
            <div className="flex-1 overflow-auto">
              {sideTab === 'diagnostics' ? (
                <DiagnosticsPanel
                  diagnostics={diagnostics}
                  onJump={(d) => {
                    editorRef.current?.goto(
                      d.range.start.line,
                      d.range.start.character
                    );
                  }}
                />
              ) : sideTab === 'outline' ? (
                <OutlinePanel
                  symbols={symbols}
                  onJump={(s) => {
                    editorRef.current?.goto(
                      s.range.start.line,
                      s.range.start.character
                    );
                  }}
                />
              ) : (
                <CompletionPanel
                  items={filteredCompletions}
                  filter={completionFilter}
                  onFilterChange={setCompletionFilter}
                />
              )}
            </div>
          </aside>
        </div>

        <section className="flex min-h-[28vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/60 px-2 py-1.5 text-xs">
            <BottomTabBtn
              active={bottomTab === 'console'}
              onClick={() => setBottomTab('console')}
              icon={<Terminal className="h-3.5 w-3.5" />}
            >
              Console
            </BottomTabBtn>
            <BottomTabBtn
              active={bottomTab === 'proof'}
              onClick={() => setBottomTab('proof')}
              icon={<GitBranch className="h-3.5 w-3.5" />}
              disabled={!proofResult}
            >
              Proof Tree
            </BottomTabBtn>
            <BottomTabBtn
              active={bottomTab === 'countermodel'}
              onClick={() => setBottomTab('countermodel')}
              icon={<Check className="h-3.5 w-3.5" />}
              disabled={!counterModelResult}
            >
              Counter-model
            </BottomTabBtn>
            <BottomTabBtn
              active={bottomTab === 'truthtable'}
              onClick={() => setBottomTab('truthtable')}
              icon={<Boxes className="h-3.5 w-3.5" />}
              disabled={!truthTableResult}
            >
              Truth-table
            </BottomTabBtn>
            {result && (
              <span className="ml-auto pr-2 font-mono text-[11px] text-slate-500">
                {result.stats.durationMs.toFixed(1)} ms · exit{' '}
                {result.exitCode} · perfil {result.stats.profile ?? '?'}
              </span>
            )}
          </div>
          <div
            className="relative min-h-[24vh] flex-1 overflow-auto"
            style={{ resize: 'vertical' }}
          >
            {!result ? (
              <EmptyConsole />
            ) : bottomTab === 'console' ? (
              <ConsolePanel result={result} />
            ) : bottomTab === 'proof' ? (
              <ProofTreeView result={proofResult} fullResult={result} />
            ) : bottomTab === 'countermodel' ? (
              <CounterModelPanel
                result={counterModelResult}
                fullResult={result}
              />
            ) : (
              <TruthTablePanel
                result={truthTableResult}
                fullResult={result}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/60">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-3 text-[11px] text-slate-500">
          <span>Powered by</span>
          <code className="font-mono text-slate-400">
            @stevenvo780/st-lang
          </code>
          <span>·</span>
          <span>LSP client in-process · evaluación 100% client-side</span>
          <span className="ml-auto">
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl·Space
            </kbd>{' '}
            autocompletar ·{' '}
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
              F12
            </kbd>{' '}
            ir a definición ·{' '}
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl·Enter
            </kbd>{' '}
            evaluar
          </span>
        </div>
      </footer>
    </div>
  );
}

function SideTabBtn({
  active,
  onClick,
  icon,
  children,
  badge,
  badgeTone = 'amber'
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
  badgeTone?: 'red' | 'amber';
}) {
  const tone =
    badgeTone === 'red'
      ? 'bg-red-500/20 text-red-300'
      : 'bg-amber-500/20 text-amber-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium uppercase tracking-wide transition-colors ${
        active
          ? 'bg-slate-800/80 text-slate-100'
          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
      }`}
      aria-pressed={active}
    >
      {icon}
      {children}
      {badge !== undefined && (
        <span
          className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-mono ${tone}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function BottomTabBtn({
  active,
  onClick,
  icon,
  children,
  disabled
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-slate-800 text-slate-100'
          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
      }`}
      aria-pressed={active}
    >
      {icon}
      {children}
    </button>
  );
}

function DiagnosticsPanel({
  diagnostics,
  onJump
}: {
  diagnostics: LspDiagnostic[];
  onJump: (d: LspDiagnostic) => void;
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
        Sin errores ni advertencias.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-800 text-xs">
      {diagnostics.map((d, idx) => {
        const sev =
          d.severity === DiagnosticSeverity.Error
            ? 'text-red-400'
            : d.severity === DiagnosticSeverity.Warning
              ? 'text-amber-300'
              : 'text-sky-300';
        const sevLabel =
          d.severity === DiagnosticSeverity.Error
            ? 'error'
            : d.severity === DiagnosticSeverity.Warning
              ? 'warning'
              : 'info';
        return (
          <li key={`${d.code ?? 'st'}-${idx}`}>
            <button
              type="button"
              onClick={() => onJump(d)}
              className="block w-full px-3 py-2 text-left hover:bg-slate-800/40"
            >
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] uppercase ${sev}`}>
                  {sevLabel}
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {d.range.start.line + 1}:{d.range.start.character + 1}
                </span>
                {d.code && (
                  <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    {d.code}
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-200">
                {d.message}
              </p>
              {d.suggestion && (
                <p className="mt-1 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-300">Sugerencia: </span>
                  {d.suggestion}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OutlinePanel({
  symbols,
  onJump
}: {
  symbols: LspDocumentSymbol[];
  onJump: (s: LspDocumentSymbol) => void;
}) {
  if (symbols.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
        El documento aún no define símbolos.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-800 text-xs">
      {symbols.map((s) => (
        <li key={`${s.name}-${s.range.start.line}`}>
          <button
            type="button"
            onClick={() => onJump(s)}
            className="block w-full px-3 py-2 text-left hover:bg-slate-800/40"
          >
            <div className="flex items-center gap-2">
              <ChevronRight className="h-3 w-3 text-slate-500" aria-hidden />
              <span className="truncate font-mono text-slate-100">
                {s.name}
              </span>
              <span className="ml-auto font-mono text-[10px] text-slate-500">
                L{s.range.start.line + 1}
              </span>
            </div>
            {s.detail && (
              <p className="ml-5 truncate text-[11px] text-slate-400">
                {s.detail}
              </p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function CompletionPanel({
  items,
  filter,
  onFilterChange
}: {
  items: LspCompletionItem[];
  filter: string;
  onFilterChange: (next: string) => void;
}) {
  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/40 px-2 py-1.5">
        <Search className="h-3 w-3 text-slate-500" aria-hidden />
        <input
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filtrar snippets / keywords…"
          className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
          Sin coincidencias.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-slate-800 overflow-auto">
          {items.map((c) => (
            <li
              key={`${c.label}-${c.detail ?? ''}`}
              className="px-3 py-1.5 hover:bg-slate-800/40"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-100">{c.label}</span>
                {c.detail && (
                  <span className="truncate text-[10px] text-slate-500">
                    {c.detail}
                  </span>
                )}
              </div>
              {c.documentation && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                  {c.documentation}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyConsole() {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
      Pulsa Evaluate (Ctrl+Enter) para ejecutar el código.
    </div>
  );
}

function ConsolePanel({ result }: { result: StPlaygroundEvalResult }) {
  return (
    <div className="px-3 py-2 font-mono text-[12px] leading-snug">
      {result.stdout && (
        <pre className="whitespace-pre-wrap text-slate-100">{result.stdout}</pre>
      )}
      {result.stderr && (
        <pre className="mt-3 whitespace-pre-wrap text-red-300">
          {result.stderr}
        </pre>
      )}
      {!result.stdout && !result.stderr && (
        <p className="text-slate-500">(sin salida)</p>
      )}
    </div>
  );
}

function CounterModelPanel({
  result,
  fullResult
}: {
  result: StPlaygroundEvalResult['results'][number] | null;
  fullResult: StPlaygroundEvalResult;
}) {
  if (!result) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
        Ningún resultado produjo contramodelo.
      </div>
    );
  }
  return (
    <div className="px-3 py-2 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-slate-400">status:</span>
        <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-amber-300">
          {result.status}
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {fullResult.results.length} resultados totales
        </span>
      </div>
      {result.output && (
        <pre className="whitespace-pre-wrap rounded border border-slate-800 bg-slate-900/60 p-3 font-mono text-[12px] text-slate-100">
          {result.output}
        </pre>
      )}
    </div>
  );
}

function TruthTablePanel({
  result,
  fullResult
}: {
  result: StPlaygroundEvalResult['results'][number] | null;
  fullResult: StPlaygroundEvalResult;
}) {
  if (!result) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
        Ningún resultado tiene truth-table.
      </div>
    );
  }
  return (
    <div className="px-3 py-2 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-slate-400">status:</span>
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-emerald-300">
          {result.status}
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {fullResult.results.length} resultados totales
        </span>
      </div>
      {result.output && (
        <pre className="whitespace-pre-wrap rounded border border-slate-800 bg-slate-900/60 p-3 font-mono text-[12px] text-slate-100">
          {result.output}
        </pre>
      )}
    </div>
  );
}

function ExamplesMenu({ onPick }: { onPick: (ex: StV2Example) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm transition-colors hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Boxes className="h-4 w-4" aria-hidden />
        Ejemplos
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <ul
            role="menu"
            className="absolute right-0 z-[1000] mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl pointer-events-auto"
          >
            {ST_PLAYGROUND_V2_EXAMPLES.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onPick(ex);
                    setOpen(false);
                  }}
                  className="block w-full border-b border-slate-800 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-800"
                >
                  <div className="font-medium text-slate-100">{ex.title}</div>
                  <div className="text-[11px] text-slate-400">
                    {ex.description}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
