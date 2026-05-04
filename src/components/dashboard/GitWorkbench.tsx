'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    GitBranch, GitCommit, RefreshCcw, AlertCircle, Check, History,
    FileText, FilePlus, Loader2, ExternalLink, Plus, GitCompare
} from 'lucide-react';
import GitGraphPanel from '@/components/dashboard/git/GitGraphPanel';
import GitCommitDetail from '@/components/dashboard/git/GitCommitDetail';
import GitComparePanel from '@/components/dashboard/git/GitComparePanel';
import { gitGraphResponseSchema, type GitGraphCommit } from '@/components/dashboard/git/schemas';
import { useAuth } from '@/context/AuthContext';
import { fetchZod } from '@/lib/fetch-zod';
import { gitWorkbenchStatusSchema, gitWorkbenchCommitsSchema } from '@agora/contracts';
import { authFetch } from '@/services/apiClient';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

const GITIGNORE_TEMPLATE = `# .gitignore — reglas para excluir archivos del commit Git.
# Una regla por línea, formato gitignore estándar.
# Ejemplos (descomenta los que apliquen):

# node_modules/
# .next/
# dist/
# build/
# *.log
# .env
# .env.local
# .DS_Store
`;

interface GitInfo {
    provisioned: boolean;
    workspaceId: string;
    repoFullName?: string | null;
    cloneUrl?: string | null;
    sshUrl?: string | null;
    htmlUrl?: string | null;
}

interface ProvisionResult {
    ok: boolean;
    repo: { fullName: string; htmlUrl: string; cloneUrl: string; sshUrl: string };
    forgejoLogin: string;
    token: string | null;
    tokenName: string | null;
}

interface StatusItem {
    docId: string;
    repoPath: string;
    name: string | null;
    folder: string | null;
    size: number | null;
    type: string | null;
    currentHash: string | null;
    committedHash: string | null;
    lastSha: string | null;
    status: 'clean' | 'modified' | 'new';
}

interface CommitInfo {
    sha: string;
    shortSha: string;
    message: string;
    authorName: string;
    authorEmail: string;
    date: string;
    htmlUrl: string;
}

interface GitWorkbenchProps {
    workspaceId: string;
    workspaceName?: string;
    onClose?: () => void;
}

type Tab = 'changes' | 'history' | 'compare';

