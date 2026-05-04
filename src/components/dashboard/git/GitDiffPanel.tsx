'use client';

import { useState } from 'react';
import { FileText, Plus, Minus, ChevronRight, ChevronDown } from 'lucide-react';
import { parsePatchToHunks } from './diff-utils';
import type { GitDiffFile } from './schemas';

interface GitDiffPanelProps {
  files: GitDiffFile[];
  truncated: boolean;
  loading?: boolean;
}

export default function GitDiffPanel({ files, truncated, loading }: GitDiffPanelProps) {
  if (loading) {
    return (
      <div className="rounded border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
        Cargando diff…
      </div>
    );
  }
  if (files.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
        Sin cambios entre estos commits.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {truncated && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          El diff fue truncado por tamaño. Algunos archivos muestran solo el primer fragmento.
        </div>
      )}
      {files.map((f) => (
        <DiffFileBlock key={`${f.path}::${f.oldPath ?? ''}`} file={f} />
      ))}
    </div>
  );
}

function statusBadge(status: GitDiffFile['status']) {
  switch (status) {
    case 'added': return { label: '+', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
    case 'removed': return { label: '−', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' };
    case 'renamed': return { label: 'R', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    default: return { label: 'M', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  }
}

function DiffFileBlock({ file }: { file: GitDiffFile }) {
  const [open, setOpen] = useState(true);
  const hunks = open ? parsePatchToHunks(file.patch) : [];
  const badge = statusBadge(file.status);
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.tone}`}>{badge.label}</span>
        <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span className="font-mono truncate text-zinc-800 dark:text-zinc-200 flex-1">
          {file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path}
        </span>
        <span className="shrink-0 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
          <Plus className="h-3 w-3" />{file.additions}
        </span>
        <span className="shrink-0 text-rose-600 dark:text-rose-400 inline-flex items-center gap-0.5">
          <Minus className="h-3 w-3" />{file.deletions}
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 max-h-96 overflow-auto bg-zinc-50 dark:bg-zinc-900/40 font-mono text-[11px]">
          {hunks.length === 0 && (
            <div className="px-2 py-1 text-zinc-500">Sin contenido (¿binario o truncado?).</div>
          )}
          {hunks.map((h, hi) => (
            <div key={hi} className="border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
              <div className="bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{h.header}</div>
              {h.lines.map((l, li) => {
                const tone = l.kind === 'addition'
                  ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200'
                  : l.kind === 'deletion'
                    ? 'bg-rose-50 text-rose-900 dark:bg-rose-900/20 dark:text-rose-200'
                    : l.kind === 'meta'
                      ? 'text-zinc-400 italic'
                      : 'text-zinc-700 dark:text-zinc-300';
                const prefix = l.kind === 'addition' ? '+' : l.kind === 'deletion' ? '-' : ' ';
                return (
                  <div key={li} className={`flex ${tone}`}>
                    <span className="select-none px-1.5 text-zinc-400 w-10 shrink-0 text-right">
                      {l.oldLineNo ?? ''}
                    </span>
                    <span className="select-none px-1.5 text-zinc-400 w-10 shrink-0 text-right">
                      {l.newLineNo ?? ''}
                    </span>
                    <span className="select-none px-1 shrink-0 w-3">{prefix}</span>
                    <span className="whitespace-pre-wrap break-all flex-1">{l.text}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
