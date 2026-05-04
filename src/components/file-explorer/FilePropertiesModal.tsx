'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, FileText, Folder as FolderIcon, Loader2, X } from 'lucide-react';
import { authFetch } from '@/services/apiClient';
import type { DocItem } from '@/components/FileExplorer';

interface ManifestResponse {
    id: string;
    name: string | null;
    type: string | null;
    workspaceId: string | null;
    ownerId: string | null;
    folder: string | null;
    mimeType: string | null;
    size: number | null;
    storagePath: string | null;
    storageBackend: string;
    contentHash: string | null;
    version: number | null;
    syncState: string | null;
    updatedAt: string | null;
    signedUrl: string | null;
}

interface GitInfoResponse {
    committedHash?: string | null;
    lastSha?: string | null;
    repoFullName?: string | null;
    lastCommitMessage?: string | null;
    lastCommitAt?: string | null;
}

interface FilePropertiesModalProps {
    doc: DocItem;
    onClose: () => void;
}

const formatBytes = (n: number | null): string => {
    if (n === null || n === undefined) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MiB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`;
};

const formatDate = (s: string | null | undefined): string => {
    if (!s) return '—';
    try { return new Date(s).toLocaleString(); } catch { return s; }
};

export default function FilePropertiesModal({ doc, onClose }: FilePropertiesModalProps) {
    const [manifest, setManifest] = useState<ManifestResponse | null>(null);
    const [git, setGit] = useState<GitInfoResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const m = await authFetch(`/api/sync/manifest?docId=${encodeURIComponent(doc.id)}&includeUrl=false`);
                if (m.ok && !cancelled) setManifest(await m.json() as ManifestResponse);
                else if (!cancelled) setError(`manifest HTTP ${m.status}`);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        // git metadata viene del propio doc (Firestore.git ya está cargado por el dashboard)
        const docGit = (doc as unknown as { git?: GitInfoResponse }).git;
        if (docGit) setGit(docGit);
        return () => { cancelled = true; };
    }, [doc.id, doc]);

    const copy = async (label: string, value: string | null | undefined) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = setTimeout(() => setCopied(null), 1200);
        } catch { /* noop */ }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-12 px-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Propiedades"
        >
            <div
                className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {doc.type === 'folder' ? <FolderIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        Propiedades
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Cerrar">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 text-xs space-y-3 max-h-[70vh]">
                    {error && (
                        <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    <Section title="General">
                        <Field label="Nombre" value={doc.name ?? manifest?.name ?? '—'} onCopy={(v) => copy('name', v)} copied={copied === 'name'} />
                        <Field label="Tipo" value={doc.type ?? manifest?.type ?? '—'} />
                        <Field label="Carpeta" value={(doc.folder || manifest?.folder) ?? '(raíz)'} />
                        <Field label="MIME" value={manifest?.mimeType ?? null} />
                        <Field label="Tamaño" value={formatBytes(manifest?.size ?? null)} />
                        <Field label="Modificado" value={formatDate(manifest?.updatedAt)} />
                    </Section>

                    <Section title="Almacenamiento (NAS / MinIO)">
                        {loading && <div className="flex items-center gap-2 text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" /> Cargando…</div>}
                        {!loading && (
                            <>
                                <Field label="Backend" value={manifest?.storageBackend ?? '—'} />
                                <Field label="Path en bucket" value={manifest?.storagePath ?? null} mono onCopy={(v) => copy('storagePath', v)} copied={copied === 'storagePath'} />
                                <Field label="contentHash (sha256)" value={manifest?.contentHash ?? null} mono small onCopy={(v) => copy('hash', v)} copied={copied === 'hash'} />
                                <Field label="Version" value={manifest?.version !== null && manifest?.version !== undefined ? String(manifest.version) : '—'} />
                                <Field label="Sync state" value={manifest?.syncState ?? '—'} />
                            </>
                        )}
                    </Section>

                    {git && (git.committedHash || git.lastSha || git.repoFullName) && (
                        <Section title="Git (Forgejo)">
                            <Field label="Repo" value={git.repoFullName ?? null} />
                            <Field label="Último commit" value={git.lastCommitMessage ?? null} />
                            <Field label="Fecha commit" value={formatDate(git.lastCommitAt)} />
                            <Field label="committedHash" value={git.committedHash ?? null} mono small onCopy={(v) => copy('git-hash', v)} copied={copied === 'git-hash'} />
                            <Field label="lastSha" value={git.lastSha ?? null} mono small onCopy={(v) => copy('git-sha', v)} copied={copied === 'git-sha'} />
                        </Section>
                    )}

                    <Section title="Identidad">
                        <Field label="docId Firestore" value={doc.id} mono small onCopy={(v) => copy('docId', v)} copied={copied === 'docId'} />
                        <Field label="workspaceId" value={manifest?.workspaceId ?? null} mono small />
                        <Field label="ownerId" value={manifest?.ownerId ?? null} mono small />
                    </Section>
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-1.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
            <div className="space-y-1">{children}</div>
        </section>
    );
}

interface FieldProps {
    label: string;
    value: string | null | undefined;
    mono?: boolean;
    small?: boolean;
    onCopy?: (v: string | null | undefined) => void;
    copied?: boolean;
    rightSlot?: React.ReactNode;
}

function Field({ label, value, mono, small, onCopy, copied, rightSlot }: FieldProps) {
    const display = value === null || value === undefined || value === '' ? '—' : value;
    const isEmpty = display === '—';
    return (
        <div className="grid grid-cols-[110px_1fr] gap-2">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500 self-start pt-0.5">{label}</span>
            <div className={`flex items-start gap-1 rounded ${isEmpty ? '' : 'bg-zinc-50 px-1.5 py-0.5 dark:bg-zinc-900'}`}>
                <span className={`flex-1 break-all ${mono ? 'font-mono' : ''} ${small ? 'text-[10px]' : ''} text-zinc-700 dark:text-zinc-200`}>
                    {display}
                </span>
                {!isEmpty && onCopy && (
                    <button type="button" onClick={() => onCopy(value)} className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800" aria-label="Copiar">
                        <Copy className="h-3 w-3" />
                    </button>
                )}
                {!isEmpty && copied && <span className="text-[9px] text-emerald-700 dark:text-emerald-400">copiado</span>}
                {rightSlot}
            </div>
        </div>
    );
}

// Para facilitar reutilización: si un caller quiere abrir el blob en MinIO,
// puede generar un signed URL con includeUrl=true en el manifest. Para evitar
// pedirlo siempre, lo dejamos opcional vía un botón aparte si el user pide
// "abrir blob". Por ahora basta con copiar el storagePath.
export { ExternalLink };
