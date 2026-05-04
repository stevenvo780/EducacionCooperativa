'use client';

import { useState } from 'react';
import { Loader2, GitCompare } from 'lucide-react';
import { fetchZod } from '@/lib/fetch-zod';
import GitDiffPanel from './GitDiffPanel';
import { gitDiffResponseSchema, type GitGraphCommit, type GitDiffResponse } from './schemas';

interface GitComparePanelProps {
  workspaceId: string;
  commits: readonly GitGraphCommit[];
}

export default function GitComparePanel({ workspaceId, commits }: GitComparePanelProps) {
  const [base, setBase] = useState<string>('');
  const [head, setHead] = useState<string>('');
  const [diff, setDiff] = useState<GitDiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    if (!base || !head) {
      setError('Selecciona base y head');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/workspaces/${encodeURIComponent(workspaceId)}/git/diff?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`;
      const data = await fetchZod(url, gitDiffResponseSchema);
      setDiff(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDiff(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="space-y-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="text-[11px] text-zinc-500">Compara los cambios entre dos commits cualquiera del repo.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Base</span>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              disabled={loading}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— elegir —</option>
              {commits.map((c) => (
                <option key={c.sha} value={c.sha}>
                  {c.shortSha} · {c.message.split('\n')[0]?.slice(0, 50) ?? ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Head</span>
            <select
              value={head}
              onChange={(e) => setHead(e.target.value)}
              disabled={loading}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— elegir —</option>
              {commits.map((c) => (
                <option key={c.sha} value={c.sha}>
                  {c.shortSha} · {c.message.split('\n')[0]?.slice(0, 50) ?? ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !base || !head}
            className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : <GitCompare className="inline h-3 w-3" />} Comparar
          </button>
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {diff ? (
          <>
            <div className="mb-2 text-[11px] text-zinc-500">
              {diff.stats.totalFiles} archivo{diff.stats.totalFiles !== 1 ? 's' : ''} ·{' '}
              <span className="text-emerald-600 dark:text-emerald-400">+{diff.stats.totalAdditions}</span>{' '}
              <span className="text-rose-600 dark:text-rose-400">−{diff.stats.totalDeletions}</span>
            </div>
            <GitDiffPanel files={diff.files} truncated={diff.truncated} />
          </>
        ) : (
          !loading && !error && (
            <div className="rounded border border-dashed border-zinc-300 p-4 text-center text-[11px] text-zinc-500 dark:border-zinc-700">
              Selecciona base y head, luego &quot;Comparar&quot;.
            </div>
          )
        )}
      </div>
    </div>
  );
}
