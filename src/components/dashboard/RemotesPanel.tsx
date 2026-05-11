'use client';

/**
 * Panel de remotes Git externos del workspace.
 * Forgejo sigue siendo source-of-truth y NO aparece aquí — esto es para
 * destinos opcionales (GitHub, GitLab, Bitbucket, custom).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Github, GitlabIcon, Server, Globe, Trash2, RefreshCw, Upload, Download,
  Plus, Loader2, AlertTriangle, Check, X, Pencil
} from 'lucide-react';
import {
  listRemotes, createRemote, deleteRemote, pushRemote, pullRemote, updateRemote,
  type WorkspaceRemote, type RemoteAuthMethod, type RemoteProvider, type OperationResult
} from '@/services/remotesApi';

interface RemotesPanelProps {
  workspaceId: string;
}

const providerIcon: Record<RemoteProvider, React.ComponentType<{ className?: string }>> = {
  github: Github,
  gitlab: GitlabIcon,
  bitbucket: Server,
  custom: Globe
};

const inferProvider = (url: string): RemoteProvider => {
  const lower = url.toLowerCase();
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('gitlab.')) return 'gitlab';
  if (lower.includes('bitbucket.')) return 'bitbucket';
  return 'custom';
};

const formatRelative = (ts: number | null): string => {
  if (!ts) return 'nunca';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'hace segundos';
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString();
};

export default function RemotesPanel({ workspaceId }: RemotesPanelProps) {
  const [remotes, setRemotes] = useState<WorkspaceRemote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyOp, setBusyOp] = useState<Record<string, 'push' | 'pull' | 'delete' | null>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listRemotes(workspaceId);
      setRemotes(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const onCreated = useCallback((r: WorkspaceRemote) => {
    setRemotes(prev => [...prev, r]);
    setShowCreate(false);
    setToast(`Remote "${r.name}" creado.`);
  }, []);

  const handleOp = useCallback(async (remote: WorkspaceRemote, op: 'push' | 'pull') => {
    setBusyOp(prev => ({ ...prev, [remote.id]: op }));
    setError(null);
    try {
      const result: OperationResult = op === 'push'
        ? await pushRemote(workspaceId, remote.id)
        : await pullRemote(workspaceId, remote.id);
      if (result.ok) {
        setToast(`${op === 'push' ? 'Push' : 'Pull'} a "${remote.name}" OK${result.ref ? ` (${result.ref.slice(0, 7)})` : ''}.`);
      } else if (result.notImplemented) {
        setError(`${op}: ${result.error ?? 'runtime no soportado'}`);
      } else {
        setError(`${op}: ${result.error ?? 'falló'}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyOp(prev => ({ ...prev, [remote.id]: null }));
    }
  }, [workspaceId, refresh]);

  const handleDelete = useCallback(async (remote: WorkspaceRemote) => {
    if (!confirm(`¿Eliminar remote "${remote.name}"? Se quitará la configuración (no toca el repo remoto).`)) return;
    setBusyOp(prev => ({ ...prev, [remote.id]: 'delete' }));
    setError(null);
    try {
      await deleteRemote(workspaceId, remote.id);
      setRemotes(prev => prev.filter(r => r.id !== remote.id));
      setToast(`Remote "${remote.name}" eliminado.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyOp(prev => ({ ...prev, [remote.id]: null }));
    }
  }, [workspaceId]);

  const handleToggle = useCallback(async (remote: WorkspaceRemote) => {
    try {
      const updated = await updateRemote(workspaceId, remote.id, { enabled: !remote.enabled });
      setRemotes(prev => prev.map(r => r.id === remote.id ? updated : r));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [workspaceId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Remotes externos</span>
          <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] dark:bg-zinc-800">{remotes.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex items-center gap-1 rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Refrescar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>
      </div>

      {error && (
        <div className="m-3 flex items-start gap-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 break-words">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {toast && (
        <div className="m-3 flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 text-xs">
        <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
          Forgejo (NAS) es el origen principal del workspace y se mantiene automáticamente.
          Aquí configurás destinos opcionales como GitHub, GitLab o Bitbucket para push/pull manual.
        </div>

        {loading && remotes.length === 0 && (
          <div className="rounded border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Cargando remotes…
          </div>
        )}

        {!loading && remotes.length === 0 && (
          <div className="rounded border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700">
            Sin remotes externos configurados. Agregá uno para sincronizar manualmente con GitHub, GitLab, etc.
          </div>
        )}

        <ul className="space-y-2">
          {remotes.map(r => {
            const Icon = providerIcon[r.provider];
            const busy = busyOp[r.id];
            return (
              <li key={r.id} className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{r.name}</span>
                      <span className={`rounded-full px-1.5 text-[9px] uppercase tracking-wider ${r.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                        {r.enabled ? 'activo' : 'pausado'}
                      </span>
                      {r.hasCredentials && (
                        <span className="rounded-full bg-blue-100 px-1.5 text-[9px] uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {r.authMethod === 'token' ? 'token' : r.authMethod === 'ssh-key' ? 'ssh' : 'auth'}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 break-all font-mono text-[10px] text-zinc-500">{r.url}</div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      Último sync: {formatRelative(r.lastSyncAt)}
                      {r.lastSyncStatus === 'error' && r.lastSyncError && (
                        <span className="ml-2 text-red-600 dark:text-red-400">· {r.lastSyncError.slice(0, 80)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleOp(r, 'push')}
                    disabled={!r.enabled || !!busy}
                    className="flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                  >
                    {busy === 'push' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Push
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOp(r, 'pull')}
                    disabled={!r.enabled || !!busy}
                    className="flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100 disabled:opacity-40 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                  >
                    {busy === 'pull' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Pull
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggle(r)}
                    disabled={!!busy}
                    className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-3 w-3" />
                    {r.enabled ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(r)}
                    disabled={!!busy}
                    className="ml-auto flex items-center gap-1 rounded border border-red-300 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {busy === 'delete' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {showCreate && (
        <CreateRemoteModal
          workspaceId={workspaceId}
          onClose={() => setShowCreate(false)}
          onCreated={onCreated}
        />
      )}
    </div>
  );
}

function CreateRemoteModal({
  workspaceId,
  onClose,
  onCreated
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (r: WorkspaceRemote) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<RemoteAuthMethod>('token');
  const [authData, setAuthData] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = useMemo<RemoteProvider>(() => inferProvider(url), [url]);
  const ProviderIcon = providerIcon[provider];

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError('Nombre y URL son obligatorios.');
      return;
    }
    if (authMethod !== 'none' && !authData.trim()) {
      setError(`Credenciales requeridas para authMethod=${authMethod}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const remote = await createRemote(workspaceId, {
        name: name.trim(),
        url: url.trim(),
        provider,
        authMethod,
        ...(authMethod !== 'none' ? { authData: authData.trim() } : {})
      });
      onCreated(remote);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [name, url, authMethod, authData, provider, workspaceId, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Agregar remote externo</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-3 p-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300" htmlFor="remote-name">
              Nombre interno
            </label>
            <input
              id="remote-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="origin-github"
              disabled={busy}
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300" htmlFor="remote-url">
              URL del repositorio
            </label>
            <div className="flex items-center gap-2">
              <ProviderIcon className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                id="remote-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                disabled={busy}
                className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              Provider detectado: <span className="font-mono">{provider}</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300" htmlFor="remote-auth">
              Método de autenticación
            </label>
            <select
              id="remote-auth"
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as RemoteAuthMethod)}
              disabled={busy}
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="token">Token HTTPS (recomendado)</option>
              <option value="ssh-key">SSH key privada</option>
              <option value="none">Sin auth (repo público)</option>
            </select>
          </div>
          {authMethod !== 'none' && (
            <div>
              <label className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300" htmlFor="remote-auth-data">
                {authMethod === 'token' ? 'Personal access token' : 'Clave SSH privada (pegar contenido completo)'}
              </label>
              <textarea
                id="remote-auth-data"
                value={authData}
                onChange={(e) => setAuthData(e.target.value)}
                placeholder={authMethod === 'token' ? 'ghp_xxxxxxxxxxxxxxxx' : '-----BEGIN OPENSSH PRIVATE KEY-----\n...'}
                rows={authMethod === 'ssh-key' ? 6 : 2}
                disabled={busy}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-[10px] text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Se guarda cifrado (AES-256-GCM) en el servidor. No se logea ni se muestra después.
              </div>
            </div>
          )}
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Crear remote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