export default function GitWorkbench({ workspaceId, workspaceName }: GitWorkbenchProps) {
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('changes');
    const [info, setInfo] = useState<GitInfo | null>(null);
    const [items, setItems] = useState<StatusItem[]>([]);
    const [commits, setCommits] = useState<CommitInfo[]>([]);
    const [graphCommits, setGraphCommits] = useState<GitGraphCommit[]>([]);
    const [selectedSha, setSelectedSha] = useState<string | null>(null);
    const [staged, setStaged] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<{
        phase: 'commit' | 'persist';
        current: number;
        total: number;
        label: string;
    } | null>(null);
    const [revealedToken, setRevealedToken] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const loadInfo = useCallback(async () => {
        const res = await authFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/git-info`);
        if (!res.ok) throw new Error(`git-info HTTP ${res.status}`);
        return (await res.json()) as GitInfo;
    }, [workspaceId]);

    const loadStatus = useCallback(async () => {
        const data = await fetchZod(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/status`, gitWorkbenchStatusSchema);
        return data.items ?? [];
    }, [workspaceId]);

    const loadLog = useCallback(async () => {
        try {
            const data = await fetchZod(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/log?limit=30`, gitWorkbenchCommitsSchema);
            return data.commits ?? [];
        } catch {
            return [];
        }
    }, [workspaceId]);

    const loadGraph = useCallback(async (): Promise<GitGraphCommit[]> => {
        try {
            const data = await fetchZod(
                `/api/workspaces/${encodeURIComponent(workspaceId)}/git/graph?limit=50`,
                gitGraphResponseSchema
            );
            return data.commits;
        } catch {
            return [];
        }
    }, [workspaceId]);

    const refreshAll = useCallback(async () => {
        if (!user || !workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const inf = await loadInfo();
            setInfo(inf);
            if (inf.provisioned) {
                const [it, log, graph] = await Promise.all([loadStatus(), loadLog(), loadGraph()]);
                setItems(it);
                setCommits(log);
                setGraphCommits(graph);
                setSelectedSha((prev) => {
                    if (prev && graph.some((c) => c.sha === prev)) return prev;
                    return graph[0]?.sha ?? null;
                });
            } else {
                setItems([]);
                setCommits([]);
                setGraphCommits([]);
                setSelectedSha(null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [user, workspaceId, loadInfo, loadStatus, loadLog, loadGraph]);

    useEffect(() => { void refreshAll(); }, [refreshAll]);

    // Limpia `staged` Set cuando `items` cambia: si un docId staged ya no
    // aparece en items (ej. cambió a 'clean' tras un commit externo, o el doc
    // se borró), lo eliminamos del Set para no enviarlo al commit.
    useEffect(() => {
        setStaged(prev => {
            const validIds = new Set(items.map(i => i.docId));
            const next = new Set([...prev].filter(id => validIds.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [items]);

    const provision = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await authFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/provision-git`, { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as ProvisionResult;
            if (data.token) setRevealedToken(data.token);
            await refreshAll();
            setToast('Repositorio creado.');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally { setBusy(false); }
    }, [workspaceId, refreshAll]);

    const hasGitignore = useMemo(
        () => items.some(i => i.repoPath === '.gitignore' || i.repoPath.endsWith('/.gitignore')),
        [items]
    );

    const ensureGitignore = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            // Workspace personal en Firestore es '__personal__' (no 'personal:<uid>').
            const wsForApi = workspaceId.startsWith('personal:') ? PERSONAL_WORKSPACE_ID : workspaceId;
            const res = await authFetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: '.gitignore',
                    content: GITIGNORE_TEMPLATE,
                    type: 'text',
                    mimeType: 'text/plain',
                    workspaceId: wsForApi,
                    folder: ''
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            // Dispara el evento global que el dashboard escucha para refrescar
            // la jerarquía sin recargar la página (mismo bus que usa MosaicEditor).
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('agora:docs-changed'));
            }
            await refreshAll();
            setToast('.gitignore creado en la raíz. Búscalo en el explorador para editarlo.');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally { setBusy(false); }
    }, [workspaceId, refreshAll]);

    const stageAll = useCallback(() => {
        const dirty = items.filter(i => i.status !== 'clean').map(i => i.docId);
        setStaged(new Set(dirty));
    }, [items]);

    const unstageAll = useCallback(() => setStaged(new Set()), []);

    const toggleStaged = useCallback((docId: string) => {
        setStaged(prev => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId); else next.add(docId);
            return next;
        });
    }, []);

    const doCommit = useCallback(async () => {
        if (!user) { setError('No hay usuario autenticado.'); return; }
        if (staged.size === 0) { setError('Selecciona al menos un archivo en stage.'); return; }
        if (!message.trim()) { setError('Escribe un mensaje de commit.'); return; }
        setBusy(true);
        setError(null);
        setProgress({ phase: 'commit', current: 0, total: 1, label: 'Preparando…' });

        try {
            // 1) Token Forgejo del user (cache en localStorage para no regenerar).
            const TOKEN_KEY = `agora_forgejo_token_${user.uid}`;
            let forgejoToken = localStorage.getItem(TOKEN_KEY) ?? '';
            if (!forgejoToken) {
                setProgress({ phase: 'commit', current: 0, total: 1, label: 'Emitiendo token…' });
                const tr = await authFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/issue-token`, { method: 'POST' });
                if (!tr.ok) throw new Error(`No se pudo obtener token: HTTP ${tr.status}`);
                const td = await tr.json();
                forgejoToken = td.token;
                if (!forgejoToken) throw new Error('Token vacío del servidor.');
                localStorage.setItem(TOKEN_KEY, forgejoToken);
            }

            // 2) Resolver info de cada doc: signed URL MinIO + repoPath + sha existente.
            const stagedItems = items.filter(i => staged.has(i.docId));
            if (stagedItems.length === 0) throw new Error('No hay archivos válidos en el stage.');

            // Resolver datos del repo (URL Forgejo + commits previos para mostrar info).
            const infoRes = await authFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/git-info`);
            if (!infoRes.ok) throw new Error(`git-info HTTP ${infoRes.status}`);
            const info = await infoRes.json() as { cloneUrl?: string; repoFullName?: string };
            const repoApiBase = info.cloneUrl?.replace(/^https:\/\/([^/]+)\/(.+)\.git$/, 'https://$1/api/v1/repos/$2');
            if (!repoApiBase) throw new Error('No se pudo derivar la URL API del repo.');

            // 3) Sub-función: descargar blob de MinIO via signed URL.
            const fetchBlob = async (docId: string): Promise<{ buf: ArrayBuffer; size: number; contentHash: string } | null> => {
                const r = await authFetch(`/api/sync/signed-url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ op: 'get', docId })
                });
                if (!r.ok) return null;
                const { url } = await r.json() as { url: string };
                const blob = await fetch(url);
                if (!blob.ok) return null;
                const buf = await blob.arrayBuffer();
                const hash = await crypto.subtle.digest('SHA-256', buf);
                const contentHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
                return { buf, size: buf.byteLength, contentHash };
            };

            const arrayBufferToBase64 = (ab: ArrayBuffer): string => {
                const bytes = new Uint8Array(ab);
                let binary = '';
                const CHUNK = 0x8000;
                for (let i = 0; i < bytes.length; i += CHUNK) {
                    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
                }
                return btoa(binary);
            };

            // 4) Chunking: max 10 archivos / 30 MB por chunk para no saturar Forgejo.
            const MAX_FILES = 10;
            const MAX_BYTES = 30 * 1024 * 1024;

            type Plan = { docId: string; repoPath: string; size: number; lastSha?: string };
            const plans: Plan[] = stagedItems.map(it => ({
                docId: it.docId,
                repoPath: it.repoPath,
                size: it.size ?? 0,
                lastSha: it.lastSha ?? undefined
            }));

            const chunks: Plan[][] = [];
            let cur: Plan[] = []; let curSz = 0;
            for (const p of plans) {
                const sz = Math.max(p.size, 1024);
                if (cur.length > 0 && (cur.length >= MAX_FILES || curSz + sz > MAX_BYTES)) {
                    chunks.push(cur); cur = []; curSz = 0;
                }
                cur.push(p); curSz += sz;
            }
            if (cur.length > 0) chunks.push(cur);

            setProgress({ phase: 'commit', current: 0, total: chunks.length, label: `Subiendo ${stagedItems.length} archivo(s) en ${chunks.length} parte(s)…` });

            // 5) Procesar cada chunk: descargar blobs, armar payload, POST a Forgejo, persist.
            const persistEntries: Array<{ docId: string; repoPath: string; contentHash: string; lastSha?: string; size: number; commitSha?: string; message: string }> = [];
            const errors: Array<{ path: string; status: number; raw: string }> = [];

            for (let ci = 0; ci < chunks.length; ci++) {
                const chunk = chunks[ci];
                const partMessage = chunks.length === 1 ? message.trim() : `${message.trim()} (parte ${ci + 1}/${chunks.length})`;
                setProgress({ phase: 'commit', current: ci, total: chunks.length, label: `Parte ${ci + 1}/${chunks.length}: descargando…` });

                // Descargar blobs en paralelo (max 4 simultáneos para no saturar al cliente).
                const blobs: Array<{ p: Plan; buf: ArrayBuffer; size: number; contentHash: string } | null> = [];
                const PAR = 4;
                for (let i = 0; i < chunk.length; i += PAR) {
                    const slice = chunk.slice(i, i + PAR);
                    const out = await Promise.all(slice.map(async p => {
                        const b = await fetchBlob(p.docId);
                        if (!b) return null;
                        return { p, ...b };
                    }));
                    blobs.push(...out);
                }

                const files = blobs
                    .filter((b): b is { p: Plan; buf: ArrayBuffer; size: number; contentHash: string } => b !== null)
                    .map(b => ({
                        path: b.p.repoPath,
                        operation: b.p.lastSha ? 'update' : 'create',
                        content: arrayBufferToBase64(b.buf),
                        ...(b.p.lastSha ? { sha: b.p.lastSha } : {})
                    }));

                if (files.length === 0) {
                    errors.push({ path: '(chunk)', status: 0, raw: 'no se pudo descargar ningún archivo de este chunk' });
                    continue;
                }

                setProgress({ phase: 'commit', current: ci, total: chunks.length, label: `Parte ${ci + 1}/${chunks.length}: subiendo a Forgejo (${files.length} archivos)…` });

                // POST por archivo individual a /contents/<path>. Permite que
                // 1 colisión no aborte 39 commits exitosos. Auto-retry como
                // update si Forgejo dice "already exists".
                const successfulBlobs: typeof blobs = [];
                let commitSha: string | undefined;
                for (let fi = 0; fi < files.length; fi++) {
                    const f = files[fi];
                    const blob = blobs.filter((x): x is NonNullable<typeof x> => x !== null).find(b => b.p.repoPath === f.path);
                    if (!blob) continue;
                    setProgress({ phase: 'commit', current: ci, total: chunks.length, label: `Parte ${ci + 1}/${chunks.length}: archivo ${fi + 1}/${files.length}…` });

                    const singleBody: Record<string, unknown> = {
                        content: f.content,
                        branch: 'main',
                        message: partMessage
                    };
                    if (f.sha) singleBody.sha = f.sha;

                    const url = `${repoApiBase}/contents/${encodeURI(f.path)}`;
                    let fr2 = await fetch(url, {
                        method: f.operation === 'update' ? 'PUT' : 'POST',
                        headers: { 'Authorization': `token ${forgejoToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(singleBody)
                    });

                    // Si "already exists" en create → resolver sha y reintentar como update.
                    if (fr2.status === 422 && f.operation === 'create') {
                        try {
                            const meta = await fetch(`${url}?ref=main`, { headers: { 'Authorization': `token ${forgejoToken}` } });
                            if (meta.ok) {
                                const m = await meta.json() as { sha?: string };
                                if (m.sha) {
                                    fr2 = await fetch(url, {
                                        method: 'PUT',
                                        headers: { 'Authorization': `token ${forgejoToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ ...singleBody, sha: m.sha })
                                    });
                                }
                            }
                        } catch { /* deja el 422 original */ }
                    }

                    if (fr2.status === 401) {
                        localStorage.removeItem(TOKEN_KEY);
                        throw new Error('Token Forgejo inválido. Reintenta — se emitirá uno nuevo.');
                    }

                    if (!fr2.ok) {
                        const txt = await fr2.text();
                        console.warn('[git/commit] fail', f.path, 'status=', fr2.status, 'raw:', txt.slice(0, 300));
                        errors.push({ path: f.path, status: fr2.status, raw: txt.slice(0, 200) });
                        continue;
                    }

                    const result = await fr2.json() as { commit?: { sha: string } };
                    if (result.commit?.sha) commitSha = result.commit.sha;
                    successfulBlobs.push(blob);
                }

                for (const b of successfulBlobs) {
                    if (!b) continue;
                    persistEntries.push({
                        docId: b.p.docId,
                        repoPath: b.p.repoPath,
                        contentHash: b.contentHash,
                        size: b.size,
                        commitSha,
                        message: partMessage
                    });
                }

                // Persist parcial cada chunk para no perder progreso si algo falla luego.
                if (persistEntries.length > 0) {
                    setProgress({ phase: 'persist', current: ci + 1, total: chunks.length, label: `Parte ${ci + 1}/${chunks.length}: actualizando metadata…` });
                    await authFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/persist-commit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ commits: persistEntries.splice(0) })
                    }).catch(err => console.warn('persist-commit failed for chunk', ci, err));
                }

                setProgress({ phase: 'commit', current: ci + 1, total: chunks.length, label: `Parte ${ci + 1}/${chunks.length} OK` });
            }

            const okCount = stagedItems.length - errors.length;
            const errsDetail = errors.length
                ? ` Fallaron: ${errors.slice(0, 3).map(e => `${e.path} (${e.status})`).join(', ')}${errors.length > 3 ? '…' : ''}`
                : '';
            setToast(`Commit terminado: ${okCount}/${stagedItems.length} archivos${errors.length > 0 ? ` (${errors.length} fallaron)` : ''}.${errsDetail}`);
            setMessage('');
            setStaged(new Set());
            await refreshAll();
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            await refreshAll().catch(() => undefined);
        } finally {
            setBusy(false);
            setProgress(null);
        }
    }, [workspaceId, staged, message, items, user, refreshAll]);

    const dirty = useMemo(() => items.filter(i => i.status !== 'clean'), [items]);
    const stagedItems = useMemo(() => dirty.filter(i => staged.has(i.docId)), [dirty, staged]);
    const unstagedItems = useMemo(() => dirty.filter(i => !staged.has(i.docId)), [dirty, staged]);

    if (!user) return null;

    return (
        <div className="flex flex-col h-full min-h-0 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <GitBranch className="h-4 w-4" aria-hidden />
                    <span>Git · <span className="text-emerald-600 dark:text-emerald-400">{workspaceName ?? workspaceId}</span></span>
                </div>
                <div className="flex items-center gap-2">
                    {info?.provisioned && !hasGitignore && (
                        <button
                            type="button"
                            onClick={ensureGitignore}
                            disabled={busy || loading}
                            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                            title="Crea un .gitignore en la raíz del workspace para excluir archivos del commit"
                        >
                            + .gitignore
                        </button>
                    )}
                    {info?.htmlUrl && (
                        <a href={info.htmlUrl} target="_blank" rel="noreferrer noopener" className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Abrir en Forgejo">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                        </a>
                    )}
                    <button type="button" onClick={refreshAll} disabled={loading || busy} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800" aria-label="Recargar">
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                    </button>
                </div>
            </div>

            {error && (
                <div role="alert" className="mx-3 mt-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="break-all">{error}</span>
                </div>
            )}
            {toast && (
                <div className="mx-3 mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                    {toast}
                </div>
            )}

            {info && !info.provisioned && (
                <div className="p-4 text-xs text-zinc-600 dark:text-zinc-400">
                    <p className="mb-3">Este workspace aún no tiene repositorio Git creado. Cada workspace = un proyecto separado en Forgejo.</p>
                    <button type="button" onClick={provision} disabled={busy} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                        {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : <Plus className="inline h-3 w-3" />}{' '}Crear repositorio
                    </button>
                </div>
            )}

            {info?.provisioned && (
                <>
                    {/* Tabs */}
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs">
                        <button type="button" onClick={() => setTab('changes')} className={`flex items-center gap-1 px-3 py-2 transition ${tab === 'changes' ? 'border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                            <GitCommit className="h-3.5 w-3.5" /> Cambios <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] dark:bg-zinc-800">{dirty.length}</span>
                        </button>
                        <button type="button" onClick={() => setTab('history')} className={`flex items-center gap-1 px-3 py-2 transition ${tab === 'history' ? 'border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                            <History className="h-3.5 w-3.5" /> Historial
                        </button>
                        <button type="button" onClick={() => setTab('compare')} className={`flex items-center gap-1 px-3 py-2 transition ${tab === 'compare' ? 'border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                            <GitCompare className="h-3.5 w-3.5" /> Comparar
                        </button>
                    </div>

                    {tab === 'changes' && (
                        <div className="space-y-2 border-b border-zinc-200 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Mensaje del commit"
                                disabled={busy}
                                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                            />
                            <button
                                type="button"
                                onClick={doCommit}
                                disabled={busy || staged.size === 0 || !message.trim()}
                                className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommit className="h-3.5 w-3.5" />}
                                Confirmar {staged.size} archivo{staged.size !== 1 ? 's' : ''}
                            </button>
                            {progress && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-zinc-600 dark:text-zinc-400">
                                        <span>{progress.label}</span>
                                        <span>{progress.current}/{progress.total}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-300"
                                            style={{ width: `${progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'changes' && (
                        <div className="flex-1 overflow-y-auto px-3 py-2">
                            <div className="space-y-3 text-xs">
                                {dirty.length === 0 && !loading && (
                                    <div className="rounded border border-dashed border-zinc-300 p-4 text-center text-zinc-500 dark:border-zinc-700">
                                        <Check className="mx-auto mb-1 h-5 w-5" /> Sin cambios pendientes.
                                    </div>
                                )}
                                {stagedItems.length > 0 && (
                                    <Section title="Staged (se incluirán en el commit)" count={stagedItems.length} actionLabel="Quitar todos" onAction={unstageAll}>
                                        {stagedItems.map((it) => (
                                            <FileRow key={it.docId} item={it} staged onToggle={toggleStaged} />
                                        ))}
                                    </Section>
                                )}
                                {unstagedItems.length > 0 && (
                                    <Section title="Cambios sin stage" count={unstagedItems.length} actionLabel="Agregar todos al stage" onAction={stageAll}>
                                        {unstagedItems.map((it) => (
                                            <FileRow key={it.docId} item={it} staged={false} onToggle={toggleStaged} />
                                        ))}
                                    </Section>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'history' && (
                        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
                            <div className="md:w-[42%] md:max-w-[460px] md:min-w-[280px] md:border-r md:border-zinc-200 dark:md:border-zinc-800 overflow-y-auto">
                                {graphCommits.length === 0 && !loading ? (
                                    <div className="m-3 rounded border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
                                        Sin commits aún.
                                    </div>
                                ) : graphCommits.length === 0 && commits.length > 0 ? (
                                    <div className="space-y-1.5 p-3 text-xs">
                                        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                                            Vista grafo no disponible — fallback a lista plana.
                                        </div>
                                        {commits.map((c) => (
                                            <a key={c.sha} href={c.htmlUrl} target="_blank" rel="noreferrer noopener" className="block rounded border border-zinc-200 p-2 hover:border-emerald-400 dark:border-zinc-800 dark:hover:border-emerald-600">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono text-[11px] text-zinc-500">{c.shortSha}</span>
                                                    <span className="text-[10px] text-zinc-500">{new Date(c.date).toLocaleString()}</span>
                                                </div>
                                                <div className="mt-0.5 truncate text-zinc-800 dark:text-zinc-200">{c.message.split('\n')[0]}</div>
                                                <div className="mt-0.5 text-[10px] text-zinc-500">{c.authorName}</div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <GitGraphPanel
                                        commits={graphCommits}
                                        selectedSha={selectedSha}
                                        onSelect={setSelectedSha}
                                    />
                                )}
                            </div>
                            <div className="flex-1 min-h-0 min-w-0 border-t border-zinc-200 md:border-t-0 dark:border-zinc-800">
                                {selectedSha && graphCommits.length > 0 ? (
                                    (() => {
                                        const sel = graphCommits.find((c) => c.sha === selectedSha);
                                        if (!sel) return null;
                                        return (
                                            <GitCommitDetail
                                                workspaceId={workspaceId}
                                                commit={sel}
                                                onMutated={() => { void refreshAll(); }}
                                            />
                                        );
                                    })()
                                ) : (
                                    <div className="m-3 rounded border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
                                        Selecciona un commit en el grafo.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'compare' && (
                        <div className="flex-1 min-h-0">
                            <GitComparePanel workspaceId={workspaceId} commits={graphCommits.length > 0 ? graphCommits : commits.map((c) => ({
                                sha: c.sha,
                                shortSha: c.shortSha,
                                parents: [],
                                message: c.message,
                                authorName: c.authorName,
                                authorEmail: c.authorEmail,
                                date: c.date,
                                htmlUrl: c.htmlUrl,
                                refs: []
                            }))} />
                        </div>
                    )}

                    {revealedToken && (
                        <div className="m-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-700 dark:bg-amber-900/20">
                            <div className="mb-1 font-medium text-amber-800 dark:text-amber-300">Token de acceso (mostrado solo una vez)</div>
                            <code className="block break-all font-mono text-[11px] text-amber-900 dark:text-amber-200">{revealedToken}</code>
                            <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">Úsalo como password en git push HTTPS.</div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Section({ title, count, actionLabel, onAction, children }: {
    title: string;
    count: number;
    actionLabel: string;
    onAction: () => void;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
                <span>{title} ({count})</span>
                <button type="button" onClick={onAction} className="text-emerald-600 hover:underline dark:text-emerald-400">{actionLabel}</button>
            </div>
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

function FileRow({ item, staged, onToggle }: { item: StatusItem; staged: boolean; onToggle: (id: string) => void }) {
    const Icon = item.status === 'new' ? FilePlus : FileText;
    const tone = item.status === 'new' ? 'text-emerald-600 dark:text-emerald-400'
        : item.status === 'modified' ? 'text-amber-600 dark:text-amber-400'
            : 'text-zinc-500';
    return (
        <button type="button" onClick={() => onToggle(item.docId)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${staged ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
            <input type="checkbox" checked={staged} readOnly className="h-3 w-3 accent-emerald-600" />
            <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} aria-hidden />
            <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200">{item.repoPath}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${tone}`}>
                {item.status === 'new' ? 'nuevo' : item.status === 'modified' ? 'modif' : 'limpio'}
            </span>
        </button>
    );
}
