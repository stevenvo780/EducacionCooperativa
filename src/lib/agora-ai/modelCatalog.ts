import { apiUrl } from '@/services/apiClient';

export type ModelFamily = 'deepseek' | 'anthropic' | 'openai' | 'google' | 'minimax' | 'xai' | 'ollama';
export type ModelVerified = 'official' | 'community' | 'unverified';

export interface CatalogModel {
  id: string;
  family: ModelFamily;
  label: string;
  contextWindow: number;
  maxOutputTokens: number;
  verified: ModelVerified;
  notes?: string;
}

export interface ModelCatalog {
  lastUpdated: string;
  models: CatalogModel[];
}

const FALLBACK_CATALOG: ModelCatalog = {
  lastUpdated: 'fallback',
  models: [
    { id: 'deepseek-chat', family: 'deepseek', label: 'DeepSeek Chat', contextWindow: 128_000, maxOutputTokens: 8192, verified: 'official' },
    { id: 'deepseek-reasoner', family: 'deepseek', label: 'DeepSeek Reasoner', contextWindow: 128_000, maxOutputTokens: 32_768, verified: 'official' },
    { id: 'claude-opus-4-7', family: 'anthropic', label: 'Claude Opus 4.7 (1M)', contextWindow: 1_000_000, maxOutputTokens: 128_000, verified: 'official' },
    { id: 'claude-sonnet-4-6', family: 'anthropic', label: 'Claude Sonnet 4.6 (1M)', contextWindow: 1_000_000, maxOutputTokens: 64_000, verified: 'official' },
    { id: 'claude-haiku-4-5-20251001', family: 'anthropic', label: 'Claude Haiku 4.5', contextWindow: 200_000, maxOutputTokens: 64_000, verified: 'official' },
    { id: 'gpt-4o-mini', family: 'openai', label: 'GPT-4o mini', contextWindow: 128_000, maxOutputTokens: 16_384, verified: 'official' },
    { id: 'gpt-4o', family: 'openai', label: 'GPT-4o', contextWindow: 128_000, maxOutputTokens: 16_384, verified: 'official' },
    { id: 'gpt-4.1', family: 'openai', label: 'GPT-4.1', contextWindow: 1_047_576, maxOutputTokens: 32_768, verified: 'official' },
    { id: 'gemini-2.5-pro', family: 'google', label: 'Gemini 2.5 Pro', contextWindow: 1_048_576, maxOutputTokens: 65_535, verified: 'official' },
    { id: 'gemini-2.5-flash', family: 'google', label: 'Gemini 2.5 Flash', contextWindow: 1_048_576, maxOutputTokens: 65_535, verified: 'official' },
    { id: 'MiniMax-M3', family: 'minimax', label: 'MiniMax M3', contextWindow: 1_000_000, maxOutputTokens: 128_000, verified: 'official' }
  ]
};

const STORAGE_KEY = 'agora:modelCatalog:v1';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDER_TO_FAMILY: Record<string, ModelFamily> = {
  openai: 'openai',
  anthropic: 'anthropic',
  deepseek: 'deepseek',
  gemini: 'google',
  minimax: 'minimax',
  ollama: 'ollama'
};

let cachedCatalog: ModelCatalog | null = null;
let inFlight: Promise<ModelCatalog> | null = null;
let lastFailureAt = 0;
const FAILURE_BACKOFF_MS = 60_000;

function parseModelCatalog(raw: unknown): ModelCatalog {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('parseModelCatalog: respuesta no es un objeto');
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r['models'])) {
    throw new Error('parseModelCatalog: models no es un array');
  }
  const models = r['models'].filter(
    (m): m is CatalogModel =>
      typeof m === 'object' && m !== null && typeof (m as Record<string, unknown>)['id'] === 'string'
  );
  return {
    lastUpdated: typeof r['lastUpdated'] === 'string' ? r['lastUpdated'] : new Date().toISOString(),
    models
  };
}

function loadFromStorage(): ModelCatalog | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; catalog?: ModelCatalog };
    if (!parsed.savedAt || !parsed.catalog) return null;
    if (Date.now() - parsed.savedAt > STORAGE_TTL_MS) return null;
    return parsed.catalog;
  } catch { return null; }
}

