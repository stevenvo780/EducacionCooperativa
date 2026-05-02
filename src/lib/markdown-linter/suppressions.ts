/**
 * Suppression store for linter diagnostics.
 *
 * Allows users to suppress specific diagnostic instances by ruleId + text.
 * Persisted in localStorage, with subscribe/notify for reactivity.
 */

const STORAGE_KEY = 'agora:linter-suppressions';

type Listener = () => void;

export interface LinterSuppression {
  /** Rule ID that generated the diagnostic (e.g. 'spelling_typos') */
  ruleId: string;
  /** The exact text that triggered the diagnostic (lowercased) */
  text: string;
}

let _suppressions: LinterSuppression[] = [];
let _loaded = false;
const _listeners = new Set<Listener>();
let _indexCache: Set<string> | null = null;

function suppressionKey(ruleId: string, text: string): string {
  return `${ruleId}::${text.toLowerCase().trim()}`;
}

function buildIndex(): Set<string> {
  if (_indexCache) return _indexCache;
  _indexCache = new Set(_suppressions.map(s => suppressionKey(s.ruleId, s.text)));
  return _indexCache;
}

function load(): void {
  if (_loaded) return;
  _loaded = true;
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        _suppressions = parsed.filter(
          (s): s is LinterSuppression =>
            typeof s === 'object' && typeof s.ruleId === 'string' && typeof s.text === 'string'
        );
      }
    }
  } catch { /* corrupt — ignore */ }
}

function save(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_suppressions));
  } catch { /* storage full — ignore */ }
}

function notify(): void {
  _indexCache = null;
  for (const listener of _listeners) listener();
}

/**
 * Check if a diagnostic is suppressed.
 */
export function isSuppressed(ruleId: string | undefined, text: string | undefined): boolean {
  if (!ruleId || !text) return false;
  load();
  return buildIndex().has(suppressionKey(ruleId, text));
}

/**
 * Add a suppression entry.
 */
export function addSuppression(ruleId: string, text: string): void {
  load();
  const key = suppressionKey(ruleId, text);
  if (buildIndex().has(key)) return; // already suppressed
  _suppressions.push({ ruleId, text: text.toLowerCase().trim() });
  save();
  notify();
}

/**
 * Remove a suppression entry.
 */
export function removeSuppression(ruleId: string, text: string): void {
  load();
  const key = suppressionKey(ruleId, text);
  if (!buildIndex().has(key)) return;
  _suppressions = _suppressions.filter(s => suppressionKey(s.ruleId, s.text) !== key);
  save();
  notify();
}

/**
 * Get all suppressions.
 */
export function getSuppressions(): LinterSuppression[] {
  load();
  return [..._suppressions];
}

/**
 * Clear all suppressions.
 */
export function clearAllSuppressions(): void {
  _suppressions = [];
  save();
  notify();
}

/**
 * Subscribe to suppression changes.
 */
export function subscribeSuppression(listener: Listener): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}
