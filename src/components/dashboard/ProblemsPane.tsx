'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  FileText,
  Filter
} from 'lucide-react';
import {
  subscribeDiagnostics,
  clearDiagnostics,
  type DiagnosticSeverity,
  type ResolvedDiagnostic
} from '@/lib/diagnostics-bus';

const SEVERITIES: DiagnosticSeverity[] = ['error', 'warning', 'info', 'hint'];

const SEVERITY_LABEL: Record<DiagnosticSeverity, string> = {
  error: 'Errores',
  warning: 'Advertencias',
  info: 'Información',
  hint: 'Sugerencias'
};

function severityIcon(s: DiagnosticSeverity) {
  switch (s) {
    case 'error': return <AlertCircle className="h-3 w-3 text-rose-400" />;
    case 'warning': return <AlertTriangle className="h-3 w-3 text-amber-300" />;
    case 'info': return <Info className="h-3 w-3 text-sky-300" />;
    case 'hint': return <Lightbulb className="h-3 w-3 text-emerald-300" />;
  }
}

function severityRank(s: DiagnosticSeverity): number {
  return { error: 0, warning: 1, info: 2, hint: 3 }[s];
}

interface ProblemsPaneProps {
  /** Recibe nombre legible para un uri ("global" -> null). */
  resolveDocName?: (uri: string) => string | null;
  /** Permite navegar al click sobre una entry. */
  onOpenDocument?: (uri: string, range?: { line: number; column?: number }) => void;
  /** Permite ejecutar una quick-fix. La UI delega al consumidor. */
  onRunAction?: (diagnostic: ResolvedDiagnostic, actionId: string) => void;
}