function saveToStorage(catalog: ModelCatalog) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), catalog }));
  } catch { /* localStorage lleno o privado: no es crítico */ }
}

/** Carga el catálogo (memoria → localStorage → red → fallback). */
export async function loadModelCatalog(): Promise<ModelCatalog> {
  if (cachedCatalog) return cachedCatalog;
  const stored = loadFromStorage();
  if (stored) {
    cachedCatalog = stored;
    return stored;
  }
  if (Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) {
    return FALLBACK_CATALOG;
  }
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const url = apiUrl('/api/agora-ai/models');
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const catalog = parseModelCatalog(await res.json());
        cachedCatalog = catalog;
        saveToStorage(catalog);
        return catalog;
      } catch {
        lastFailureAt = Date.now();
        return FALLBACK_CATALOG;
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
}

/** Versión sincrónica: devuelve lo que esté en cache (memoria/localStorage/fallback)
 *  y dispara la carga real en background. Útil en componentes que renderizan
 *  durante la primera carga. */
export function getModelCatalogSync(): ModelCatalog {
  if (cachedCatalog) return cachedCatalog;
  const stored = loadFromStorage();
  if (stored) {
    cachedCatalog = stored;
    return stored;
  }
  void loadModelCatalog();
  return FALLBACK_CATALOG;
}

export function findCatalogModel(catalog: ModelCatalog, modelId: string): CatalogModel | null {
  if (!modelId) return null;
  return catalog.models.find((m) => m.id === modelId)
    ?? catalog.models.find((m) => modelId.startsWith(m.id) || m.id.startsWith(modelId))
    ?? null;
}

export function modelsForProvider(catalog: ModelCatalog, provider: string): CatalogModel[] {
  const family = PROVIDER_TO_FAMILY[provider];
  if (!family) return [];
  return catalog.models.filter((m) => m.family === family);
}

const FAST_MODEL_PATTERN = /flash|mini|haiku|lite|small|nano|8b|7b|3b|1\.5b|deepseek-chat/;

/**
 * El modelo de continuidad usa la misma API key y el mismo adapter que el
 * modelo principal. Por eso sólo ofrecemos modelos del provider activo; mezclar
 * familias produciría una llamada firmada con la key/endpoint equivocados.
 * Los modelos rápidos aparecen primero, pero no ocultamos los demás (MiniMax
 * hoy sólo publica M3 en el catálogo).
 */
export function continuityModelsForProvider(catalog: ModelCatalog, provider: string): CatalogModel[] {
  return [...modelsForProvider(catalog, provider)].sort((a, b) => {
    const aFast = FAST_MODEL_PATTERN.test(a.id.toLowerCase());
    const bFast = FAST_MODEL_PATTERN.test(b.id.toLowerCase());
    if (aFast !== bFast) return aFast ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function isKnownModelForProvider(catalog: ModelCatalog, provider: string, modelId: string): boolean {
  if (!modelId) return false;
  return modelsForProvider(catalog, provider).some((model) => model.id === modelId);
}

export function contextWindowForModel(provider: string, model: string, catalog?: ModelCatalog): number {
  const cat = catalog ?? getModelCatalogSync();
  const found = findCatalogModel(cat, model);
  if (found) return found.contextWindow;
  switch (provider) {
    case 'anthropic': return 200_000;
    case 'openai': return 128_000;
    case 'deepseek': return 128_000;
    case 'gemini': return 1_048_576;
    case 'minimax': return 1_000_000;
    case 'ollama': return 32_768;
    default: return 32_768;
  }
}

/** Llama al endpoint con keys del usuario para refrescar — solo Anthropic y Gemini
 *  exponen la ventana real vía API. Los demás siguen viniendo del JSON. */
export async function refreshModelCatalog(keys: { anthropicApiKey?: string; geminiApiKey?: string }): Promise<ModelCatalog> {
  const url = apiUrl('/api/agora-ai/models');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keys)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const catalog = parseModelCatalog(await res.json());
  cachedCatalog = catalog;
  saveToStorage(catalog);
  return catalog;
}
