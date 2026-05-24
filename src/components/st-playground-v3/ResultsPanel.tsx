'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, FileText, Lightbulb, Activity } from 'lucide-react';
import type { StPlaygroundEvalResult } from '@/lib/st-eval';
import type { Suggestion } from './types';

type Tab = 'validation' | 'derivation' | 'suggestions';

interface ResultsPanelProps {
  result: StPlaygroundEvalResult | null;
  suggestions: Suggestion[];
}

export default function ResultsPanel({ result, suggestions }: ResultsPanelProps) {
  const [tab, setTab] = useState<Tab>('validation');

  const errorCount = result?.diagnostics.filter((d) => d.severity === 'error').length ?? 0;
  const warnCount = result?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-surface-700/80 bg-surface-800/60 backdrop-blur">
      <header className="border-b border-surface-700/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-surface-50">Resultados</h2>
      </header>

      <nav className="flex border-b border-surface-700/80 text-xs" role="tablist">
        {(
          [
            { id: 'validation', label: 'Validación', icon: Activity },
            { id: 'derivation', label: 'Derivación', icon: FileText },
            { id: 'suggestions', label: 'Sugerencias', icon: Lightbulb }
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 transition ${
              tab === id
                ? 'border-b-2 border-mandy-500 text-surface-50'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 text-xs">
        {tab === 'validation' && (
          <ValidationView
            result={result}
            errorCount={errorCount}
            warnCount={warnCount}
          />
        )}
        {tab === 'derivation' && <DerivationView result={result} />}
        {tab === 'suggestions' && <SuggestionsView suggestions={suggestions} />}
      </div>
    </section>
  );
}

function ValidationView({
  result,
  errorCount,
  warnCount
}: {
  result: StPlaygroundEvalResult | null;
  errorCount: number;
  warnCount: number;
}) {
  if (!result) {
    return (
      <p className="text-surface-400">
        Aún no has validado. Pulsa <strong className="text-surface-200">Validar</strong> para evaluar la fórmula.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {result.ok && errorCount === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> OK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-1 text-red-300">
            <XCircle className="h-3.5 w-3.5" /> Falla
          </span>
        )}
        <span className="text-surface-400">
          {errorCount} errores · {warnCount} warnings · {result.stats.durationMs.toFixed(1)}ms
        </span>
      </div>

      {result.diagnostics.length > 0 && (
        <ul className="space-y-1.5">
          {result.diagnostics.map((d, i) => (
            <li
              key={i}
              className={`rounded-md border px-2 py-1.5 ${
                d.severity === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : d.severity === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-surface-600 bg-surface-700/40 text-surface-200'
              }`}
            >
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">{d.message}</div>
                  {(d.line !== undefined || d.code) && (
                    <div className="mt-0.5 text-[10px] opacity-70">
                      {d.code ? `[${d.code}] ` : ''}
                      {d.line !== undefined ? `línea ${d.line}` : ''}
                      {d.column !== undefined ? `:${d.column}` : ''}
                    </div>
                  )}
                  {d.suggestion && (
                    <div className="mt-1 text-[10px] italic opacity-80">
                      Sugerencia: {d.suggestion}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result.stdout && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-surface-400">stdout</div>
          <pre className="rounded-md border border-surface-600 bg-surface-900/80 p-2 font-mono text-[11px] text-surface-100 whitespace-pre-wrap break-words">
            {result.stdout}
          </pre>
        </div>
      )}
    </div>
  );
}

function DerivationView({ result }: { result: StPlaygroundEvalResult | null }) {
  if (!result || result.results.length === 0) {
    return (
      <p className="text-surface-400">
        No hay derivaciones disponibles. Usa <code className="text-mandy-300">derive</code> o <code className="text-mandy-300">check valid</code> para generar una.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {result.results.map((r, i) => (
        <li
          key={i}
          className="rounded-md border border-surface-600 bg-surface-900/60 p-2"
        >
          <div className="text-[10px] uppercase tracking-wider text-surface-400">
            {r.reasoningType ?? 'result'}
            {r.reasoningSchema ? ` · ${r.reasoningSchema}` : ''}
          </div>
          <div className="mt-1 font-medium text-surface-50">{r.status}</div>
          {r.formulaClassification && (
            <div className="mt-0.5 text-[10px] text-surface-400">
              {r.formulaClassification}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
            {r.hasProof && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                proof
              </span>
            )}
            {r.hasCounterModel && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                counter-model
              </span>
            )}
            {r.hasTruthTable && (
              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-300">
                truth-table
              </span>
            )}
          </div>
          {r.output && (
            <pre className="mt-1 font-mono text-[11px] text-surface-200 whitespace-pre-wrap break-words">
              {r.output}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}

function SuggestionsView({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="text-surface-400">
        Las sugerencias aparecerán aquí cuando la IA proponga variantes o el validador detecte mejoras.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {suggestions.map((s) => (
        <li
          key={s.id}
          className="rounded-md border border-accent-purple/40 bg-accent-purple/10 p-2"
        >
          <div className="text-[10px] uppercase tracking-wider text-accent-purple-light">
            {s.kind}
          </div>
          <div className="mt-0.5 text-surface-100">{s.label}</div>
          {s.formula && (
            <pre className="mt-1 font-mono text-[11px] text-surface-200 whitespace-pre-wrap break-words">
              {s.formula}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