export default function ProblemsPane({ resolveDocName, onOpenDocument, onRunAction }: ProblemsPaneProps) {
  const [items, setItems] = useState<ResolvedDiagnostic[]>([]);
  const [filter, setFilter] = useState<DiagnosticSeverity | 'all'>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sourceFilter, setSourceFilter] = useState<string | 'all'>('all');

  useEffect(() => subscribeDiagnostics(setItems), []);

  const sources = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.source));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== 'all' && it.severity !== filter) return false;
      if (sourceFilter !== 'all' && it.source !== sourceFilter) return false;
      return true;
    });
  }, [items, filter, sourceFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ResolvedDiagnostic[]>();
    for (const it of filtered) {
      const list = map.get(it.uri) ?? [];
      list.push(it);
      map.set(it.uri, list);
    }
    // ordenar items dentro de cada grupo por severidad y línea
    for (const list of map.values()) {
      list.sort((a, b) => {
        const r = severityRank(a.severity) - severityRank(b.severity);
        if (r !== 0) return r;
        return (a.range?.startLine ?? 0) - (b.range?.startLine ?? 0);
      });
    }
    // ordenar grupos: global al final
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'global' && b !== 'global') return 1;
      if (b === 'global' && a !== 'global') return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<DiagnosticSeverity, number> = { error: 0, warning: 0, info: 0, hint: 0 };
    items.forEach((i) => { c[i.severity] = (c[i.severity] ?? 0) + 1; });
    return c;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-surface-500">
        Sin problemas detectados.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar de filtros */}
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-surface-800/60 px-2 text-[11px]">
        <SeverityChip
          label="Todos"
          active={filter === 'all'}
          count={items.length}
          onClick={() => setFilter('all')}
        />
        {SEVERITIES.map((s) => counts[s] > 0 && (
          <SeverityChip
            key={s}
            label={SEVERITY_LABEL[s]}
            icon={severityIcon(s)}
            active={filter === s}
            count={counts[s]}
            onClick={() => setFilter((f) => f === s ? 'all' : s)}
          />
        ))}

        <span className="ml-1 h-3 w-px bg-surface-700/60" aria-hidden />

        <Filter className="h-3 w-3 text-surface-500" />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as string)}
          aria-label="Filtrar por origen"
          className="bg-transparent text-surface-300 outline-none cursor-pointer hover:text-white"
        >
          <option value="all" className="bg-surface-900">Todos los orígenes</option>
          {sources.map((s) => (
            <option key={s} value={s} className="bg-surface-900">{s}</option>
          ))}
        </select>

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => clearDiagnostics()}
          className="rounded px-1.5 text-surface-400 transition hover:bg-surface-800 hover:text-white"
        >
          Limpiar
        </button>
      </div>

      {/* Lista agrupada por archivo */}
      <div className="flex-1 min-h-0 overflow-y-auto font-mono text-[11px]">
        {grouped.map(([uri, list]) => {
          const docName = resolveDocName?.(uri) ?? (uri === 'global' ? 'Aplicación' : uri);
          const isCollapsed = collapsed[uri];
          const groupCounts = list.reduce<Record<DiagnosticSeverity, number>>(
            (acc, d) => { acc[d.severity]++; return acc; },
            { error: 0, warning: 0, info: 0, hint: 0 }
          );
          return (
            <section key={uri}>
              <header
                role="button"
                tabIndex={0}
                onClick={() => setCollapsed((c) => ({ ...c, [uri]: !c[uri] }))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed((c) => ({ ...c, [uri]: !c[uri] })); }}
                className="flex cursor-pointer items-center gap-1.5 border-b border-surface-800/40 bg-surface-900/40 px-2 py-1 text-surface-300 transition hover:bg-surface-800/60"
              >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <FileText className="h-3 w-3 text-surface-500" />
                <span className="truncate">{docName}</span>
                <span className="ml-auto flex items-center gap-2 text-[10px] text-surface-500">
                  {groupCounts.error > 0 && <span className="text-rose-300">{groupCounts.error}</span>}
                  {groupCounts.warning > 0 && <span className="text-amber-300">{groupCounts.warning}</span>}
                  {groupCounts.info > 0 && <span className="text-sky-300">{groupCounts.info}</span>}
                  {groupCounts.hint > 0 && <span className="text-emerald-300">{groupCounts.hint}</span>}
                </span>
              </header>

              {!isCollapsed && (
                <ul className="divide-y divide-surface-800/40">
                  {list.map((d) => (
                    <li
                      key={d.id}
                      className="group flex items-start gap-2 px-3 py-1.5 transition hover:bg-surface-800/40 focus-within:bg-surface-800/40"
                    >
                      <span className="mt-0.5 shrink-0">{severityIcon(d.severity)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (uri !== 'global' && onOpenDocument) {
                            onOpenDocument(uri, d.range ? { line: d.range.startLine, column: d.range.startColumn } : undefined);
                          }
                        }}
                        className="flex min-w-0 flex-1 flex-col text-left"
                      >
                        <span className="break-words text-surface-100">
                          {d.message}
                          {d.code && (
                            <span className="ml-1 rounded bg-surface-800/80 px-1 text-[10px] text-surface-400">{d.code}</span>
                          )}
                        </span>
                        {d.detail && (
                          <span className="break-words text-[10px] text-surface-500">{d.detail}</span>
                        )}
                        <span className="mt-0.5 flex items-center gap-2 text-[10px] text-surface-500">
                          <span className="rounded bg-surface-800/60 px-1">{d.source}</span>
                          {d.range && (
                            <span>
                              línea {d.range.startLine}
                              {typeof d.range.startColumn === 'number' ? `:${d.range.startColumn}` : ''}
                            </span>
                          )}
                        </span>
                      </button>
                      {d.actions && d.actions.length > 0 && (
                        <span className="hidden flex-wrap items-center gap-1 group-hover:flex">
                          {d.actions.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => onRunAction?.(d, a.id)}
                              title={a.label}
                              className="rounded border border-surface-700 bg-surface-900 px-1.5 py-0.5 text-[10px] text-surface-300 transition hover:border-mandy-500/40 hover:text-white"
                            >
                              {a.label}
                            </button>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SeverityChip({
  label, icon, active, count, onClick
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-5 items-center gap-1 rounded px-1.5 text-[11px] transition ${
        active ? 'bg-mandy-500/15 text-white' : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-100'
      }`}
    >
      {icon}
      {label}
      <span className="text-[10px] text-surface-500">{count}</span>
    </button>
  );
}
