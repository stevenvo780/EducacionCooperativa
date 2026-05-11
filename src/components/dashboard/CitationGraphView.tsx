'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, GitFork, Loader2, RefreshCw, Search } from 'lucide-react';
import clsx from 'clsx';
import { apiUrl, authFetch, parseApiResponse } from '@/services/apiClient';

interface ForceGraph2DProps {
  graphData: { nodes: ForceGraphNode[]; links: ForceGraphLink[] };
  width?: number;
  height?: number;
  backgroundColor?: string;
  nodeLabel?: (node: ForceGraphNode) => string;
  nodeColor?: (node: ForceGraphNode) => string;
  nodeVal?: (node: ForceGraphNode) => number;
  linkColor?: (link: ForceGraphLink) => string;
  linkWidth?: (link: ForceGraphLink) => number;
  linkDirectionalArrowLength?: number;
  linkDirectionalArrowRelPos?: number;
  cooldownTicks?: number;
  onNodeClick?: (node: ForceGraphNode) => void;
}

const ForceGraph2D = dynamic<ForceGraph2DProps>(
  () => import('react-force-graph-2d').then((mod) => {
    const Component = mod.default ?? mod;
    return Component as unknown as React.ComponentType<ForceGraph2DProps>;
  }),
  { ssr: false, loading: () => <GraphSkeleton /> }
);

export type CitationKind = 'wiki' | 'link' | 'concept' | 'bib';

interface CitationGraphNode {
  docId: string;
  name: string;
  type?: string;
  depth: number;
}

interface CitationGraphEdge {
  from: string;
  to: string;
  kind: CitationKind;
  weight: number;
}

interface CitationGraphResponse {
  nodes: CitationGraphNode[];
  edges: CitationGraphEdge[];
  focus: string[];
  depth: number;
}

interface ForceGraphNode {
  id: string;
  docId: string;
  name: string;
  type?: string;
  depth: number;
  color: string;
  val: number;
}

interface ForceGraphLink {
  source: string;
  target: string;
  kind: CitationKind;
  weight: number;
  color: string;
  width: number;
}

interface CitationGraphViewProps {
  workspaceId: string;
  focusDocIds: string[];
  depth?: number;
  kinds?: CitationKind[];
  height?: number;
  onNodeClick?: (docId: string) => void;
}

const ALL_KINDS: CitationKind[] = ['wiki', 'link', 'concept', 'bib'];

const KIND_COLORS: Record<CitationKind, string> = {
  wiki: '#a78bfa',
  link: '#22d3ee',
  concept: '#fbbf24',
  bib: '#f472b6'
};

const KIND_LABELS: Record<CitationKind, string> = {
  wiki: 'Wiki-links',
  link: 'Markdown',
  concept: 'Conceptos',
  bib: 'Bibliografía'
};

const DEPTH_COLORS = ['#60a5fa', '#34d399', '#fb923c', '#94a3b8'];

function GraphSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950/60">
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Cargando grafo…</span>
      </div>
    </div>
  );
}

function colorForDepth(depth: number): string {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)] ?? '#94a3b8';
}

