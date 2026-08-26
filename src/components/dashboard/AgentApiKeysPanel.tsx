'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, ShieldCheck } from 'lucide-react';
import {
  AGENT_KEY_PROVIDERS,
  deleteAgentSecret,
  listAgentSecrets,
  saveAgentSecret,
  type AgentKeyProvider,
  type RemoteAgentSecret
} from '@/lib/agora-ai/agentKeysApi';
import type { AIProvider } from '@/lib/agora-ai/types';

const PROVIDER_LABELS: Record<AgentKeyProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  google: 'Google',
  gemini: 'Gemini',
  minimax: 'MiniMax',
  'agora-gateway': 'Agora Gateway',
  custom: 'Custom'
};

const KEY_PROVIDER_BY_AI_PROVIDER: Partial<Record<AIProvider, AgentKeyProvider>> = {
  openai: 'openai',
  anthropic: 'anthropic',
  deepseek: 'deepseek',
  gemini: 'gemini',
  minimax: 'minimax'
};

export default function AgentApiKeysPanel({ selectedProvider }: { selectedProvider?: AIProvider }) {
  const [secrets, setSecrets] = useState<RemoteAgentSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftProvider, setDraftProvider] = useState<AgentKeyProvider>('openai');
  const [draftKey, setDraftKey] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listAgentSecrets();
      setSecrets(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando claves');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const provider = selectedProvider ? KEY_PROVIDER_BY_AI_PROVIDER[selectedProvider] : undefined;
    if (provider) setDraftProvider(provider);
  }, [selectedProvider]);

  const handleSave = useCallback(async () => {
    const trimmed = draftKey.trim();
    if (!trimmed) {
      setError('Pega la API key antes de guardar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveAgentSecret(draftProvider, trimmed);
      setDraftKey('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la key');
    } finally {
      setSaving(false);
    }
  }, [draftKey, draftProvider, refresh]);

  const handleDelete = useCallback(async (provider: AgentKeyProvider) => {
    setError(null);
    try {
      await deleteAgentSecret(provider);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }, [refresh]);

  return (
    <section className="space-y-3 rounded-md border border-surface-700/40 bg-surface-925/30 p-3">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
        <h4 className="text-xs font-semibold text-surface-100">Claves IA por proveedor (server-side cifradas)</h4>
      </header>
      <p className="text-[11px] text-surface-400">
        Se cifran con AES-256-GCM y solo se descifran en memoria para cada request del agente.
        El plaintext nunca se devuelve al cliente ni se guarda en log.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-surface-400">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Cargando…
        </div>
      ) : secrets.length === 0 ? (
        <p className="text-[11px] text-surface-500">No hay claves guardadas. Agrega una abajo.</p>
      ) : (
        <ul className="space-y-1.5">
          {secrets.map((secret) => (
            <li key={secret.provider} className="flex items-center justify-between rounded-md border border-surface-700/40 bg-surface-925/60 px-2.5 py-1.5">
              <div className="text-[11px]">
                <div className="font-medium text-surface-100">{PROVIDER_LABELS[secret.provider] ?? secret.provider}</div>
                <div className="font-mono text-surface-400">{secret.displayHint}</div>
              </div>
              <button
                type="button"
                onClick={() => { void handleDelete(secret.provider); }}
                className="rounded-md border border-surface-700/40 px-2 py-1 text-[11px] text-surface-300 transition hover:border-rose-500/50 hover:text-rose-200"
                aria-label={`Quitar key de ${PROVIDER_LABELS[secret.provider] ?? secret.provider}`}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <label className="block text-[11px]">
          <span className="mb-1 block text-surface-400">Proveedor</span>
          <select
            value={draftProvider}
            onChange={(event) => setDraftProvider(event.target.value as AgentKeyProvider)}
            className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 text-xs text-surface-50 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
          >
            {AGENT_KEY_PROVIDERS.map((p) => (
              <option key={p} value={p} className="bg-surface-900 text-surface-100">{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <label className="block text-[11px]">
          <span className="mb-1 block text-surface-400">API Key</span>
          <input
            type="password"
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            placeholder="Pega la key (no se almacena en tu navegador)"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 placeholder:text-surface-400 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving || !draftKey.trim()}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : 'Guardar'}
          </button>
        </div>
      </div>

      {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
    </section>
  );
}
