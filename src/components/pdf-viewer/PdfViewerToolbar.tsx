import React from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Search } from 'lucide-react';

interface PdfViewerToolbarProps {
  currentPage: number;
  pageCount: number;
  zoomLevel: number;
  searchQuery: string;
  searchMatchesLength: number;
  activeSearchIndex: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageInputChange: (value: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearchPrev: () => void;
  onSearchNext: () => void;
}

export function PdfViewerToolbar({
  currentPage,
  pageCount,
  zoomLevel,
  searchQuery,
  searchMatchesLength,
  activeSearchIndex,
  onPrevPage,
  onNextPage,
  onPageInputChange,
  onZoomIn,
  onZoomOut,
  onSearchQueryChange,
  onSearchPrev,
  onSearchNext
}: PdfViewerToolbarProps) {
  return (
    <div className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-950/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-1 py-1">
        <button
          type="button"
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Página anterior"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <label className="flex items-center gap-2 px-2 text-xs text-slate-300">
          <span className="hidden sm:inline">Página</span>
          <input
            type="number"
            min={1}
            max={Math.max(pageCount, 1)}
            value={currentPage}
            onChange={(event) => onPageInputChange(event.target.value)}
            className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-xs text-slate-100 outline-none focus:border-sky-500"
            aria-label="Página actual"
          />
          <span className="text-slate-500">/ {pageCount || '—'}</span>
        </label>
        <button
          type="button"
          onClick={onNextPage}
          disabled={pageCount === 0 || currentPage >= pageCount}
          className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Página siguiente"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-1 py-1">
        <button
          type="button"
          onClick={onZoomOut}
          className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          title="Alejar"
          aria-label="Alejar PDF"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="px-2 text-xs font-medium text-slate-300"
          disabled
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          title="Acercar"
          aria-label="Acercar PDF"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-w-[15rem] flex-1 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (event.shiftKey) {
                onSearchPrev();
              } else {
                onSearchNext();
              }
            }
          }}
          placeholder="Buscar en PDF..."
          className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
          aria-label="Buscar en PDF"
        />
        <span className="text-[11px] text-slate-500">
          {searchQuery.trim()
            ? searchMatchesLength > 0
              ? `${activeSearchIndex + 1}/${searchMatchesLength}`
              : '0'
            : '—'}
        </span>
        <button
          type="button"
          onClick={onSearchPrev}
          disabled={searchMatchesLength === 0}
          className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Resultado anterior"
          aria-label="Resultado anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSearchNext}
          disabled={searchMatchesLength === 0}
          className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Resultado siguiente"
          aria-label="Resultado siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
