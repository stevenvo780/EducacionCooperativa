'use client';

import { useMemo, useState, useCallback } from 'react';
import type { ObligationStatus, ProofObligation } from './types';
import { exampleObligations } from './examples';

interface Props {
  obligations?: ProofObligation[];
}

type Filter = 'all' | ObligationStatus;

const STATUS_LABEL: Record<ObligationStatus, string> = {
  verified: 'Verified',
  pending: 'Pending',
  failed: 'Failed',
  unknown: 'Unknown'
};

const STATUS_BADGE: Record<ObligationStatus, string> = {
  verified: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  pending: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  failed: 'bg-mandy-600/25 text-mandy-200 border-mandy-500/40',
  unknown: 'bg-surface-600/40 text-surface-200 border-surface-500/40'
};

const STATUS_DOT: Record<ObligationStatus, string> = {
  verified: 'bg-emerald-400',
  pending: 'bg-amber-300',
  failed: 'bg-mandy-400',
  unknown: 'bg-surface-300'
};

export default function CardsView({ obligations }: Props) {
  const data = useMemo(() => obligations ?? exampleObligations, [obligations]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((ob) => {
      if (filter !== 'all' && ob.status !== filter) return false;
      if (!q) return true;
      return (
        ob.id.toLowerCase().includes(q) ||
        ob.title.toLowerCase().includes(q) ||
        ob.formula.toLowerCase().includes(q) ||
        ob.profile.toLowerCase().includes(q)
      );
    });
  }, [data, filter, query]);

  const byId = useMemo(() => {
    const map = new Map<string, ProofObligation>();
    for (const ob of data) map.set(ob.id, ob);
    return map;
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: data.length, verified: 0, pending: 0, failed: 0, unknown: 0 };
    for (const ob of data) c[ob.status] += 1;
    return c;
  }, [data]);

  const onSelectDep = useCallback((depId: string) => {
    if (byId.has(depId)) setSelectedId(depId);
  }, [byId]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  return (
    <div className="min-h-screen bg-surface-925 text-surface-100 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Proof obligations
          </h1>
          <p className="mt-2 text-sm text-surface-300">
            Estado individual de cada claim/teorema del documento. Click en una card para ver
            la prueba paso a paso o el contraejemplo.
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['all', 'verified', 'pending', 'failed', 'unknown'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  filter === f
                    ? 'border-mandy-500/60 bg-mandy-600/20 text-mandy-100'
                    : 'border-surface-600 bg-surface-800 text-surface-200 hover:bg-surface-700'
                }`}
              >
                {f === 'all' ? 'All' : STATUS_LABEL[f]} ({counts[f]})
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="sr-only">Buscar</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por id, título, fórmula o perfil…"
              className="w-full rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder:text-surface-400 focus:border-mandy-500 focus:outline-none focus:ring-1 focus:ring-mandy-500 sm:w-80"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-md border border-surface-700 bg-surface-800 p-8 text-center text-sm text-surface-300">
            No hay obligations que coincidan con el filtro.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ob) => (
              <li key={ob.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(ob.id)}
                  className="group relative flex h-full w-full flex-col rounded-lg border border-surface-700 bg-gradient-surface p-4 text-left shadow-sm transition hover:border-mandy-500/50 hover:shadow-lg focus:border-mandy-500 focus:outline-none focus:ring-2 focus:ring-mandy-500/40"
                  aria-label={`Abrir detalle de ${ob.title}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs uppercase tracking-wide text-surface-400">
                        {ob.id} · {ob.profile}
                      </div>
                      <h2 className="mt-0.5 truncate text-base font-semibold text-white">
                        {ob.title}
                      </h2>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_BADGE[ob.status]}`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[ob.status]}`} />
                      {STATUS_LABEL[ob.status]}
                    </span>
                  </div>

                  <pre className="mt-1 overflow-x-auto rounded bg-surface-900/70 px-3 py-2 font-mono text-sm text-surface-100">
                    {ob.formula}
                  </pre>

                  {ob.dependencies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-surface-400">
                        deps:
                      </span>
                      {ob.dependencies.map((dep) => (
                        <span
                          key={dep}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDep(dep);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onSelectDep(dep);
                            }
                          }}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-mono transition ${
                            byId.has(dep)
                              ? 'cursor-pointer border-accent-purple/60 bg-accent-purple/20 text-accent-purple-light hover:bg-accent-purple/35'
                              : 'border-surface-600 bg-surface-800 text-surface-400'
                          }`}
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pointer-events-none invisible absolute inset-x-3 bottom-3 z-10 translate-y-1 rounded-md border border-surface-600 bg-surface-900/95 p-3 text-xs text-surface-200 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    {renderHoverPreview(ob)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <DetailDialog
            obligation={selected}
            onClose={() => setSelectedId(null)}
            onJumpDep={onSelectDep}
            knownIds={byId}
          />
        )}
      </div>
    </div>
  );
}

function renderHoverPreview(ob: ProofObligation) {
  if (ob.status === 'verified' && ob.proof) {
    const head = ob.proof.steps.slice(0, 2);
    const rest = ob.proof.steps.length - head.length;
    return (
      <div>
        <div className="mb-1 font-semibold text-emerald-300">Prueba (preview)</div>
        <ol className="list-decimal space-y-0.5 pl-4">
          {head.map((s, i) => (
            <li key={i}>
              <span className="font-mono">{s.formula}</span>{' '}
              <span className="text-surface-400">— {s.justification}</span>
            </li>
          ))}
        </ol>
        {rest > 0 && <div className="mt-1 text-surface-400">+ {rest} pasos más…</div>}
      </div>
    );
  }
  if (ob.status === 'failed' && ob.countermodel) {
    return (
      <div>
        <div className="mb-1 font-semibold text-mandy-300">Contraejemplo</div>
        <ul className="space-y-0.5 font-mono">
          {Object.entries(ob.countermodel).slice(0, 3).map(([k, v]) => (
            <li key={k}>
              <span className="text-surface-300">{k}</span>{' '}
              <span className="text-mandy-200">= {String(v)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (ob.status === 'pending') {
    return <div className="text-amber-200">Aún no procesada por el verificador.</div>;
  }
  return <div className="text-surface-300">Sin evidencia disponible.</div>;
}

interface DetailProps {
  obligation: ProofObligation;
  onClose: () => void;
  onJumpDep: (id: string) => void;
  knownIds: Map<string, ProofObligation>;
}

function DetailDialog({ obligation, onClose, onJumpDep, knownIds }: DetailProps) {
  const ob = obligation;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${ob.title}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-surface-950/80 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-surface-700 bg-surface-800 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-700 bg-surface-900 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-surface-400">
              {ob.id} · {ob.profile}
            </div>
            <h3 className="mt-0.5 text-lg font-semibold text-white">{ob.title}</h3>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${STATUS_BADGE[ob.status]}`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[ob.status]}`} />
            {STATUS_LABEL[ob.status]}
          </span>
        </header>

        <div className="space-y-4 px-5 py-4">
          <section>
            <div className="text-[11px] uppercase tracking-wider text-surface-400">
              Fórmula
            </div>
            <pre className="mt-1 overflow-x-auto rounded bg-surface-900 px-3 py-2 font-mono text-sm text-surface-100">
              {ob.formula}
            </pre>
          </section>

          {ob.dependencies.length > 0 && (
            <section>
              <div className="text-[11px] uppercase tracking-wider text-surface-400">
                Dependencias
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ob.dependencies.map((dep) => (
                  <button
                    key={dep}
                    type="button"
                    disabled={!knownIds.has(dep)}
                    onClick={() => onJumpDep(dep)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-mono transition ${
                      knownIds.has(dep)
                        ? 'cursor-pointer border-accent-purple/60 bg-accent-purple/20 text-accent-purple-light hover:bg-accent-purple/35'
                        : 'cursor-not-allowed border-surface-600 bg-surface-800 text-surface-400'
                    }`}
                  >
                    {dep}
                  </button>
                ))}
              </div>
            </section>
          )}

          {ob.proof && (
            <section>
              <div className="text-[11px] uppercase tracking-wider text-surface-400">
                Prueba paso a paso
              </div>
              <ol className="mt-2 space-y-1.5">
                {ob.proof.steps.map((s, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 rounded border border-surface-700 bg-surface-900/60 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-surface-400">{i + 1}.</span>
                    <span className="font-mono text-surface-100">{s.formula}</span>
                    <span className="text-xs text-surface-300">{s.justification}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {ob.countermodel && (
            <section>
              <div className="text-[11px] uppercase tracking-wider text-surface-400">
                Contraejemplo
              </div>
              <ul className="mt-2 divide-y divide-surface-700 overflow-hidden rounded border border-surface-700 bg-surface-900/60">
                {Object.entries(ob.countermodel).map(([k, v]) => (
                  <li key={k} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                    <span className="font-mono text-surface-200">{k}</span>
                    <span className="font-mono text-mandy-200">{String(v)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!ob.proof && !ob.countermodel && (
            <section className="rounded border border-surface-700 bg-surface-900/60 px-3 py-3 text-sm text-surface-300">
              {ob.status === 'pending'
                ? 'La obligation está en cola y aún no fue procesada por el verificador.'
                : 'No hay evidencia adicional disponible.'}
            </section>
          )}
        </div>

        <footer className="flex justify-end border-t border-surface-700 bg-surface-900 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 transition hover:bg-surface-700"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