async function fetchCitationGraph(params: {
  workspaceId: string;
  focusDocIds: string[];
  depth: number;
  kinds: CitationKind[];
  signal: AbortSignal;
}): Promise<CitationGraphResponse> {
  const { workspaceId, focusDocIds, depth, kinds, signal } = params;
  const search = new URLSearchParams();
  if (focusDocIds.length > 0) search.set('focus', focusDocIds.join(','));
  search.set('depth', String(depth));
  if (kinds.length > 0 && kinds.length < ALL_KINDS.length) {
    search.set('kinds', kinds.join(','));
  }
  const url = apiUrl(`/api/workspaces/${encodeURIComponent(workspaceId)}/citation-graph?${search.toString()}`);
  const res = await authFetch(url, { signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return parseApiResponse<CitationGraphResponse>(res);
}

async function requestBackfill(workspaceId: string): Promise<void> {
  const url = apiUrl(`/api/admin/citations/backfill`);
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId })
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export default function CitationGraphView({
  workspaceId,
  focusDocIds,
  depth: initialDepth = 2,
  kinds: initialKinds,
  height = 400,
  onNodeClick
}: CitationGraphViewProps) {
  const [data, setData] = useState<CitationGraphResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [depth, setDepth] = useState<number>(initialDepth);
  const [activeKinds, setActiveKinds] = useState<CitationKind[]>(
    initialKinds && initialKinds.length > 0 ? [...initialKinds] : [...ALL_KINDS]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillNotice, setBackfillNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (width > 0) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const focusKey = useMemo(() => focusDocIds.join(','), [focusDocIds]);
  const kindsKey = useMemo(() => [...activeKinds].sort().join(','), [activeKinds]);

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    setStatus('loading');
    setErrorMessage(null);

    fetchCitationGraph({
      workspaceId,
      focusDocIds,
      depth,
      kinds: activeKinds,
      signal: controller.signal
    })
      .then((response) => {
        setData(response);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'No se pudo cargar el grafo de citas.';
        setErrorMessage(msg);
        setStatus('error');
      });

    return () => controller.abort();
  }, [workspaceId, focusKey, depth, kindsKey, focusDocIds, activeKinds]);

  const filteredGraphData = useMemo<{ nodes: ForceGraphNode[]; links: ForceGraphLink[] }>(() => {
    if (!data) return { nodes: [], links: [] };

    const focusSet = new Set(data.focus);
    const lowerQuery = searchQuery.trim().toLowerCase();

    const allowedNodes = lowerQuery
      ? data.nodes.filter((n) => n.name.toLowerCase().includes(lowerQuery) || focusSet.has(n.docId))
      : data.nodes;

    const allowedIds = new Set(allowedNodes.map((n) => n.docId));

    const nodes: ForceGraphNode[] = allowedNodes.map((n) => ({
      id: n.docId,
      docId: n.docId,
      name: n.name,
      type: n.type,
      depth: n.depth,
      color: focusSet.has(n.docId) ? '#3b82f6' : colorForDepth(n.depth),
      val: focusSet.has(n.docId) ? 8 : Math.max(2, 6 - n.depth)
    }));

    const links: ForceGraphLink[] = data.edges
      .filter((e) => allowedIds.has(e.from) && allowedIds.has(e.to))
      .map((e) => ({
        source: e.from,
        target: e.to,
        kind: e.kind,
        weight: e.weight,
        color: KIND_COLORS[e.kind] ?? '#64748b',
        width: Math.min(Math.max(e.weight, 1), 5)
      }));

    return { nodes, links };
  }, [data, searchQuery]);

  const toggleKind = useCallback((kind: CitationKind) => {
    setActiveKinds((prev) => {
      if (prev.includes(kind)) {
        const next = prev.filter((k) => k !== kind);
        return next.length === 0 ? prev : next;
      }
      return [...prev, kind];
    });
  }, []);

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    if (onNodeClick) onNodeClick(node.docId);
  }, [onNodeClick]);

  const handleBackfill = useCallback(async () => {
    if (!workspaceId || backfilling) return;
    setBackfilling(true);
    setBackfillNotice(null);
    try {
      await requestBackfill(workspaceId);
      setBackfillNotice('Reindexación iniciada. Recarga en unos segundos.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar la reindexación.';
      setBackfillNotice(`Error: ${msg}`);
    } finally {
      setBackfilling(false);
    }
  }, [workspaceId, backfilling]);

  const handleReload = useCallback(() => {
    setDepth((current) => current);
    setActiveKinds((current) => [...current]);
  }, []);

  const isEmpty = status === 'success' && filteredGraphData.nodes.length === 0;
  const isFilteredEmpty = isEmpty && (data?.nodes.length ?? 0) > 0;

  return (
    <div className="flex h-full w-full flex-col bg-slate-950">
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/60 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <GitFork className="h-3.5 w-3.5 text-blue-400" />
            Grafo de citas
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Profundidad</span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepth(d)}
                className={clsx(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition',
                  depth === d
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'border border-slate-700 text-slate-400 hover:text-slate-200'
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Tipos</span>
            {ALL_KINDS.map((kind) => {
              const active = activeKinds.includes(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  className={clsx(
                    'flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition border',
                    active
                      ? 'border-slate-600 bg-slate-800 text-slate-100'
                      : 'border-slate-800 bg-transparent text-slate-500 hover:text-slate-300'
                  )}
                  title={KIND_LABELS[kind]}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: KIND_COLORS[kind], opacity: active ? 1 : 0.3 }}
                  />
                  {KIND_LABELS[kind]}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1">
              <Search className="h-3 w-3 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar nodos…"
                className="w-32 bg-transparent text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleReload}
              className="rounded border border-slate-700 p-1 text-slate-400 transition hover:text-slate-200"
              title="Recargar"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {data && status === 'success' && (
          <div className="mt-1.5 text-[10px] text-slate-500">
            {filteredGraphData.nodes.length} nodo{filteredGraphData.nodes.length !== 1 ? 's' : ''} · {filteredGraphData.links.length} citas
            {data.focus.length > 0 && ` · foco: ${data.focus.length}`}
          </div>
        )}
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1" style={{ height }}>
        {status === 'loading' && <GraphSkeleton />}

        {status === 'error' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p className="text-sm font-medium text-slate-200">No se pudo cargar el grafo</p>
            <p className="max-w-md text-xs text-slate-500">{errorMessage}</p>
            <button
              type="button"
              onClick={handleReload}
              className="mt-2 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Reintentar
            </button>
          </div>
        )}

        {status === 'success' && isEmpty && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <GitFork className="h-8 w-8 text-slate-700" />
            {isFilteredEmpty ? (
              <p className="text-xs text-slate-500">Ningún nodo coincide con el filtro actual.</p>
            ) : (
              <>
                <p className="max-w-md text-sm text-slate-300">
                  Sin citas detectadas en este documento.
                </p>
                <p className="max-w-md text-xs text-slate-500">
                  El grafo se construye con wiki-links, markdown links, conceptos compartidos y citas bibliográficas.
                </p>
                <button
                  type="button"
                  onClick={() => { void handleBackfill(); }}
                  disabled={backfilling}
                  className="mt-2 inline-flex items-center gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {backfilling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Reindexar workspace
                </button>
                {backfillNotice && <p className="text-[11px] text-slate-400">{backfillNotice}</p>}
              </>
            )}
          </div>
        )}

        {status === 'success' && !isEmpty && (
          <ForceGraph2D
            graphData={filteredGraphData}
            width={containerWidth}
            height={height}
            backgroundColor="#020617"
            nodeLabel={(node: ForceGraphNode) => node.name}
            nodeColor={(node: ForceGraphNode) => node.color}
            nodeVal={(node: ForceGraphNode) => node.val}
            linkColor={(link: ForceGraphLink) => link.color}
            linkWidth={(link: ForceGraphLink) => link.width}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            cooldownTicks={50}
            onNodeClick={handleNodeClick}
          />
        )}
      </div>
    </div>
  );
}
