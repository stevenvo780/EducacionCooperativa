/**
 * Cache binario LRU en IndexedDB para los visualizadores de archivos
 * (PDF, DOCX, EPUB, etc). Permite reabrirlos offline sin volver a fetch.
 *
 * Layout: dos object stores separados.
 *  - `blobs`     : { key, blob }
 *  - `blob-meta` : { key, size, cachedAt, lastAccessAt }
 *
 * Eviction:
 *  - Lazy por TTL (`MAX_AGE_MS`) en el `getCachedBlob` path.
 *  - LRU triggered por presión de cuota: `evictViewerCacheLRU(targetRatio)`
 *    lee SOLO la metadata (store `blob-meta`) — nunca materializa los blobs
 *    en RAM — ordena por lastAccessAt asc y borra entries de menor uso hasta
 *    bajar el size acumulado restante al target.
 */

const DB_NAME = 'agora-viewer-cache';
const DB_VERSION = 2;
const STORE_BLOBS = 'blobs';
const STORE_META = 'blob-meta';
const DEFAULT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface CachedBlobEntry {
  key: string;
  blob: Blob;
}

interface CachedBlobMeta {
  key: string;
  size: number;
  cachedAt: number;
  lastAccessAt: number;
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
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const txn = request.transaction;
      const oldVersion = event.oldVersion;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      if (oldVersion > 0 && oldVersion < 2 && txn) {
        try {
          const blobs = txn.objectStore(STORE_BLOBS);
          const meta = txn.objectStore(STORE_META);
          const cursorReq = blobs.openCursor();
          cursorReq.onsuccess = () => {
            const cur = cursorReq.result;
            if (!cur) return;
            const v = cur.value as { key?: unknown; blob?: unknown; size?: unknown; cachedAt?: unknown };
            if (typeof v.key === 'string') {
              const size = typeof v.size === 'number'
                ? v.size
                : (v.blob instanceof Blob ? v.blob.size : 0);
              const cachedAt = typeof v.cachedAt === 'number' ? v.cachedAt : Date.now();
              meta.put({ key: v.key, size, cachedAt, lastAccessAt: cachedAt } satisfies CachedBlobMeta);
              if (v.blob instanceof Blob) {
                blobs.put({ key: v.key, blob: v.blob } satisfies CachedBlobEntry);
              }
            }
            cur.continue();
          };
        } catch {
          // best-effort migration
        }
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

function runTx<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  body: (txn: IDBTransaction) => Promise<T> | T
): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let settled = false;
    Promise.resolve(body(transaction)).then(
      (val) => {
        transaction.oncomplete = () => { if (!settled) { settled = true; resolve(val); } };
        transaction.onerror = () => { if (!settled) { settled = true; reject(transaction.error); } };
        transaction.onabort = () => { if (!settled) { settled = true; reject(transaction.error); } };
      },
      (err) => { if (!settled) { settled = true; reject(err); } }
    );
  }));
}

export async function cacheBlob(key: string, blob: Blob): Promise<void> {
  const now = Date.now();
  const blobEntry: CachedBlobEntry = { key, blob };
  const meta: CachedBlobMeta = { key, size: blob.size, cachedAt: now, lastAccessAt: now };
  try {
    await runTx<void>([STORE_BLOBS, STORE_META], 'readwrite', (txn) => {
      txn.objectStore(STORE_BLOBS).put(blobEntry);
      txn.objectStore(STORE_META).put(meta);
    });
  } catch (err) {
    const { isQuotaExceededError, checkQuotaAndEvict } = await import('./idb-eviction');
    if (isQuotaExceededError(err)) {
      try {
        await checkQuotaAndEvict();
        await runTx<void>([STORE_BLOBS, STORE_META], 'readwrite', (txn) => {
          txn.objectStore(STORE_BLOBS).put(blobEntry);
          txn.objectStore(STORE_META).put(meta);
        });
        return;
      } catch (retryErr) {
        console.warn('[viewer-cache] put retry failed', retryErr);
        return;
      }
    }
    console.warn('[viewer-cache] put failed', err);
  }
}

