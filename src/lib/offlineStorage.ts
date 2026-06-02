/**
 * offlineStorage.ts — Capa de persistencia en IndexedDB para soporte offline-first.
 *
 * Almacena: metadatos de documentos, contenido en bruto, cola de sincronización y metadatos.
 * Utiliza la API nativa de IndexedDB para evitar dependencias externas.
 */

const DB_NAME = 'agora-offline';
const DB_VERSION = 1;

const STORE_DOCS = 'documents';
const STORE_CONTENT = 'document-content';
const STORE_QUEUE = 'sync-queue';
const STORE_META = 'meta';

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
  _cachedAt: number;
}

export interface CachedContent {
  docId: string;
  content: string;
  updatedAt: number;
}

export enum SyncOperation {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Rename = 'rename',
  Move = 'move'
}

export enum SyncQueueStatus {
  Pending = 'pending',
  Processing = 'processing',
  Failed = 'failed',
  /** Servidor rechazó el cambio porque la versión local está obsoleta. Requiere
   *  intervención del usuario para resolverlo. */
  Conflict = 'conflict'
}

export interface SyncConflictDetails {
  /** Versión local que el cliente intentó subir. */
  localVersion?: number;
  /** Versión actual en el servidor. */
  serverVersion?: number;
  /** Snapshot del contenido tal como está en el servidor (si lo trajo el 409). */
  serverContent?: string;
  /** updatedBy del servidor cuando ocurrió el conflicto. */
  serverUpdatedBy?: string;
  serverUpdatedAt?: string;
}

export interface SyncQueueItem {
  id?: number;
  operation: SyncOperation;
  docId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  status: SyncQueueStatus;
  retries: number;
  error?: string;
  /** Detalles del conflicto cuando status === Conflict. */
  conflict?: SyncConflictDetails;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

let _dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Abre la conexión a la base de datos IndexedDB con la configuración de stores necesaria.
 */
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

/**
 * Helper para ejecutar una transacción en un store de IndexedDB.
 */
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

/**
 * Almacena múltiples documentos en caché.
 */
export async function cacheDocuments(docs: CachedDoc[]): Promise<void> {
  try {
    await writeCachedDocuments(docs);
  } catch (err) {
    const { isQuotaExceededError, checkQuotaAndEvict } = await import('./idb-eviction');
    if (!isQuotaExceededError(err)) throw err;
    await checkQuotaAndEvict();
    await writeCachedDocuments(docs);
  }
}

async function writeCachedDocuments(docs: CachedDoc[]): Promise<void> {
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

/**
 * Obtiene los documentos cacheados de un workspace específico.
 */
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

/**
 * Obtiene un documento específico por su ID.
 */
export async function getCachedDoc(docId: string): Promise<CachedDoc | undefined> {
  return getByKey<CachedDoc>(STORE_DOCS, docId);
}

/**
 * Elimina un documento y su contenido de la caché.
 */
export async function deleteCachedDoc(docId: string): Promise<void> {
  await deleteByKey(STORE_DOCS, docId);
  await deleteByKey(STORE_CONTENT, docId);
}

/**
 * Limpia todos los documentos y contenidos cacheados de un workspace.
 */
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

/**
 * Almacena el contenido textual de un documento en caché.
 */
export async function cacheDocContent(docId: string, content: string): Promise<void> {
  const entry: CachedContent = { docId, content, updatedAt: Date.now() };
  try {
    await putItem(STORE_CONTENT, entry);
  } catch (err) {
    const { isQuotaExceededError, checkQuotaAndEvict } = await import('./idb-eviction');
    if (!isQuotaExceededError(err)) throw err;
    await checkQuotaAndEvict();
    await putItem(STORE_CONTENT, entry);
  }
}

/**
 * Elimina entries de la cache de documentos cuyo `_cachedAt` supere `maxAgeMs`.
 * Usa cursor sobre el store y borra in-place; no carga todo en RAM. La cache
 * de contenido asociada se borra en paralelo para mantener consistencia.
 */
export async function evictOldDocsCache(maxAgeMs: number): Promise<void> {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return;
  const cutoff = Date.now() - maxAgeMs;
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }
  const evicted: string[] = [];
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_DOCS, 'readwrite');
    const store = transaction.objectStore(STORE_DOCS);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const v = cursor.value as CachedDoc | undefined;
      if (v && typeof v._cachedAt === 'number' && v._cachedAt < cutoff) {
        evicted.push(v.id);
        cursor.delete();
      }
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });

  if (evicted.length === 0) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_CONTENT, 'readwrite');
    const store = transaction.objectStore(STORE_CONTENT);
    for (const id of evicted) store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

