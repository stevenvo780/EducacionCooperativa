/**
 * offlineStorage.ts — IndexedDB persistence layer for offline-first support.
 *
 * Stores: documents (metadata), document-content (raw text), sync-queue, meta.
 * Uses raw IndexedDB API (zero dependencies).
 */

const DB_NAME = 'agora-offline';
const DB_VERSION = 1;

// ─── Store names ────────────────────────────────────────────────
const STORE_DOCS = 'documents';
const STORE_CONTENT = 'document-content';
const STORE_QUEUE = 'sync-queue';
const STORE_META = 'meta';

// ─── Types ──────────────────────────────────────────────────────
export interface CachedDoc {
  id: string;
  name: string;
  type?: string;
  folder?: string;
  mimeType?: string;
  size?: number;
  storagePath?: string;
  workspaceId?: string;
  ownerId?: string;
  order?: number;
  updatedAt?: string;
  /** Timestamp when cached locally */
  _cachedAt: number;
}

export interface CachedContent {
  docId: string;
  content: string;
  updatedAt: number;
}

export type SyncOperation = 'create' | 'update' | 'delete' | 'rename' | 'move';

export interface SyncQueueItem {
  id?: number; // autoIncrement
  operation: SyncOperation;
  docId: string;
  /** Full payload needed to replay the operation */
  payload: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'processing' | 'failed';
  retries: number;
  error?: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

// ─── DB Singleton ───────────────────────────────────────────────
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

      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        const docsStore = db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
        docsStore.createIndex('workspaceId', 'workspaceId', { unique: false });
        docsStore.createIndex('folder', 'folder', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CONTENT)) {
        db.createObjectStore(STORE_CONTENT, { keyPath: 'docId' });
      }

      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, {
          keyPath: 'id',
          autoIncrement: true
        });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
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

// ─── Generic helpers ────────────────────────────────────────────
async function tx(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | void
): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = fn(store);
    if (result) {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    } else {
      transaction.oncomplete = () => resolve(undefined);
      transaction.onerror = () => reject(transaction.error);
    }
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  return (await tx(storeName, 'readonly', (s) => s.getAll())) as T[];
}

async function getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return (await tx(storeName, 'readonly', (s) => s.get(key))) as T | undefined;
}

async function putItem(storeName: string, item: unknown): Promise<void> {
  await tx(storeName, 'readwrite', (s) => s.put(item));
}

async function deleteByKey(storeName: string, key: IDBValidKey): Promise<void> {
  await tx(storeName, 'readwrite', (s) => s.delete(key));
}

// ─── Documents ──────────────────────────────────────────────────
export async function cacheDocuments(docs: CachedDoc[]): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_DOCS, 'readwrite');
  const store = transaction.objectStore(STORE_DOCS);
  const now = Date.now();
  for (const doc of docs) {
    store.put({ ...doc, _cachedAt: now });
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedDocuments(workspaceId: string): Promise<CachedDoc[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DOCS, 'readonly');
    const store = transaction.objectStore(STORE_DOCS);
    const index = store.index('workspaceId');
    const request = index.getAll(workspaceId);
    request.onsuccess = () => resolve(request.result as CachedDoc[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedDoc(docId: string): Promise<CachedDoc | undefined> {
  return getByKey<CachedDoc>(STORE_DOCS, docId);
}

export async function deleteCachedDoc(docId: string): Promise<void> {
  await deleteByKey(STORE_DOCS, docId);
  await deleteByKey(STORE_CONTENT, docId);
}

export async function clearCachedDocs(workspaceId: string): Promise<void> {
  const docs = await getCachedDocuments(workspaceId);
  const db = await openDB();
  const transaction = db.transaction([STORE_DOCS, STORE_CONTENT], 'readwrite');
  const docStore = transaction.objectStore(STORE_DOCS);
  const contentStore = transaction.objectStore(STORE_CONTENT);
  for (const doc of docs) {
    docStore.delete(doc.id);
    contentStore.delete(doc.id);
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ─── Document Content ───────────────────────────────────────────
export async function cacheDocContent(docId: string, content: string): Promise<void> {
  await putItem(STORE_CONTENT, { docId, content, updatedAt: Date.now() } as CachedContent);
}

export async function getCachedContent(docId: string): Promise<string | null> {
  const entry = await getByKey<CachedContent>(STORE_CONTENT, docId);
  return entry?.content ?? null;
}

// ─── Sync Queue ─────────────────────────────────────────────────
export async function enqueueSync(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORE_QUEUE);
    const index = store.index('status');
    const request = index.getAll('pending');
    request.onsuccess = () => {
      const items = (request.result as SyncQueueItem[]).sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getFailedSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORE_QUEUE);
    const index = store.index('status');
    const request = index.getAll('failed');
    request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSyncItems(): Promise<SyncQueueItem[]> {
  return getAllFromStore<SyncQueueItem>(STORE_QUEUE);
}

export async function updateSyncItem(item: SyncQueueItem): Promise<void> {
  await putItem(STORE_QUEUE, item);
}

export async function removeSyncItem(id: number): Promise<void> {
  await deleteByKey(STORE_QUEUE, id);
}

export async function clearCompletedSync(): Promise<void> {
  const all = await getAllSyncItems();
  const db = await openDB();
  const transaction = db.transaction(STORE_QUEUE, 'readwrite');
  const store = transaction.objectStore(STORE_QUEUE);
  for (const item of all) {
    if (item.status !== 'pending' && item.status !== 'processing' && item.id !== null && item.id !== undefined) {
      store.delete(item.id);
    }
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getSyncQueueCount(): Promise<number> {
  const items = await getPendingSyncItems();
  return items.length;
}

// ─── Meta ───────────────────────────────────────────────────────
export async function setMeta(key: string, value: unknown): Promise<void> {
  await putItem(STORE_META, { key, value });
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const entry = await getByKey<MetaEntry>(STORE_META, key);
  return entry?.value as T | undefined;
}

// ─── Utility ────────────────────────────────────────────────────
export async function isOfflineStorageAvailable(): Promise<boolean> {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}

export async function getOfflineStorageStats(): Promise<{
  docCount: number;
  contentCount: number;
  queueCount: number;
}> {
  const docs = await getAllFromStore<CachedDoc>(STORE_DOCS);
  const content = await getAllFromStore<CachedContent>(STORE_CONTENT);
  const queue = await getAllSyncItems();
  return {
    docCount: docs.length,
    contentCount: content.length,
    queueCount: queue.filter((q) => q.status === 'pending').length
  };
}
