'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, BookOpen, ChevronLeft, ChevronRight, AlertTriangle, List } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface EpubViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface TocEntry {
  label: string;
  href: string;
  subitems?: TocEntry[];
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; toc: TocEntry[]; locationLabel: string }
  | { kind: 'error'; error: string };

export default function EpubViewer({ docName, fileUrl, onClose }: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<{
    next: () => Promise<void>;
    prev: () => Promise<void>;
    display: (target?: string) => Promise<void>;
    on: (event: string, cb: (...args: unknown[]) => void) => void;
    destroy: () => void;
  } | null>(null);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    if (!fileUrl || !containerRef.current) {
      setState({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const ePubModule = await import('epubjs');
        const ePub = ePubModule.default;
        const book = ePub(buffer as ArrayBuffer);
        if (cancelled) {
          book.destroy();
          return;
        }

        if (!containerRef.current) return;
        const rendition = book.renderTo(containerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated'
        });
        renditionRef.current = rendition as unknown as typeof renditionRef.current;
        rendition.themes.default({
          body: {
            'background': '#0f172a',
            'color': '#e2e8f0',
            'font-family': "'Georgia', serif",
            'line-height': '1.6',
            'padding': '2em 3em'
          },
          'a': { 'color': '#60a5fa' },
          'h1, h2, h3, h4': { 'color': '#f1f5f9' },
          'blockquote': { 'border-left': '3px solid #475569', 'padding-left': '1em', 'color': '#94a3b8' }
        });

        await rendition.display();
        const navigation = await book.loaded.navigation;
        if (cancelled) return;

        const flatten = (items: { label: string; href: string; subitems?: unknown[] }[]): TocEntry[] =>
          items.map((it) => ({
            label: (it.label || '').trim(),
            href: it.href,
            subitems: it.subitems ? flatten(it.subitems as { label: string; href: string }[]) : undefined
          }));

        const toc = flatten((navigation.toc ?? []) as { label: string; href: string; subitems?: unknown[] }[]);
        setState({ kind: 'ready', toc, locationLabel: '' });

        rendition.on('relocated', (location: { start?: { displayed?: { page?: number; total?: number } } }) => {
          const start = location?.start?.displayed;
          if (start && typeof start.page === 'number' && typeof start.total === 'number') {
            setState((prev) => prev.kind === 'ready'
              ? { ...prev, locationLabel: `Página ${start.page} de ${start.total}` }
              : prev);
          }
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setState({ kind: 'error', error: message });
      }
    })();

    return () => {
      cancelled = true;
      if (renditionRef.current) {
        try { renditionRef.current.destroy(); } catch { /* ignore */ }
        renditionRef.current = null;
      }
    };
  }, [fileUrl]);

  const goNext = () => { void renditionRef.current?.next(); };
  const goPrev = () => { void renditionRef.current?.prev(); };
  const goTo = (href: string) => {
    void renditionRef.current?.display(href);
    setShowToc(false);
  };

  const actions = state.kind === 'ready' ? (
    <>
      <button
        type="button"
        onClick={() => setShowToc((v) => !v)}
        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
        title="Tabla de contenidos"
      >
        <List className="h-3 w-3" /> Índice
      </button>
      <button
        type="button"
        onClick={goPrev}
        className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700"
        title="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={goNext}
        className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700"
        title="Siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {state.locationLabel && (
        <span className="text-xs text-slate-400">{state.locationLabel}</span>
      )}
    </>
  ) : null;

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose} actions={actions}>
      <div className="relative h-full">
        {!fileUrl && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <BookOpen className="h-10 w-10 text-slate-600" />
            <span className="text-sm">No se pudo cargar el libro.</span>
          </div>
        )}
        {state.kind === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <span className="text-sm">Cargando libro...</span>
          </div>
        )}
        {state.kind === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-300">
            <AlertTriangle className="h-10 w-10 text-amber-400" />
            <span className="text-sm">No se pudo abrir el EPUB</span>
            <code className="text-xs text-slate-500">{state.error}</code>
          </div>
        )}
        {showToc && state.kind === 'ready' && (
          <TocPanel toc={state.toc} onSelect={goTo} onClose={() => setShowToc(false)} />
        )}
        <div
          ref={containerRef}
          className="h-full w-full"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (ratio < 0.25) goPrev();
            else if (ratio > 0.75) goNext();
          }}
          style={{ cursor: 'pointer' }}
        />
      </div>
    </FileViewerShell>
  );
}

function TocPanel({ toc, onSelect, onClose }: {
  toc: TocEntry[];
  onSelect: (href: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-y-0 left-0 z-20 w-80 overflow-y-auto border-r border-slate-700 bg-slate-900/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Índice</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-white"
        >Cerrar</button>
      </div>
      <ul className="py-2">
        {toc.map((entry, i) => (
          <TocItem key={i} entry={entry} onSelect={onSelect} depth={0} />
        ))}
      </ul>
    </div>
  );
}

function TocItem({ entry, onSelect, depth }: {
  entry: TocEntry;
  onSelect: (href: string) => void;
  depth: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry.href)}
        className="block w-full truncate px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        {entry.label || '(sin título)'}
      </button>
      {entry.subitems && entry.subitems.length > 0 && (
        <ul>
          {entry.subitems.map((sub, i) => (
            <TocItem key={i} entry={sub} onSelect={onSelect} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
