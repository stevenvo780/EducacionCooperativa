'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Loader2, RefreshCcw, Trash2, Check } from 'lucide-react';
import { authFetch } from '@/services/apiClient';
import { toast } from 'sonner';

interface CliToken {
  id: string;
  name: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
  revoked: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CliTokensPanel() {
  const [tokens, setTokens] = useState<CliToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/cli-tokens');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw: unknown[] = Array.isArray(data?.tokens) ? data.tokens : [];
      setTokens(raw.filter((t): t is CliToken => typeof t === 'object' && t !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setNewToken(null);
    setCopied(false);
    try {
      const res = await authFetch('/api/cli-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() || null })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data?.token !== 'string') throw new Error('Respuesta inesperada del servidor');
      setNewToken(data.token);
      setNameInput('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await authFetch(`/api/cli-tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Token revocado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al revocar');
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  const activeTokens = tokens.filter((t) => !t.revoked);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <p className="text-surface-400 leading-relaxed">
          Los Personal Access Tokens (PAT) reemplazan el ID token de Firebase para autenticar el CLI.
          No expiran y los podés revocar desde aquí.
          <br />
          Uso: <code className="rounded bg-surface-800 px-1 py-0.5 text-[10px]">agora login --token agora_pat_...</code>
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded p-1 text-surface-400 hover:bg-surface-700/50 disabled:opacity-50"
          aria-label="Recargar"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-md border border-surface-700/40 bg-surface-925/30 p-3 space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">Generar nuevo token</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Nombre del token (opcional, ej: laptop-casa)"
            className="flex-1 rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 text-xs text-surface-50 placeholder:text-surface-500 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="rounded-md bg-mandy-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-mandy-500 disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Generar'}
          </button>
        </div>

        {newToken && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 space-y-1">
            <p className="text-[11px] font-medium text-amber-200">
              Guardalo ahora — no se vuelve a mostrar.
            </p>
            <div className="flex items-center gap-1 rounded bg-surface-950 px-2 py-1.5 font-mono text-[11px] text-emerald-300">
              <span className="flex-1 break-all">{newToken}</span>
              <button
                type="button"
                onClick={() => void handleCopy(newToken)}
                className="ml-1 shrink-0 rounded p-1 text-surface-300 hover:bg-surface-800"
                aria-label="Copiar token"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            {copied && <p className="text-[10px] text-emerald-400">Copiado.</p>}
          </div>
        )}
      </section>

      <section className="rounded-md border border-surface-700/40 bg-surface-925/30 p-3 space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">
          Tokens activos ({activeTokens.length})
        </h3>

        {loading && activeTokens.length === 0 && (
          <div className="flex items-center gap-2 text-surface-400 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando…</span>
          </div>
        )}

        {!loading && activeTokens.length === 0 && (
          <p className="text-[11px] text-surface-500 py-1">No hay tokens activos.</p>
        )}

        <ul className="space-y-1.5">
          {activeTokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded border border-surface-700/40 bg-surface-950/40 px-3 py-2"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-surface-100 truncate">
                  {t.name ?? <span className="italic text-surface-500">sin nombre</span>}
                </span>
                <span className="text-[10px] text-surface-500">
                  Creado {fmtDate(t.createdAt)}
                  {t.lastUsedAt ? ` · Último uso ${fmtDate(t.lastUsedAt)}` : ' · Nunca usado'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleRevoke(t.id)}
                className="shrink-0 rounded border border-red-500/30 px-2 py-1 text-[10px] text-red-400 hover:border-red-400/60 hover:bg-red-500/10 transition"
                aria-label="Revocar token"
                title="Revocar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
