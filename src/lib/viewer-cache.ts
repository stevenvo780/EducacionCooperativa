/**
 * Cache binario LRU en IndexedDB para los visualizadores de archivos
 * (PDF, DOCX, EPUB, etc). Permite reabrirlos offline sin volver a fetch.
 *
 * - DB separada (`agora-viewer-cache`) para no interferir con el offline-doc
 *   store principal.
 * - Eviction simple por edad: cualquier entrada con `cachedAt < now - MAX_AGE_MS`
 *   se borra al pedirla.
 * - Tamaño máximo (~ 200 MB total recomendado, configurable).
 */

const DB_NAME = 'agora-viewer-cache';
const DB_VERSION = 1;
const STORE = 'blobs';
const DEFAULT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 días

interface CachedBlobEntry {
  key: string;
  blob: Blob;
  size: number;
  cachedAt: number;
}

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      _dbPromise = null;
      reject(request.error);
    };
  });
  return _dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  const db = await openDB();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const request = fn(store);
    if (request) {
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    } else {
      transaction.oncomplete = () => resolve(undefined);
      transaction.onerror = () => reject(transaction.error);
    }
  });
}

/**
 * Guarda un blob asociado a una key (típicamente `${docId}:${fileUrl}`).
 */
export async function cacheBlob(key: string, blob: Blob): Promise<void> {
  try {
    const entry: CachedBlobEntry = { key, blob, size: blob.size, cachedAt: Date.now() };
    await tx('readwrite', (s) => s.put(entry));
  } catch (err) {
    console.warn('[viewer-cache] put failed', err);
  }
}

/**
 * Devuelve el blob cacheado si existe y no está vencido. Si está vencido
 * lo borra y devuelve null.
 */
export async function getCachedBlob(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<Blob | null> {
  try {
    const entry = (await tx<CachedBlobEntry>('readonly', (s) => s.get(key))) ?? null;
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > maxAgeMs) {
      await tx('readwrite', (s) => s.delete(key));
      return null;
    }
    return entry.blob;
  } catch (err) {
    console.warn('[viewer-cache] get failed', err);
    return null;
  }
}

export async function evictAll(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch (err) {
    console.warn('[viewer-cache] clear failed', err);
  }
}

export async function getCacheStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const entries = (await tx<CachedBlobEntry[]>('readonly', (s) => s.getAll())) ?? [];
    return {
      count: entries.length,
      totalBytes: entries.reduce((acc, e) => acc + (e.size ?? 0), 0)
    };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}
