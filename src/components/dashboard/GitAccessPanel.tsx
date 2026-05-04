'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, RefreshCcw, Terminal, X, Check, Download } from 'lucide-react';
import { fetchZod } from '@/lib/fetch-zod';
import { gitMeResponseSchema } from '@agora/contracts';
import { authFetch } from '@/services/apiClient';

interface GitMeResponse {
    login: string;
    webUrl: string | null;
    apiUrl: string | null;
    org: string;
    repos: Array<{
        fullName: string;
        cloneUrl: string | null;
        sshUrl: string | null;
        htmlUrl: string | null;
        private: boolean | null;
    }>;
}

interface IssuedToken {
    login: string;
    token: string;
    tokenName: string;
}

interface GitAccessPanelProps {
    onClose?: () => void;
}

export default function GitAccessPanel({ onClose }: GitAccessPanelProps) {
    const [info, setInfo] = useState<GitMeResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [issuedToken, setIssuedToken] = useState<IssuedToken | null>(null);
    const [showToken, setShowToken] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [importName, setImportName] = useState('');
    const [importToken, setImportToken] = useState('');
    const [importBusy, setImportBusy] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    useEffect(() => () => {
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchZod('/api/git/me', gitMeResponseSchema);
            setInfo(data as GitMeResponse);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const issueToken = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await authFetch('/api/git/me', { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setIssuedToken({ login: data.login, token: data.token, tokenName: data.tokenName });
            setShowToken(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally { setBusy(false); }
    };

    const copy = async (label: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = setTimeout(() => setCopied(null), 1500);
        } catch { /* noop */ }
    };

    const submitImport = async () => {
        const url = importUrl.trim();
        if (!url) { setImportError('URL requerida'); return; }
        setImportBusy(true);
        setImportError(null);
        try {
            const res = await authFetch('/api/git/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    name: importName.trim() || undefined,
                    authToken: importToken.trim() || undefined,
                    private: true,
                    mirror: false
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
            setImportOpen(false);
            setImportUrl(''); setImportName(''); setImportToken('');
            await load();
        } catch (e) {
            setImportError(e instanceof Error ? e.message : String(e));
        } finally { setImportBusy(false); }
    };

    const buildAuthedClone = (cloneUrl: string | null, login: string, token: string) => {
        if (!cloneUrl) return '';
        return cloneUrl.replace(/^https?:\/\//, (proto) => `${proto}${encodeURIComponent(login)}:${encodeURIComponent(token)}@`);
    };

    return (
        <div className="flex h-full flex-col bg-zinc-50 text-sm dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    <KeyRound className="h-4 w-4" /> Acceso Git
                </div>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={load} disabled={loading || busy} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800" aria-label="Recargar">
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {onClose && (
                        <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Cerrar">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div role="alert" className="mx-3 mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 text-xs">
                {loading && !info && (
                    <div className="flex items-center gap-2 text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
                )}

                {info && (
                    <>
                        <section className="mb-4 space-y-2 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tu cuenta Forgejo</h3>
                            <Field label="Usuario" value={info.login} onCopy={(v) => copy('login', v)} copied={copied === 'login'} />
                            {info.webUrl && (
                                <Field
                                    label="URL del servidor"
                                    value={info.webUrl}
                                    rightSlot={
                                        <a href={info.webUrl} target="_blank" rel="noreferrer noopener" className="rounded p-1 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20" aria-label="Abrir Forgejo">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    }
                                    onCopy={(v) => copy('webUrl', v)}
                                    copied={copied === 'webUrl'}
                                />
                            )}
                            <p className="text-[11px] text-zinc-500">
                                Inicia sesión en Forgejo con tu usuario y un token (botón abajo). El token actúa como contraseña para git y la web.
                            </p>
                        </section>

                        <section className="mb-4 space-y-3 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Token de acceso</h3>
                                <button type="button" onClick={issueToken} disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                                    {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : '+'} Generar token nuevo
                                </button>
                            </div>
                            {!issuedToken && (
                                <p className="text-[11px] text-zinc-500">
                                    Cada vez que generas uno, los anteriores siguen activos. Revócalos desde la web de Forgejo si quieres.
                                </p>
                            )}
                            {issuedToken && (
                                <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-900/20">
                                    <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                                        Guárdalo ahora. Solo se muestra una vez.
                                    </p>
                                    <div className="flex items-center gap-1 rounded bg-zinc-900 px-2 py-1 font-mono text-[11px] text-emerald-300 dark:bg-zinc-950">
                                        <span className="flex-1 truncate">{showToken ? issuedToken.token : '•'.repeat(40)}</span>
                                        <button type="button" onClick={() => setShowToken((v) => !v)} className="rounded p-1 text-zinc-300 hover:bg-zinc-800" aria-label="Mostrar/ocultar">
                                            {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                        </button>
                                        <button type="button" onClick={() => copy('token', issuedToken.token)} className="rounded p-1 text-zinc-300 hover:bg-zinc-800" aria-label="Copiar">
                                            <Copy className="h-3 w-3" />
                                        </button>
                                    </div>
                                    {copied === 'token' && <p className="text-[10px] text-emerald-700 dark:text-emerald-400">Copiado.</p>}
                                    <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
                                        Nombre: <code>{issuedToken.tokenName}</code>
                                    </p>
                                </div>
                            )}
                        </section>

                        <section className="space-y-2 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Repositorios ({info.repos.length})
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => { setImportOpen(true); setImportError(null); }}
                                    className="flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-700"
                                >
                                    <Download className="h-3 w-3" /> Importar repo
                                </button>
                            </div>
                            {importOpen && (
                                <div className="space-y-2 rounded border border-sky-300 bg-sky-50 p-2 dark:border-sky-700 dark:bg-sky-900/20">
                                    <p className="text-[11px] font-medium text-sky-900 dark:text-sky-200">Importar repositorio externo</p>
                                    <input
                                        type="url"
                                        value={importUrl}
                                        onChange={(e) => setImportUrl(e.target.value)}
                                        placeholder="https://github.com/usuario/repo.git"
                                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
                                    />
                                    <input
                                        type="text"
                                        value={importName}
                                        onChange={(e) => setImportName(e.target.value)}
                                        placeholder="Nombre opcional (default: del URL)"
                                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
                                    />
                                    <input
                                        type="password"
                                        value={importToken}
                                        onChange={(e) => setImportToken(e.target.value)}
                                        placeholder="Token de acceso (sólo si el repo es privado)"
                                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
                                    />
                                    {importError && <p className="text-[10px] text-red-600 dark:text-red-400">{importError}</p>}
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => void submitImport()}
                                            disabled={importBusy || !importUrl.trim()}
                                            className="flex-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                                        >
                                            {importBusy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Importar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setImportOpen(false); setImportError(null); }}
                                            disabled={importBusy}
                                            className="rounded border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                            {info.repos.length === 0 && (
                                <p className="text-[11px] text-zinc-500">Aún no tienes repos. Cada workspace genera uno al activar Git.</p>
                            )}
                            {info.repos.map((r) => {
                                const httpsUrl = r.cloneUrl
                                    ? (issuedToken ? buildAuthedClone(r.cloneUrl, issuedToken.login, issuedToken.token) : r.cloneUrl)
                                    : '';
                                const cloneCommand = httpsUrl ? `git clone ${httpsUrl}` : '';
                                const vscodeUrl = r.cloneUrl ? `vscode://vscode.git/clone?url=${encodeURIComponent(r.cloneUrl)}` : '';
                                return (
                                    <div key={r.fullName} className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">{r.fullName}</span>
                                            {r.htmlUrl && (
                                                <a href={r.htmlUrl} target="_blank" rel="noreferrer noopener" className="text-emerald-700 hover:underline dark:text-emerald-400">
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </div>
                                        {cloneCommand && (
                                            <div className="mt-2 flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => copy(`cmd-${r.fullName}`, cloneCommand)}
                                                    className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-600 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
                                                >
                                                    {copied === `cmd-${r.fullName}` ? <Check className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                                                    {copied === `cmd-${r.fullName}` ? 'Copiado' : 'Copiar git clone'}
                                                </button>
                                                {vscodeUrl && (
                                                    <a
                                                        href={vscodeUrl}
                                                        className="flex items-center justify-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                                        title="Abrir en VS Code (requiere VS Code instalado)"
                                                    >
                                                        VS Code
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {!issuedToken && cloneCommand && (
                                            <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                                                Sin token, te pedirá usuario+contraseña. Genera uno arriba para copiar el comando con auth incluida.
                                            </p>
                                        )}
                                        {httpsUrl && (
                                            <Field
                                                label="HTTPS"
                                                value={httpsUrl}
                                                mono
                                                small
                                                onCopy={(v) => copy(`https-${r.fullName}`, v)}
                                                copied={copied === `https-${r.fullName}`}
                                            />
                                        )}
                                        {r.sshUrl && (
                                            <Field
                                                label="SSH"
                                                value={r.sshUrl}
                                                mono
                                                small
                                                onCopy={(v) => copy(`ssh-${r.fullName}`, v)}
                                                copied={copied === `ssh-${r.fullName}`}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}

interface FieldProps {
    label: string;
    value: string;
    mono?: boolean;
    small?: boolean;
    onCopy: (v: string) => void;
    copied: boolean;
    rightSlot?: React.ReactNode;
}

function Field({ label, value, mono, small, onCopy, copied, rightSlot }: FieldProps) {
    return (
        <div className="space-y-0.5">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</label>
                {copied && <span className="text-[10px] text-emerald-700 dark:text-emerald-400">copiado</span>}
            </div>
            <div className={`flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 ${small ? 'py-0.5' : 'py-1'} dark:border-zinc-800 dark:bg-zinc-950`}>
                <span className={`flex-1 truncate ${mono ? 'font-mono' : ''} text-zinc-700 dark:text-zinc-200`}>{value}</span>
                <button type="button" onClick={() => onCopy(value)} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800" aria-label="Copiar">
                    <Copy className="h-3 w-3" />
                </button>
                {rightSlot}
            </div>
        </div>
    );
}
