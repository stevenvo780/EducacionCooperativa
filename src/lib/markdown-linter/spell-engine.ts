/**
 * Motor de corrección ortográfica basado en nspell (Hunspell JS).
 *
 * Características:
 *  - Singleton: una sola instancia en memoria para toda la app.
 *  - Carga lazy: los diccionarios (~850KB) se descargan solo la primera
 *    vez que se necesitan y quedan en memoria permanentemente.
 *  - API síncrona una vez cargado: isCorrect(word), suggest(word).
 *  - Palabras personalizadas: el usuario puede agregar palabras al
 *    diccionario personal (persistido en localStorage).
 *  - Compatible con SSR: no hace nada en servidor (typeof window check).
 */

interface SpellInstance {
  correct(word: string): boolean;
  suggest(word: string): string[];
  add(word: string): void;
  remove(word: string): void;
}

let _nspell: SpellInstance | null = null;
let _loading: Promise<SpellInstance> | null = null;
let _ready = false;
const _correctCache = new Map<string, boolean>();
const _suggestCache = new Map<string, string[]>();

/** Palabras añadidas por el usuario (persistidas en localStorage) */
const PERSONAL_DICT_KEY = 'linter_personal_dictionary';
let _personalWords: Set<string> = new Set();
let _personalWordsLoaded = false;

/** Palabras que sabemos que son válidas pero nspell no reconoce (tecnicismos, etc.) */
const EXTRA_VALID = new Set([
  // Tecnología / programación
  'markdown', 'html', 'css', 'javascript', 'typescript', 'json', 'yaml',
  'api', 'url', 'http', 'https', 'npm', 'git', 'github', 'docker',
  'webpack', 'vite', 'react', 'nextjs', 'nodejs', 'linux', 'bash',
  'frontend', 'backend', 'fullstack', 'deploy', 'localhost', 'webhook',
  // Plataforma
  'agora', 'linter', 'plugin', 'widget', 'dashboard', 'workspace',
  'katex', 'latex', 'mermaid', 'mdx'
]);

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function resetSpellCaches(): void {
  _correctCache.clear();
  _suggestCache.clear();
}

function loadPersonalDict(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PERSONAL_DICT_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map((w: string) => w.toLowerCase()));
    }
  } catch { /* corrupto, ignorar */ }
  return new Set();
}

function savePersonalDict(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PERSONAL_DICT_KEY, JSON.stringify([..._personalWords]));
  } catch { /* storage full, ignorar */ }
}

function ensurePersonalWordsLoaded(): void {
  if (_personalWordsLoaded) return;
  _personalWords = loadPersonalDict();
  _personalWordsLoaded = true;
}

/**
 * Inicia la carga del diccionario (lazy, una sola vez).
 * Devuelve la promesa de carga; si ya está cargado, resuelve inmediatamente.
 */
export function initSpellEngine(): Promise<void> {
  if (_ready) return Promise.resolve();
  if (_loading) return _loading.then(() => {});

  if (typeof fetch !== 'function') {
    return Promise.resolve();
  }

  _loading = (async () => {
    try {
      // Importar nspell dinámicamente (CommonJS module)
      const nspellModule = await import('nspell');
      const NSpell = nspellModule.default || nspellModule;

      // Descargar diccionarios desde public/
      const [affResp, dicResp] = await Promise.all([
        fetch('/dictionaries/es.aff'),
        fetch('/dictionaries/es.dic')
      ]);

      if (!affResp.ok || !dicResp.ok) {
        throw new Error(`Error descargando diccionarios: aff=${affResp.status}, dic=${dicResp.status}`);
      }

      const [affText, dicText] = await Promise.all([
        affResp.text(),
        dicResp.text()
      ]);

      // Crear instancia nspell
      _nspell = NSpell(affText, dicText);

      // Cargar palabras personales del usuario
      ensurePersonalWordsLoaded();
      for (const word of _personalWords) {
        _nspell.add(word);
      }

      // Agregar palabras extra válidas
      for (const word of EXTRA_VALID) {
        _nspell.add(word);
      }

      resetSpellCaches();
      _ready = true;
      return _nspell;
    } catch (err) {
      _loading = null; // Permitir reintentar
      throw err;
    }
  })();

  return _loading.then(() => {});
}

/** ¿El motor está listo para usar? */
export function isSpellEngineReady(): boolean {
  return _ready && _nspell !== null;
}

/**
 * Comprueba si una palabra es correcta.
 * Si el motor no está cargado, devuelve true (no marcar nada).
 */
export function isCorrect(word: string): boolean {
  if (!_ready || !_nspell) return true; // Fail-open: sin motor, todo es "correcto"
  ensurePersonalWordsLoaded();
  const normalized = normalizeWord(word);
  // Palabras de 1-2 letras: no verificar (artículos, preposiciones, etc.)
  if (normalized.length <= 2) return true;
  // Palabras con números o all-caps (acrónimos): no verificar
  if (/\d/.test(normalized)) return true;
  if (word === word.toUpperCase() && word.length >= 2) return true;
  // Verificar contra diccionario personal primero (más rápido)
  if (_personalWords.has(normalized)) return true;
  if (EXTRA_VALID.has(normalized)) return true;
  const cached = _correctCache.get(normalized);
  if (cached !== undefined) return cached;

  const correct = _nspell.correct(normalized);
  _correctCache.set(normalized, correct);
  return correct;
}

/**
 * Sugiere correcciones para una palabra incorrecta.
 * Devuelve array vacío si el motor no está cargado.
 * Limita a 5 sugerencias para no saturar la UI.
 */
export function suggest(word: string): string[] {
  if (!_ready || !_nspell) return [];
  ensurePersonalWordsLoaded();
  const normalized = normalizeWord(word);
  const cached = _suggestCache.get(normalized);
  if (cached) return cached;
  try {
    const suggestions: string[] = _nspell.suggest(normalized).slice(0, 5);
    _suggestCache.set(normalized, suggestions);
    return suggestions;
  } catch {
    return [];
  }
}

/**
 * Agrega una palabra al diccionario personal del usuario.
 * Se persiste en localStorage y se aplica inmediatamente.
 */
export function addToPersonalDictionary(word: string): void {
  ensurePersonalWordsLoaded();
  const lower = normalizeWord(word);
  _personalWords.add(lower);
  if (_nspell) {
    _nspell.add(lower);
  }
  resetSpellCaches();
  savePersonalDict();
}

/**
 * Elimina una palabra del diccionario personal.
 */
export function removeFromPersonalDictionary(word: string): void {
  ensurePersonalWordsLoaded();
  const lower = normalizeWord(word);
  _personalWords.delete(lower);
  if (_nspell) {
    _nspell.remove(lower);
  }
  resetSpellCaches();
  savePersonalDict();
}

/**
 * Devuelve las palabras del diccionario personal.
 */
export function getPersonalDictionary(): string[] {
  ensurePersonalWordsLoaded();
  return [..._personalWords];
}

export function syncPersonalDictionary(words: string[]): void {
  const normalizedWords = new Set(words.map(normalizeWord).filter(Boolean));
  const previousWords = _personalWords;

  _personalWords = normalizedWords;
  _personalWordsLoaded = true;

  if (_nspell) {
    for (const word of previousWords) {
      if (!normalizedWords.has(word)) {
        _nspell.remove(word);
      }
    }

    for (const word of normalizedWords) {
      if (!previousWords.has(word)) {
        _nspell.add(word);
      }
    }
  }

  resetSpellCaches();
}
