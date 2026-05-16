'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  X
} from 'lucide-react';
import {
  evalStInBrowser,
  getAvailableProfiles,
  type StPlaygroundDiagnostic,
  type StPlaygroundEvalResult
} from '@/lib/st-eval';
import { ST_PLAYGROUND_EXAMPLES, type StPlaygroundExample } from './examples';

const CodeArea = dynamic(() => import('./CodeArea'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
      Cargando editor…
    </div>
  )
});

type Tab = 'result' | 'errors' | 'stats';

const DEFAULT_SOURCE = ST_PLAYGROUND_EXAMPLES[0]?.source ?? 'logic classical.propositional\ncheck valid (P -> P)\n';
const DEFAULT_PROFILE = ST_PLAYGROUND_EXAMPLES[0]?.profile ?? 'classical.propositional';

function severityColor(severity: StPlaygroundDiagnostic['severity']): string {
  switch (severity) {
    case 'error':
      return 'text-red-400 border-red-500/40 bg-red-500/5';
    case 'warning':
      return 'text-amber-300 border-amber-500/40 bg-amber-500/5';
    case 'info':
      return 'text-sky-300 border-sky-500/40 bg-sky-500/5';
    default:
      return 'text-slate-300 border-slate-600/50 bg-slate-700/20';
  }
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    valid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    invalid: 'bg-red-500/15 text-red-300 border-red-500/40',
    satisfiable: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    unsatisfiable: 'bg-red-500/15 text-red-300 border-red-500/40',
    provable: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    refutable: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    unknown: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
    error: 'bg-red-500/15 text-red-300 border-red-500/40'
  };
  const cls = map[status] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${cls}`}>
      {status}
    </span>
  );
}

export default function Playground() {
  const profiles = useMemo(() => getAvailableProfiles(), []);
  const [source, setSource] = useState<string>(DEFAULT_SOURCE);
  const [profile, setProfile] = useState<string>(DEFAULT_PROFILE);
  const [autoProfile, setAutoProfile] = useState<boolean>(true);
  const [result, setResult] = useState<StPlaygroundEvalResult | null>(null);
  const [tab, setTab] = useState<Tab>('result');
  const [isPending, startTransition] = useTransition();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleRun = useCallback(() => {
    const profileToUse = autoProfile ? null : profile;
    startTransition(() => {
      const next = evalStInBrowser(source, profileToUse);
      setResult(next);
      if (next.diagnostics.some(d => d.severity === 'error')) {
        setTab('errors');
      } else {
        setTab('result');
      }
    });
  }, [source, profile, autoProfile]);

  const handleReset = useCallback(() => {
    setSource(DEFAULT_SOURCE);
    setProfile(DEFAULT_PROFILE);
    setAutoProfile(true);
    setResult(null);
    setTab('result');
  }, []);

  const handleLoadExample = useCallback((ex: StPlaygroundExample) => {
    setSource(ex.source);
    setProfile(ex.profile);
    setAutoProfile(true);
    setResult(null);
    setTab('result');
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isRun = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
      if (isRun) {
        e.preventDefault();
        handleRun();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  const errorCount = result?.diagnostics.filter(d => d.severity === 'error').length ?? 0;
  const warningCount = result?.diagnostics.filter(d => d.severity === 'warning').length ?? 0;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur supports-[backdrop-filter]:bg-slate-950/50">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <Terminal className="w-5 h-5 text-violet-400" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight">ST Playground</h1>
            <span className="hidden sm:inline-flex text-xs text-slate-500 ml-2">
              Lógica formal en el navegador
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400" htmlFor="profile-select">
              Perfil
            </label>
            <select
              id="profile-select"
              value={profile}
              disabled={autoProfile}
              onChange={(e) => setProfile(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {profiles.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-violet-500"
                checked={autoProfile}
                onChange={(e) => setAutoProfile(e.target.checked)}
              />
              auto (del código)
            </label>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <ExamplesMenu onPick={handleLoadExample} />
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-wait transition-colors"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <Play className="w-4 h-4" aria-hidden />
              )}
              Evaluate
              <kbd className="hidden md:inline-flex ml-1 px-1.5 py-0.5 rounded bg-violet-700/60 text-[10px] font-mono">
                Ctrl·Enter
              </kbd>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden flex flex-col min-h-[60vh]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
            <span>Editor ST</span>
            <span className="font-mono text-[11px] text-slate-500">
              {source.split('\n').length} líneas · {source.length} chars
            </span>
          </div>
          <div className="flex-1 min-h-[55vh]">
            {hasMounted ? (
              <CodeArea value={source} onChange={setSource} ariaLabel="Editor de código ST" />
            ) : (
              <textarea
                aria-label="Editor de código ST (fallback)"
                className="w-full h-full min-h-[55vh] bg-transparent p-3 font-mono text-sm text-slate-100 focus:outline-none resize-none"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden flex flex-col min-h-[60vh]">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-800 bg-slate-900/60 text-xs">
            <TabButton active={tab === 'result'} onClick={() => setTab('result')} icon={<Check className="w-3.5 h-3.5" />}>
              Result
            </TabButton>
            <TabButton
              active={tab === 'errors'}
              onClick={() => setTab('errors')}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              badge={errorCount + warningCount > 0 ? errorCount + warningCount : undefined}
              badgeTone={errorCount > 0 ? 'red' : 'amber'}
            >
              Errors
            </TabButton>
            <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={<ListChecks className="w-3.5 h-3.5" />}>
              Stats
            </TabButton>
            {result && (
              <span className="ml-auto text-[11px] text-slate-500 font-mono pr-1">
                {result.stats.durationMs.toFixed(1)} ms · exit {result.exitCode}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!result ? (
              <EmptyState />
            ) : tab === 'result' ? (
              <ResultPanel result={result} />
            ) : tab === 'errors' ? (
              <ErrorsPanel diagnostics={result.diagnostics} />
            ) : (
              <StatsPanel result={result} />
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/60 mt-4">
        <div className="mx-auto max-w-7xl px-4 py-3 text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
          <span>Powered by</span>
          <code className="font-mono text-slate-400">@stevenvo780/st-lang</code>
          <span>·</span>
          <span>Evaluación 100% client-side.</span>
        </div>
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
  badge,
  badgeTone
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-800 text-slate-100'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
      }`}
      aria-pressed={active}
    >
      {icon}
      {children}
      {typeof badge === 'number' && badge > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${tone}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function ExamplesMenu({ onPick }: { onPick: (ex: StPlaygroundExample) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-examples-menu]')) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  return (
    <div className="relative" data-examples-menu>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BookOpen className="w-4 h-4" aria-hidden />
        Examples
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-80 rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-20 overflow-hidden"
        >
          {ST_PLAYGROUND_EXAMPLES.map(ex => (
            <button
              key={ex.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(ex);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-100">{ex.title}</span>
                <span className="text-[10px] font-mono text-violet-300">{ex.profile}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{ex.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full min-h-[40vh] flex flex-col items-center justify-center text-slate-500 text-sm gap-2 p-6 text-center">
      <Play className="w-6 h-6 text-slate-600" aria-hidden />
      <p>Aprieta <span className="text-slate-300 font-medium">Evaluate</span> (o <kbd className="font-mono">Ctrl·Enter</kbd>) para correr tu código ST.</p>
      <p>Todo se ejecuta en tu navegador. Nada va al servidor.</p>
    </div>
  );
}

function ResultPanel({ result }: { result: StPlaygroundEvalResult }) {
  if (result.threwError) {
    return (
      <div className="p-4 space-y-3">
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <div className="flex items-center gap-2 text-red-300 font-medium">
            <X className="w-4 h-4" aria-hidden />
            La evaluación lanzó una excepción.
          </div>
          <pre className="mt-2 text-xs text-red-200/80 whitespace-pre-wrap">{result.stderr}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
            result.ok && result.exitCode === 0
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-red-500/15 text-red-300 border-red-500/40'
          }`}
        >
          {result.ok && result.exitCode === 0 ? (
            <>
              <Check className="w-3 h-3" aria-hidden /> OK
            </>
          ) : (
            <>
              <X className="w-3 h-3" aria-hidden /> Error
            </>
          )}
        </span>
        <span className="text-xs text-slate-500">
          {result.results.length} resultado(s) · {result.stats.durationMs.toFixed(1)} ms
        </span>
      </div>

      {result.results.length > 0 && (
        <div className="space-y-2">
          {result.results.map((r, idx) => (
            <div key={idx} className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-900/70 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                  <StatusPill status={r.status} />
                  {r.reasoningType && (
                    <span className="text-[10px] text-slate-500 font-mono">{r.reasoningType}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  {r.hasProof && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">proof</span>}
                  {r.hasCounterModel && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">model</span>}
                  {r.hasTruthTable && <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300">table</span>}
                </div>
              </div>
              {r.output && (
                <pre className="p-3 text-xs text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                  {r.output}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {result.stdout && (
        <details className="rounded-lg border border-slate-800 bg-slate-900/30" open>
          <summary className="px-3 py-2 cursor-pointer text-xs uppercase tracking-wide text-slate-400 select-none">
            stdout
          </summary>
          <pre className="px-3 pb-3 text-xs text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
            {result.stdout}
          </pre>
        </details>
      )}

      {result.stderr && (
        <details className="rounded-lg border border-red-500/30 bg-red-500/5">
          <summary className="px-3 py-2 cursor-pointer text-xs uppercase tracking-wide text-red-300 select-none">
            stderr
          </summary>
          <pre className="px-3 pb-3 text-xs text-red-200/90 whitespace-pre-wrap font-mono leading-relaxed">
            {result.stderr}
          </pre>
        </details>
      )}
    </div>
  );
}

function ErrorsPanel({ diagnostics }: { diagnostics: StPlaygroundDiagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <div className="h-full min-h-[40vh] flex items-center justify-center text-slate-500 text-sm">
        Sin diagnósticos. El type-check pasó limpio.
      </div>
    );
  }
  return (
    <ul className="p-3 space-y-2 text-sm">
      {diagnostics.map((d, idx) => (
        <li
          key={idx}
          className={`rounded-lg border p-3 ${severityColor(d.severity)}`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold">
            <span>{d.severity}</span>
            {(typeof d.line === 'number') && (
              <span className="font-mono normal-case text-slate-400">
                @ línea {d.line}
                {typeof d.column === 'number' ? `, col ${d.column}` : ''}
              </span>
            )}
            {d.code && (
              <span className="ml-auto font-mono normal-case text-slate-500">{d.code}</span>
            )}
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{d.message}</p>
          {d.suggestion && (
            <p className="mt-1 text-xs text-slate-400 italic">
              sugerencia: {d.suggestion}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatsPanel({ result }: { result: StPlaygroundEvalResult }) {
  const rows: Array<[string, string | number]> = [
    ['Perfil', result.stats.profile ?? '—'],
    ['Resultados', result.stats.results],
    ['Premisas (axiom/premise/hypothesis)', result.stats.premises],
    ['Cláusulas (líneas no-comentario)', result.stats.clauses],
    ['Diagnósticos totales', result.stats.diagnostics],
    ['Errores', result.stats.errors],
    ['Warnings', result.stats.warnings],
    ['Duración', `${result.stats.durationMs.toFixed(2)} ms`],
    ['Exit code', result.exitCode]
  ];
  return (
    <div className="p-4">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2"
          >
            <dt className="text-xs text-slate-400">{k}</dt>
            <dd className="text-sm font-mono text-slate-100">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
