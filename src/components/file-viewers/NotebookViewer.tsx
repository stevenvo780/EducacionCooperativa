'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, FileCode } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface NotebookViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  outputs?: NotebookOutput[];
  execution_count?: number | null;
}

interface NotebookOutput {
  output_type: 'stream' | 'display_data' | 'execute_result' | 'error';
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NotebookData {
  cells: NotebookCell[];
  metadata?: { kernelspec?: { display_name?: string; name?: string } };
  nbformat?: number;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; notebook: NotebookData }
  | { kind: 'error'; error: string };

export default function NotebookViewer({ docName, fileUrl, onClose }: NotebookViewerProps) {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!fileUrl) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        const json = JSON.parse(text) as NotebookData;
        if (cancelled) return;
        if (!json || !Array.isArray(json.cells)) {
          throw new Error('Archivo .ipynb sin celdas válidas');
        }
        setState({ kind: 'ready', notebook: json });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setState({ kind: 'error', error: message });
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  const kernelLabel = useMemo(() => {
    if (state.kind !== 'ready') return null;
    const k = state.notebook.metadata?.kernelspec;
    return k?.display_name || k?.name || null;
  }, [state]);

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}
      actions={kernelLabel ? <span className="text-xs text-slate-400">Kernel: {kernelLabel}</span> : null}>
      {!fileUrl ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <FileCode className="h-10 w-10 text-slate-600" />
          <span className="text-sm">No se pudo cargar el notebook.</span>
        </div>
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-sm">Cargando notebook...</span>
        </div>
      ) : state.kind === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-300">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <span className="text-sm">No se pudo procesar el notebook</span>
          <code className="text-xs text-slate-500">{state.error}</code>
        </div>
      ) : (
        <NotebookCells cells={state.notebook.cells} />
      )}
    </FileViewerShell>
  );
}

function joinSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join('') : source;
}

function NotebookCells({ cells }: { cells: NotebookCell[] }) {
  return (
    <div className="h-full overflow-auto bg-slate-950 px-6 py-6">
      <div className="mx-auto flex max-w-[920px] flex-col gap-4">
        {cells.map((cell, i) => (
          <CellBlock key={i} cell={cell} />
        ))}
      </div>
    </div>
  );
}

function CellBlock({ cell }: { cell: NotebookCell }) {
  const source = joinSource(cell.source);
  if (cell.cell_type === 'markdown') {
    return (
      <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{source}</ReactMarkdown>
        </div>
      </div>
    );
  }
  if (cell.cell_type === 'raw') {
    return (
      <pre className="overflow-x-auto rounded border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
        {source}
      </pre>
    );
  }
  // code
  return (
    <div className="overflow-hidden rounded border border-slate-800">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-500">
        <span className="font-mono text-blue-400">In [{cell.execution_count ?? ' '}]</span>
      </div>
      <pre className="overflow-x-auto bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
        <code>{source}</code>
      </pre>
      {cell.outputs && cell.outputs.length > 0 && (
        <div className="border-t border-slate-800 bg-slate-900/40">
          {cell.outputs.map((out, i) => <OutputBlock key={i} output={out} />)}
        </div>
      )}
    </div>
  );
}

function OutputBlock({ output }: { output: NotebookOutput }) {
  if (output.output_type === 'stream') {
    return (
      <pre className={`overflow-x-auto px-3 py-2 text-xs ${output.name === 'stderr' ? 'text-rose-300' : 'text-slate-300'}`}>
        {Array.isArray(output.text) ? output.text.join('') : output.text}
      </pre>
    );
  }
  if (output.output_type === 'error') {
    const trace = (output.traceback ?? []).join('\n').replace(/\[[0-9;]*m/g, '');
    return (
      <pre className="overflow-x-auto px-3 py-2 text-xs text-rose-300">
        <span className="font-bold">{output.ename}: </span>{output.evalue}
        {trace && `\n${trace}`}
      </pre>
    );
  }
  // display_data / execute_result
  const data = output.data || {};
  if (data['image/png']) {
    return (
      <div className="px-3 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- inline base64 from notebook output, no optimization possible */}
        <img
          alt="output"
          src={`data:image/png;base64,${Array.isArray(data['image/png']) ? data['image/png'].join('') : data['image/png']}`}
          className="max-w-full"
        />
      </div>
    );
  }
  if (data['image/svg+xml']) {
    const svg = Array.isArray(data['image/svg+xml']) ? data['image/svg+xml'].join('') : data['image/svg+xml'];
    return <div className="px-3 py-2" dangerouslySetInnerHTML={{ __html: svg }} />;
  }
  if (data['text/html']) {
    const html = Array.isArray(data['text/html']) ? data['text/html'].join('') : data['text/html'];
    return <div className="px-3 py-2 text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (data['text/plain']) {
    const plain = Array.isArray(data['text/plain']) ? data['text/plain'].join('') : data['text/plain'];
    return (
      <pre className="overflow-x-auto px-3 py-2 text-xs text-slate-300">{plain}</pre>
    );
  }
  return null;
}
