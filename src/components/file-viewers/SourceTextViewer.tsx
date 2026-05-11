'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { parseBibtex, type BibEntry } from '@/lib/parsers/bibtex';
import { escapeHtml } from '@/lib/html-utils';
import { sanitizeHtml } from '@/lib/safe-html';

interface SourceTextViewerProps {
  docName: string;
  fileUrl: string | null;
  language?: 'latex' | 'bibtex' | 'plain';
  onClose?: () => void;
}

const CHUNK_BYTES = 100 * 1024;

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; text: string; loadedBytes: number; totalBytes: number | null; done: boolean }
  | { kind: 'error'; error: string };

interface UseStreamedTextResult {
  state: LoadState;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
}

const decoder = new TextDecoder('utf-8', { fatal: false });

function useStreamedText(fileUrl: string | null): UseStreamedTextResult {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchRange = useCallback(async (
    url: string,
    start: number,
    end: number,
    signal: AbortSignal
  ): Promise<{ bytes: Uint8Array; totalBytes: number | null; servedRange: boolean }> => {
    const res = await fetch(url, {
      signal,
      headers: { Range: `bytes=${start}-${end}` }
    });
    if (res.status !== 200 && res.status !== 206) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (res.status === 206) {
      const contentRange = res.headers.get('content-range') ?? '';
      const totalMatch = contentRange.match(/\/(\d+)$/);
      const totalBytes = totalMatch && totalMatch[1] ? Number(totalMatch[1]) : null;
      return { bytes, totalBytes, servedRange: true };
    }
    return { bytes, totalBytes: bytes.byteLength, servedRange: false };
  }, []);

  useEffect(() => {
    if (!fileUrl) {
      setState({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const { bytes, totalBytes, servedRange } = await fetchRange(fileUrl, 0, CHUNK_BYTES - 1, controller.signal);
        if (controller.signal.aborted) return;
        const text = decoder.decode(bytes, { stream: servedRange });
        const loadedBytes = bytes.byteLength;
        const total = totalBytes ?? loadedBytes;
        const done = !servedRange || (totalBytes !== null && loadedBytes >= totalBytes);
        setState({ kind: 'ready', text, loadedBytes, totalBytes: total, done });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [fileUrl, fetchRange]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!fileUrl) return;
    if (inFlightRef.current) {
      await inFlightRef.current;
      return;
    }
    if (state.kind !== 'ready' || state.done) return;

    const start = state.loadedBytes;
    const end = start + CHUNK_BYTES - 1;
    const controller = abortRef.current ?? new AbortController();
    setLoadingMore(true);

    const promise = (async () => {
      try {
        const { bytes, totalBytes } = await fetchRange(fileUrl, start, end, controller.signal);
        if (controller.signal.aborted) return;
        const chunkText = decoder.decode(bytes, { stream: true });
        setState((prev) => {
          if (prev.kind !== 'ready') return prev;
          const loaded = prev.loadedBytes + bytes.byteLength;
          const total = totalBytes ?? prev.totalBytes ?? loaded;
          const done = bytes.byteLength === 0 || (total !== null && loaded >= total);
          return {
            kind: 'ready',
            text: prev.text + chunkText,
            loadedBytes: loaded,
            totalBytes: total,
            done
          };
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', error: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoadingMore(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    await promise;
  }, [fileUrl, state, fetchRange]);

  return { state, loadMore, loadingMore };
}

export default function SourceTextViewer({ docName, fileUrl, language = 'plain', onClose }: SourceTextViewerProps) {
  const { state, loadMore, loadingMore } = useStreamedText(fileUrl);

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={FileText} message="No se pudo cargar el archivo." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Cargando..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} />
      ) : language === 'bibtex' ? (
        <BibtexView
          text={state.text}
          done={state.done}
          loadingMore={loadingMore}
          loadedBytes={state.loadedBytes}
          totalBytes={state.totalBytes}
          onLoadMore={loadMore}
        />
      ) : (
        <PlainSourceView
          text={state.text}
          language={language}
          done={state.done}
          loadingMore={loadingMore}
          loadedBytes={state.loadedBytes}
          totalBytes={state.totalBytes}
          onLoadMore={loadMore}
        />
      )}
    </FileViewerShell>
  );
}

interface ChunkedTextProps {
  text: string;
  done: boolean;
  loadingMore: boolean;
  loadedBytes: number;
  totalBytes: number | null;
  onLoadMore: () => Promise<void>;
}

function PlainSourceView({ text, language, done, loadingMore, loadedBytes, totalBytes, onLoadMore }: ChunkedTextProps & { language: string }) {
  const highlighted = useMemo(() => highlightLines(text, language), [text, language]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useAutoLoadMore(scrollRef, done, loadingMore, onLoadMore);
  return (
    <div ref={scrollRef} className="h-full overflow-auto bg-slate-950">
      <pre className="min-w-full px-6 py-4 text-xs leading-relaxed">
        <code className="font-mono text-slate-200">
          <div className="viewer-virtualized">
            {highlighted.map((line, i) => (
              <div key={i} className="flex">
                <span className="mr-4 select-none text-right text-slate-600" style={{ minWidth: 32 }}>{i + 1}</span>
                <span className="flex-1 whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: line }} />
              </div>
            ))}
          </div>
        </code>
      </pre>
      <LoadMoreBar
        done={done}
        loadingMore={loadingMore}
        loadedBytes={loadedBytes}
        totalBytes={totalBytes}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}

function BibtexView({ text, done, loadingMore, loadedBytes, totalBytes, onLoadMore }: ChunkedTextProps) {
  const entries = useMemo(() => parseBibtex(text), [text]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useAutoLoadMore(scrollRef, done, loadingMore, onLoadMore);
  if (entries.length === 0) {
    return (
      <PlainSourceView
        text={text}
        language="bibtex"
        done={done}
        loadingMore={loadingMore}
        loadedBytes={loadedBytes}
        totalBytes={totalBytes}
        onLoadMore={onLoadMore}
      />
    );
  }
  return (
    <div ref={scrollRef} className="h-full overflow-auto bg-slate-950 px-6 py-6">
      <div className="mx-auto flex max-w-[920px] flex-col gap-3">
        <div className="text-xs text-slate-500">{entries.length} entradas</div>
        <div className="viewer-virtualized flex flex-col gap-3">
          {entries.map((entry, i) => <BibEntryCard key={i} entry={entry} />)}
        </div>
      </div>
      <LoadMoreBar
        done={done}
        loadingMore={loadingMore}
        loadedBytes={loadedBytes}
        totalBytes={totalBytes}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}

interface LoadMoreBarProps {
  done: boolean;
  loadingMore: boolean;
  loadedBytes: number;
  totalBytes: number | null;
  onLoadMore: () => Promise<void>;
}

function LoadMoreBar({ done, loadingMore, loadedBytes, totalBytes, onLoadMore }: LoadMoreBarProps) {
  if (done) return null;
  const pct = totalBytes && totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : null;
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/95 px-4 py-2 text-xs text-slate-300 backdrop-blur">
      <span>
        {formatBytes(loadedBytes)}{totalBytes !== null ? ` / ${formatBytes(totalBytes)}` : ''}{pct !== null ? ` (${pct}%)` : ''}
      </span>
      <button
        type="button"
        onClick={() => { void onLoadMore(); }}
        disabled={loadingMore}
        className="inline-flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
      >
        {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        Ver más
      </button>
    </div>
  );
}

function useAutoLoadMore(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  done: boolean,
  loadingMore: boolean,
  onLoadMore: () => Promise<void>
): void {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || done) return;
    const handler = (): void => {
      if (loadingMore || done) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 200) {
        void onLoadMore();
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [scrollRef, done, loadingMore, onLoadMore]);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function BibEntryCard({ entry }: { entry: BibEntry }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-emerald-300">
          {entry.type}
        </span>
        <code className="text-sm font-mono text-blue-300">{entry.key}</code>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
        {entry.fields.map((f, j) => (
          <React.Fragment key={j}>
            <dt className="font-mono text-slate-500">{f.name}</dt>
            <dd className="text-slate-200">{f.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function highlightLines(text: string, language: string): string[] {
  const lines = text.split('\n');
  const colored = (() => {
    if (language === 'latex') {
      return lines.map((line) => escapeHtml(line)
        .replace(/(%.*$)/g, '<span style="color:#64748b">$1</span>')
        .replace(/(\\[a-zA-Z]+\*?)/g, '<span style="color:#60a5fa">$1</span>')
        .replace(/(\{[^{}]*\})/g, '<span style="color:#fcd34d">$1</span>')
        .replace(/(\$[^$]*\$)/g, '<span style="color:#a78bfa">$1</span>')
      );
    }
    if (language === 'bibtex') {
      return lines.map((line) => escapeHtml(line)
        .replace(/(@\w+)/g, '<span style="color:#34d399">$1</span>')
        .replace(/(\w+)\s*=/g, '<span style="color:#60a5fa">$1</span>=')
        .replace(/(\{[^{}]*\})/g, '<span style="color:#fcd34d">$1</span>')
      );
    }
    return lines.map(escapeHtml);
  })();
  return colored.map(sanitizeHtml);
}
