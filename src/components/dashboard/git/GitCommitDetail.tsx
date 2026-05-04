'use client';

import { useState } from 'react';
import { ExternalLink, GitBranch, Undo2, Loader2, AlertCircle } from 'lucide-react';
import { authFetch } from '@/services/apiClient';
import { fetchZod } from '@/lib/fetch-zod';
import {
  gitDiffResponseSchema,
  gitRevertResponseSchema,
  gitCheckoutResponseSchema,
  type GitGraphCommit,
  type GitDiffResponse
} from './schemas';
import GitDiffPanel from './GitDiffPanel';

interface GitCommitDetailProps {
  workspaceId: string;
  commit: GitGraphCommit;
  onMutated: () => void;
}

export default function GitCommitDetail({ workspaceId, commit, onMutated }: GitCommitDetailProps) {
  const [diff, setDiff] = useState<GitDiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | 'revert' | 'branch'>(null);
  const [confirm, setConfirm] = useState<null | 'revert' | 'branch'>(null);
  const [branchName, setBranchName] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const headline = commit.message.split('\n')[0] ?? '';
  const body = commit.message.split('\n').slice(1).join('\n').trim();
  const parent = commit.parents[0];

  const loadDiff = async (): Promise<void> => {
    if (!parent) {
      setDiffError('Este commit no tiene parent (initial commit).');
      return;
    }
    setDiffLoading(true);
    setDiffError(null);
    try {
      const url = `/api/workspaces/${encodeURIComponent(workspaceId)}/git/diff?base=${encodeURIComponent(parent)}&head=${encodeURIComponent(commit.sha)}`;
      const data = await fetchZod(url, gitDiffResponseSchema);
      setDiff(data);
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiffLoading(false);
    }
  };

  const doRevert = async (): Promise<void> => {
    setPending('revert');
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: commit.sha })
      });
      const raw = await res.json().catch(() => ({}));
      const parsed = gitRevertResponseSchema.safeParse(raw);
      if (!res.ok || !parsed.success || !parsed.data.ok) {
        const detail = parsed.success ? parsed.data.error : (raw as { error?: string })?.error;
        throw new Error(detail ?? `HTTP ${res.status}`);
      }
      setActionMessage(`Revert creado: ${parsed.data.newSha?.slice(0, 8) ?? ''}. ${parsed.data.filesChanged ?? 0} archivos.`);
      setConfirm(null);
      onMutated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  const doNewBranch = async (): Promise<void> => {
    if (!branchName.trim()) {
      setActionError('Nombre de rama requerido');
      return;
    }
    setPending('branch');
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: commit.sha, mode: 'newBranch', branchName: branchName.trim() })
      });
      const raw = await res.json().catch(() => ({}));
      const parsed = gitCheckoutResponseSchema.safeParse(raw);
      if (!res.ok || !parsed.success || !parsed.data.ok) {
        const detail = parsed.success ? parsed.data.error : (raw as { error?: string })?.error;
        throw new Error(detail ?? `HTTP ${res.status}`);
      }
      setActionMessage(`Rama creada: ${parsed.data.branch}`);
      setConfirm(null);
      setBranchName('');
      onMutated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="space-y-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-500">{commit.shortSha}</span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-600 dark:text-zinc-300">{new Date(commit.date).toLocaleString()}</span>
          {commit.refs.length > 0 && (
            <span className="flex gap-1">
              {commit.refs.map((ref) => (
                <span
                  key={ref}
                  className={`rounded px-1 text-[9px] uppercase ${ref.startsWith('tag:') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}`}
                >
                  {ref}
                </span>
              ))}
            </span>
          )}
          {commit.htmlUrl && (
            <a href={commit.htmlUrl} target="_blank" rel="noreferrer noopener" className="ml-auto text-zinc-400 hover:text-emerald-600">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="text-[11px] text-zinc-500">{commit.authorName} &lt;{commit.authorEmail}&gt;</div>
        <div className="text-zinc-800 dark:text-zinc-200 font-medium">{headline}</div>
        {body && <pre className="whitespace-pre-wrap text-[11px] text-zinc-600 dark:text-zinc-400">{body}</pre>}

        <div className="flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            onClick={() => void loadDiff()}
            disabled={diffLoading || !parent}
            className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title={!parent ? 'Initial commit (sin parent)' : 'Diff vs parent'}
          >
            {diffLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Diff vs parent
          </button>
          <button
            type="button"
            onClick={() => setConfirm('revert')}
            disabled={pending !== null || !parent}
            className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20"
          >
            <Undo2 className="inline h-3 w-3" /> Revertir
          </button>
          <button
            type="button"
            onClick={() => setConfirm('branch')}
            disabled={pending !== null}
            className="rounded border border-emerald-300 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
          >
            <GitBranch className="inline h-3 w-3" /> Rama nueva desde aquí
          </button>
        </div>

        {confirm === 'revert' && (
          <div className="mt-2 rounded border border-rose-300 bg-rose-50 p-2 dark:border-rose-800 dark:bg-rose-900/20">
            <p className="mb-2 text-[11px] text-rose-800 dark:text-rose-200">
              Esto creará un commit nuevo en <code>main</code> que deshace los cambios de <code className="font-mono">{commit.shortSha}</code>. ¿Continuar?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void doRevert()}
                disabled={pending === 'revert'}
                className="rounded bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {pending === 'revert' ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Sí, revertir
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={pending === 'revert'}
                className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {confirm === 'branch' && (
          <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="mb-2 text-[11px] text-emerald-800 dark:text-emerald-200">
              Crear nueva rama apuntando a <code className="font-mono">{commit.shortSha}</code>:
            </p>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/mi-rama"
              disabled={pending === 'branch'}
              className="mb-2 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void doNewBranch()}
                disabled={pending === 'branch' || !branchName.trim()}
                className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending === 'branch' ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Crear
              </button>
              <button
                type="button"
                onClick={() => { setConfirm(null); setBranchName(''); }}
                disabled={pending === 'branch'}
                className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {actionMessage && (
          <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="mt-2 flex items-start gap-1 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> <span className="break-all">{actionError}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {diffError && (
          <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {diffError}
          </div>
        )}
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
          !diffLoading && (
            <div className="rounded border border-dashed border-zinc-300 p-4 text-center text-[11px] text-zinc-500 dark:border-zinc-700">
              Click en &quot;Diff vs parent&quot; para cargar los cambios.
            </div>
          )
        )}
      </div>
    </div>
  );
}