export async function getCachedBlob(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<Blob | null> {
  try {
    const result = await runTx<{ blob: Blob | null; expired: boolean }>(
      [STORE_BLOBS, STORE_META],
      'readonly',
      (txn) => new Promise((resolve, reject) => {
        const metaReq = txn.objectStore(STORE_META).get(key);
        metaReq.onsuccess = () => {
          const recMeta = metaReq.result as CachedBlobMeta | undefined;
          if (!recMeta) {
            resolve({ blob: null, expired: false });
            return;
          }
          if (Date.now() - recMeta.cachedAt > maxAgeMs) {
            resolve({ blob: null, expired: true });
            return;
          }
          const blobReq = txn.objectStore(STORE_BLOBS).get(key);
          blobReq.onsuccess = () => {
            const entry = blobReq.result as CachedBlobEntry | undefined;
            resolve({ blob: entry?.blob ?? null, expired: false });
          };
          blobReq.onerror = () => reject(blobReq.error);
        };
        metaReq.onerror = () => reject(metaReq.error);
      })
    );

    if (result.expired) {
      await runTx<void>([STORE_BLOBS, STORE_META], 'readwrite', (txn) => {
        txn.objectStore(STORE_BLOBS).delete(key);
        txn.objectStore(STORE_META).delete(key);
      });
      return null;
    }
    if (!result.blob) return null;
    void touchLastAccess(key);
    return result.blob;
  } catch (err) {
    console.warn('[viewer-cache] get failed', err);
    return null;
  }
}

async function touchLastAccess(key: string): Promise<void> {
  try {
    await runTx<void>(STORE_META, 'readwrite', (txn) => new Promise<void>((resolve) => {
      const store = txn.objectStore(STORE_META);
      const req = store.get(key);
      req.onsuccess = () => {
        const meta = req.result as CachedBlobMeta | undefined;
        if (!meta) {
          resolve();
          return;
        }
        meta.lastAccessAt = Date.now();
        store.put(meta);
        resolve();
      };
      req.onerror = () => resolve();
    }));
  } catch {
    // best-effort
  }
}

export async function evictAll(): Promise<void> {
  try {
    await runTx<void>([STORE_BLOBS, STORE_META], 'readwrite', (txn) => {
      txn.objectStore(STORE_BLOBS).clear();
      txn.objectStore(STORE_META).clear();
    });
  } catch (err) {
    console.warn('[viewer-cache] clear failed', err);
  }
}

/**
 * LRU eviction triggered por presión de cuota. NO carga los blobs en RAM:
 * lee únicamente el store `blob-meta` (key/size/cachedAt/lastAccessAt),
 * ordena por lastAccessAt asc (LRU) y borra blobs+meta hasta que el size
 * acumulado restante baje del target.
 */
export async function evictViewerCacheLRU(targetRatio: number): Promise<void> {
  if (targetRatio <= 0 || targetRatio >= 1) return;

  let metas: CachedBlobMeta[] = [];
  try {
    metas = await runTx<CachedBlobMeta[]>(STORE_META, 'readonly', (txn) => new Promise((resolve, reject) => {
      const req = txn.objectStore(STORE_META).getAll();
      req.onsuccess = () => resolve((req.result ?? []) as CachedBlobMeta[]);
      req.onerror = () => reject(req.error);
    }));
  } catch {
    return;
  }
  if (metas.length === 0) return;

  const totalSize = metas.reduce((acc, m) => acc + (typeof m.size === 'number' ? m.size : 0), 0);
  if (totalSize === 0) return;
  const targetSize = totalSize * targetRatio;

  metas.sort((a, b) => (a.lastAccessAt ?? 0) - (b.lastAccessAt ?? 0));

  const toDelete: string[] = [];
  let pendingSize = totalSize;
  for (const meta of metas) {
    if (pendingSize <= targetSize) break;
    toDelete.push(meta.key);
    pendingSize -= meta.size;
  }
  if (toDelete.length === 0) return;

  try {
    await runTx<void>([STORE_BLOBS, STORE_META], 'readwrite', (txn) => {
      const blobs = txn.objectStore(STORE_BLOBS);
      const meta = txn.objectStore(STORE_META);
      for (const key of toDelete) {
        blobs.delete(key);
        meta.delete(key);
      }
    });
  } catch (err) {
    console.warn('[viewer-cache] eviction failed', err);
  }
}

export async function getCacheStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    return await runTx<{ count: number; totalBytes: number }>(STORE_META, 'readonly', (txn) => new Promise((resolve, reject) => {
      const req = txn.objectStore(STORE_META).getAll();
      req.onsuccess = () => {
        const items = (req.result ?? []) as CachedBlobMeta[];
        resolve({
          count: items.length,
          totalBytes: items.reduce((acc, m) => acc + (typeof m.size === 'number' ? m.size : 0), 0)
        });
      };
      req.onerror = () => reject(req.error);
    }));
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}
