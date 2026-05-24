'use client';

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Cell, CodeCell, MarkdownCell, CellOutput } from '@/types/stnb';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

interface Props {
  cell: Cell;
  index: number;
  onUpdate: (cell: Cell) => void;
  onRun: (cellId: string) => Promise<void>;
  onRemove: (cellId: string) => void;
  running: boolean;
}

function OutputView({ outputs }: { outputs: CellOutput[] }) {
  if (outputs.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {outputs.map((out, i) => {
        if (out.type === 'error') {
          const msg =
            typeof (out.data as Record<string, unknown>)['message'] === 'string'
              ? String((out.data as Record<string, unknown>)['message'])
              : JSON.stringify(out.data);
          return (
            <pre
              key={i}
              className="text-xs bg-red-50 border border-red-200 text-red-700 rounded p-2 whitespace-pre-wrap"
            >
              {msg}
            </pre>
          );
        }
        if (out.type === 'result') {
          const valid = (out.data as Record<string, unknown>)['valid'];
          const color = valid === true ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
          return (
            <pre key={i} className={`text-xs rounded border p-2 whitespace-pre-wrap ${color}`}>
              {JSON.stringify(out.data, null, 2)}
            </pre>
          );
        }
        return (
          <pre key={i} className="text-xs bg-gray-50 border border-gray-200 rounded p-2 whitespace-pre-wrap">
            {JSON.stringify(out.data)}
          </pre>
        );
      })}
    </div>
  );
}

function MarkdownCellView({
  cell,
  onUpdate,
  onRemove
}: {
  cell: MarkdownCell;
  index: number;
  onUpdate: (cell: Cell) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({ ...cell, source: e.target.value });
    },
    [cell, onUpdate]
  );

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-400">markdown</span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(v => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            {editing ? 'Preview' : 'Editar'}
          </button>
          <button
            onClick={() => onRemove(cell.id)}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Eliminar
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          className="w-full text-sm font-mono border border-gray-200 rounded p-2 resize-y min-h-24 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          value={cell.source}
          onChange={handleSourceChange}
          onBlur={() => setEditing(false)}
          autoFocus
        />
      ) : (
        <div
          className="prose prose-sm prose-slate dark:prose-invert max-w-none cursor-text min-h-6 [&_.math-display]:block [&_.math-display]:text-center [&_.math-display]:my-4"
          onClick={() => setEditing(true)}
        >
          <React.Suspense fallback={<span className="text-xs text-gray-400">Cargando…</span>}>
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {cell.source || '_Haz clic para editar_'}
            </ReactMarkdown>
          </React.Suspense>
        </div>
      )}
    </div>
  );
}

function CodeCellView({
  cell,
  onUpdate,
  onRun,
  onRemove,
  running
}: {
  cell: CodeCell;
  index: number;
  onUpdate: (cell: Cell) => void;
  onRun: (id: string) => Promise<void>;
  onRemove: (id: string) => void;
  running: boolean;
}) {
  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({ ...cell, source: e.target.value, outputs: cell.outputs });
    },
    [cell, onUpdate]
  );

  const handleRun = useCallback(() => {
    void onRun(cell.id);
  }, [onRun, cell.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun]
  );

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-400">code · {cell.profile ?? 'classical'}</span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleRun}
            disabled={running}
            className="text-xs px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? '▶ …' : '▶ Run'}
          </button>
          <button
            onClick={() => onRemove(cell.id)}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Eliminar
          </button>
        </div>
      </div>
      <textarea
        className="w-full text-sm font-mono border border-gray-100 rounded p-2 bg-gray-50 resize-y min-h-20 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        value={cell.source}
        onChange={handleSourceChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="Escribe código ST aquí… (Ctrl+Enter para ejecutar)"
      />
      <OutputView outputs={cell.outputs} />
    </div>
  );
}

export default function CellEditor({ cell, index, onUpdate, onRun, onRemove, running }: Props) {
  if (cell.type === 'markdown') {
    return (
      <MarkdownCellView
        cell={cell}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />
    );
  }
  return (
    <CodeCellView
      cell={cell as CodeCell}
      index={index}
      onUpdate={onUpdate}
      onRun={onRun}
      onRemove={onRemove}
      running={running}
    />
  );
}