/**
 * Recupera el contenido cacheadó de un documento.
 */
export async function getCachedContent(docId: string): Promise<string | null> {
  const entry = await getByKey<CachedContent>(STORE_CONTENT, docId);
  return entry?.content ?? null;
}

/**
 * Añade una operación a la cola de sincronización.
 * Emite 'agora:sync-enqueued' para que useOfflineSync refresque
 * los contadores sin esperar el intervalo de 60s.
 */
export async function enqueueSync(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await openDB();
  const id = await new Promise<number>((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('agora:sync-enqueued'));
  }
  return id;
}

/**
 * Obtiene los elementos pendientes de sincronizar, ordenados por fecha.
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORE_QUEUE);
    const index = store.index('status');
    const request = index.getAll(SyncQueueStatus.Pending);
    request.onsuccess = () => {
      const items = (request.result as SyncQueueItem[]).sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene los elementos que están en estado de conflicto (servidor rechazó
 * por versión obsoleta). Requieren intervención del usuario.
 */
export async function getConflictSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORE_QUEUE);
    const index = store.index('status');
    const request = index.getAll(SyncQueueStatus.Conflict);
    request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene los elementos que han fallado tras el número máximo de reintentos.
 */
export async function getFailedSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORE_QUEUE);
    const index = store.index('status');
    const request = index.getAll(SyncQueueStatus.Failed);
    request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las operaciones de la cola de sincronización.
 */
export async function getAllSyncItems(): Promise<SyncQueueItem[]> {
  return getAllFromStore<SyncQueueItem>(STORE_QUEUE);
}

/**
 * Actualiza una entrada de la cola de sincronización.
 */
export async function updateSyncItem(item: SyncQueueItem): Promise<void> {
  await putItem(STORE_QUEUE, item);
}

/**
 * Elimina una entrada de la cola de sincronización por su ID.
 */
export async function removeSyncItem(id: number): Promise<void> {
  await deleteByKey(STORE_QUEUE, id);
}

/**
 * Elimina de la cola todos los elementos que no estén pendientes o en proceso.
 */
export async function clearCompletedSync(): Promise<void> {
  const all = await getAllSyncItems();
  const db = await openDB();
  const transaction = db.transaction(STORE_QUEUE, 'readwrite');
  const store = transaction.objectStore(STORE_QUEUE);
  for (const item of all) {
    if (item.status !== SyncQueueStatus.Pending && item.status !== SyncQueueStatus.Processing && item.id !== null && item.id !== undefined) {
      store.delete(item.id);
    }
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Obtiene el número de operaciones pendientes en la cola.
 */
export async function getSyncQueueCount(): Promise<number> {
  const items = await getPendingSyncItems();
  return items.length;
}

/**
 * Establece un valor en el store de metadatos.
 */
export async function setMeta(key: string, value: unknown): Promise<void> {
  await putItem(STORE_META, { key, value });
}

/**
 * Obtiene un valor del store de metadatos por su clave.
 */
export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const entry = await getByKey<MetaEntry>(STORE_META, key);
  return entry?.value as T | undefined;
}

/**
 * Verifica si IndexedDB está disponible y funcional.
 */
export async function isOfflineStorageAvailable(): Promise<boolean> {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtiene estadísticas sobre el uso del almacenamiento offline.
 */
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
    queueCount: queue.filter((q) => q.status === SyncQueueStatus.Pending).length
  };
}
