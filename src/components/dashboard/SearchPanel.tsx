'use client';

import { type Ref, type RefObject, useEffect, useRef } from 'react';
import { AlignLeft, BookOpen, FileText, Lightbulb, Loader2, Search, UserRound, X } from 'lucide-react';
import {
  ALL_SEARCH_RESULT_FILTER,
  SearchKind,
  SEARCH_KIND_LABELS,
  type SearchResultFilter,
  type SearchResultItem,
  type SearchResultKind
} from '@/lib/search/types';

interface SearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResultItem[];
  loading: boolean;
  errorMessage?: string | null;
  activeFilter: SearchResultFilter;
  onFilterChange: (value: SearchResultFilter) => void;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onSelect: (result: SearchResultItem) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: Ref<HTMLInputElement>;
}

const FILTERS: SearchResultFilter[] = [
  ALL_SEARCH_RESULT_FILTER,
  SearchKind.Document,
  SearchKind.Concept,
  SearchKind.Fragment,
  SearchKind.Author,
  SearchKind.Work
];

const filterLabel = (value: SearchResultFilter) =>
  value === ALL_SEARCH_RESULT_FILTER ? 'Todos' : SEARCH_KIND_LABELS[value];

const kindIcon = (kind: SearchResultKind) => {
  switch (kind) {
    case SearchKind.Concept:
      return <Lightbulb className="h-3.5 w-3.5" />;
    case SearchKind.Fragment:
      return <AlignLeft className="h-3.5 w-3.5" />;
    case SearchKind.Author:
      return <UserRound className="h-3.5 w-3.5" />;
    case SearchKind.Work:
      return <BookOpen className="h-3.5 w-3.5" />;
    case SearchKind.Document:
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
};

export default function SearchPanel({
  query,
  onQueryChange,
  results,
  loading,
  errorMessage,
  activeFilter,
  onFilterChange,
  selectedIndex,
  onSelectIndex,
  onSelect,
  onKeyDown,
  inputRef
}: SearchPanelProps) {
  const visible = activeFilter === ALL_SEARCH_RESULT_FILTER
    ? results
    : results.filter((r) => r.kind === activeFilter);

  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});

  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (typeof inputRef === 'object' && inputRef !== null) {
      (inputRef as RefObject<HTMLInputElement>).current?.focus();
    }
  }, [inputRef]);

  return (
    <div className="flex h-full w-full flex-col bg-surface-900">
      <header className="flex h-9 shrink-0 items-center border-b border-surface-700/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        Buscar
      </header>

      <div className="border-b border-surface-700/60 px-2 pt-2 pb-2">
        <div className="flex items-center gap-1.5 rounded-md border border-surface-700/60 bg-surface-950/40 px-2 py-1.5 focus-within:border-mandy-500/40">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-mandy-300" />
          ) : (
            <Search className="h-3.5 w-3.5 shrink-0 text-surface-400" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              onSelectIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Documentos, conceptos…"
            aria-label="Buscar"
            className="min-w-0 flex-1 bg-transparent text-xs text-surface-100 placeholder-surface-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              title="Limpiar"
              aria-label="Limpiar"
              className="text-surface-500 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const count = f === ALL_SEARCH_RESULT_FILTER ? results.length : (counts[f] ?? 0);
            const active = f === activeFilter;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  onFilterChange(f);
                  onSelectIndex(0);
                }}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  active
                    ? 'border-mandy-400/60 bg-mandy-500/15 text-mandy-100'
                    : 'border-surface-700 bg-surface-900/60 text-surface-400 hover:border-surface-600 hover:text-surface-200'
                }`}
              >
                {filterLabel(f)}
                {count > 0 ? ` ${count}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {errorMessage && (
          <p className="px-3 pt-2 text-[11px] text-amber-300">{errorMessage}</p>
        )}

        {!loading && query.trim().length === 0 && (
          <p className="px-3 py-6 text-center text-[11px] text-surface-500">
            Escribe para buscar en este workspace.
          </p>
        )}

        {!loading && query.trim().length > 0 && visible.length === 0 && (
          <p className="px-3 py-6 text-center text-[11px] text-surface-500">Sin coincidencias.</p>
        )}

        <ul ref={listRef} role="listbox" className="py-1">
          {visible.map((r, i) => {
            const active = i === selectedIndex;
            return (
              <li key={`${r.kind}:${r.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => onSelectIndex(i)}
                  onClick={() => onSelect(r)}
                  className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs transition ${
                    active
                      ? 'bg-mandy-500/15 text-white'
                      : 'text-surface-200 hover:bg-surface-800/60'
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-surface-400">{kindIcon(r.kind)}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{r.title}</span>
                    {r.subtitle && (
                      <span className="truncate text-[10px] text-surface-500">{r.subtitle}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
