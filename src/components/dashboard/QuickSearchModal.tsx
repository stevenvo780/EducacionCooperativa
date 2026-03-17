'use client';

import type React from 'react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import { AlignLeft, BookOpen, FileText, Lightbulb, Loader2, Search, UserRound } from 'lucide-react';
import {
  ALL_SEARCH_RESULT_FILTER,
  SearchKind,
  SEARCH_KIND_LABELS,
  type SearchResultFilter,
  type SearchResultItem,
  type SearchResultKind,
  type SearchSourceDocument
} from '@/lib/search/types';

interface QuickSearchModalProps {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResultItem[];
  loading: boolean;
  errorMessage?: string | null;
  activeFilter: SearchResultFilter;
  onFilterChange: (value: SearchResultFilter) => void;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
  onSelect: (result: SearchResultItem) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  getDocumentIcon: (doc: SearchSourceDocument) => React.ReactNode;
  modalFade: Transition;
  modalPop: Transition;
}

const FILTERS: SearchResultFilter[] = [
  ALL_SEARCH_RESULT_FILTER,
  SearchKind.Document,
  SearchKind.Concept,
  SearchKind.Fragment,
  SearchKind.Author,
  SearchKind.Work
];

const filterLabel = (value: SearchResultFilter) => {
  if (value === ALL_SEARCH_RESULT_FILTER) return 'Todos';
  return SEARCH_KIND_LABELS[value];
};

const kindIcon = (kind: SearchResultKind) => {
  switch (kind) {
    case SearchKind.Concept:
      return <Lightbulb className="w-5 h-5" />;
    case SearchKind.Fragment:
      return <AlignLeft className="w-5 h-5" />;
    case SearchKind.Author:
      return <UserRound className="w-5 h-5" />;
    case SearchKind.Work:
      return <BookOpen className="w-5 h-5" />;
    case SearchKind.Document:
    default:
      return <FileText className="w-5 h-5" />;
  }
};

const QuickSearchModal = ({
  open,
  query,
  onQueryChange,
  results,
  loading,
  errorMessage,
  activeFilter,
  onFilterChange,
  selectedIndex,
  onSelectIndex,
  onClose,
  onSelect,
  onKeyDown,
  inputRef,
  getDocumentIcon,
  modalFade,
  modalPop
}: QuickSearchModalProps) => {
  const visibleResults = activeFilter === ALL_SEARCH_RESULT_FILTER
    ? results
    : results.filter(result => result.kind === activeFilter);

  const kindCounts = results.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.kind] = (accumulator[result.kind] ?? 0) + 1;
    return accumulator;
  }, {});

  const groupOrder: SearchResultKind[] = [];
  const groupedResults = new Map<SearchResultKind, SearchResultItem[]>();
  visibleResults.forEach(result => {
    if (!groupedResults.has(result.kind)) {
      groupedResults.set(result.kind, []);
      groupOrder.push(result.kind);
    }
    groupedResults.get(result.kind)?.push(result);
  });

  let globalResultIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={modalFade}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/70"
          style={{ willChange: 'opacity' }}
          onClick={onClose}
        >
          <m.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={modalPop}
            className="w-full max-w-3xl bg-surface-800 border border-surface-600 rounded-xl shadow-xl overflow-hidden transform-gpu"
            style={{ willChange: 'transform, opacity' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700">
              {loading ? (
                <Loader2 className="w-5 h-5 text-mandy-400 animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-surface-400" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => {
                  onQueryChange(e.target.value);
                  onSelectIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Buscar documentos, conceptos, fragmentos, autores u obras..."
                className="flex-1 bg-transparent text-white placeholder-surface-500 outline-none text-sm"
                autoFocus
              />
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-medium bg-surface-700 text-surface-400 rounded">
                ESC
              </kbd>
            </div>

            <div className="px-4 py-2 border-b border-surface-700 flex flex-wrap gap-2">
              {FILTERS.map(filter => {
                const count = filter === ALL_SEARCH_RESULT_FILTER ? results.length : (kindCounts[filter] ?? 0);
                const active = filter === activeFilter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      onFilterChange(filter);
                      onSelectIndex(0);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? 'border-mandy-400 bg-mandy-500/15 text-mandy-100'
                        : 'border-surface-600 bg-surface-900/40 text-surface-400 hover:border-surface-500 hover:text-surface-200'
                    }`}
                  >
                    {filterLabel(filter)} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {errorMessage ? (
                <div className="px-4 pt-3 text-xs text-amber-300">{errorMessage}</div>
              ) : null}

              {!loading && visibleResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-surface-500 text-sm">
                  {query.trim()
                    ? 'No se encontraron resultados semánticos en este espacio'
                    : 'Empieza a escribir para buscar en todo el espacio'}
                </div>
              ) : null}

              {loading && visibleResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-surface-500 text-sm flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-mandy-400" />
                  <span>Buscando relaciones, fragmentos y documentos...</span>
                </div>
              ) : null}

              {groupOrder.map(kind => {
                const items = groupedResults.get(kind) ?? [];
                if (items.length === 0) return null;

                return (
                  <div key={kind}>
                    <div className="sticky top-0 z-[1] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-surface-500 bg-surface-800/95 backdrop-blur">
                      {SEARCH_KIND_LABELS[kind]}
                    </div>
                    {items.map(result => {
                      globalResultIndex += 1;
                      const currentIndex = globalResultIndex;
                      const isSelected = currentIndex === selectedIndex;
                      const icon = result.kind === SearchKind.Document
                        ? getDocumentIcon(result.sourceDoc)
                        : kindIcon(result.kind);

                      return (
                        <button
                          key={result.id}
                          onClick={() => onSelect(result)}
                          onMouseEnter={() => onSelectIndex(currentIndex)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? 'bg-mandy-500/20 text-white'
                              : 'text-surface-300 hover:bg-surface-700/50'
                          }`}
                        >
                          <div className="mt-0.5 text-surface-300">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="text-sm font-medium truncate">{result.title}</div>
                              <span className="shrink-0 rounded-full border border-surface-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-surface-400">
                                {SEARCH_KIND_LABELS[result.kind]}
                              </span>
                            </div>
                            {result.preview ? (
                              <div className="mt-1 text-xs text-surface-400 max-h-10 overflow-hidden">{result.preview}</div>
                            ) : null}
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500">
                              {result.subtitle ? <span>{result.subtitle}</span> : null}
                              {result.sourceDoc.folder ? <span>{result.sourceDoc.folder}</span> : null}
                              {result.matchedTerms.length > 0 ? (
                                <span>coincide: {result.matchedTerms.slice(0, 3).join(', ')}</span>
                              ) : null}
                            </div>
                          </div>
                          {isSelected ? (
                            <kbd className="mt-0.5 px-1.5 py-0.5 text-[10px] bg-surface-600 text-surface-400 rounded">
                              Enter
                            </kbd>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-2 border-t border-surface-700 flex items-center justify-between text-[10px] text-surface-500">
              <span>
                Tip: usa <kbd className="px-1 py-0.5 bg-surface-700 rounded mx-1">Ctrl+P</kbd> para abrir este buscador
              </span>
              <span>{visibleResults.length} resultados</span>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default QuickSearchModal;
