/**
 * offlineSync.ts — Sync-queue processor.
 *
 * Processes pending offline operations when the network is restored.
 * FIFO order, up to MAX_RETRIES with exponential backoff.
 */

import {
  getPendingSyncItems,
  SyncOperation,
  SyncQueueStatus,
  updateSyncItem,
  removeSyncItem,
  type SyncConflictDetails,
  type SyncQueueItem
} from '@/lib/offlineStorage';
import { authFetch } from '@/services/apiClient';

/**
 * Excepción dedicada para conflictos: el servidor respondió 409 porque la
 * versión local está obsoleta. El detalle se persiste en el queue item para
 * que la UI lo resuelva.
 */
export class SyncConflictError extends Error {
  details: SyncConflictDetails;
  constructor(details: SyncConflictDetails) {
    super('Conflicto de versión: el documento fue modificado por otra persona');
    this.name = 'SyncConflictError';
    this.details = details;
  }
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2_000; // 2s, 4s, 8s

/**
 * Decodifica la respuesta 409 del servidor al replay de un Update.
 * El servidor puede devolver `{ serverVersion, content, updatedBy, updatedAt }`
 * para permitir resolución informada del conflicto.
 */
async function parseConflictResponse(
  res: Response,
  localVersion: number | undefined
): Promise<SyncConflictDetails> {
  const details: SyncConflictDetails = { localVersion };
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.serverVersion === 'number') details.serverVersion = body.serverVersion;
    if (typeof body.content === 'string') details.serverContent = body.content;
    if (typeof body.updatedBy === 'string') details.serverUpdatedBy = body.updatedBy;
    if (typeof body.updatedAt === 'string') details.serverUpdatedAt = body.updatedAt;
  } catch {
    // El servidor envió 409 sin cuerpo JSON; no rompemos por eso.
  }
  return details;
}

export type SyncProgress = {
  total: number;
  processed: number;
  failed: number;
  current: string | null; // docId being processed
};

export type SyncProgressCallback = (progress: SyncProgress) => void;

/**
 * Replays a single offline operation by sending the appropriate API request.
 * @param item - The sync queue item to replay.
 */
async function replayOperation(item: SyncQueueItem): Promise<void> {
  const { operation, payload } = item;
  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  switch (operation) {
    case SyncOperation.Create: {
      const res = await authFetch('/api/documents', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      break;
    }

    case SyncOperation.Update: {
      const docId = payload.docId as string;
      const body = { ...payload };
      delete body.docId;
      const headers: Record<string, string> = { ...JSON_HEADERS };
      // Si el cliente conoce la versión local, manda If-Match para detección
      // optimista de conflictos en el servidor.
      const localVersion = typeof payload.expectedVersion === 'number' ? payload.expectedVersion : undefined;
      if (typeof localVersion === 'number') headers['If-Match'] = String(localVersion);
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });
      if (res.status === 409) {
        const details = await parseConflictResponse(res, localVersion);
        throw new SyncConflictError(details);
      }
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      break;
    }

    case SyncOperation.Delete: {
      const docId = payload.docId as string;
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      // 404 is ok — already deleted on server
      if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
      break;
    }

    case SyncOperation.Rename: {
      const docId = payload.docId as string;
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: payload.name })
      });
      if (!res.ok) throw new Error(`Rename failed: ${res.status}`);
      break;
    }

    case SyncOperation.Move: {
      const docId = payload.docId as string;
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ folder: payload.folder })
      });
      if (!res.ok) throw new Error(`Move failed: ${res.status}`);
      break;
    }

    default:
      throw new Error(`Unknown sync operation: ${operation}`);
  }
}

let _processing = false;

/**
 * Processes the full offline sync queue.
 * @param onProgress - Optional callback to track sync progress.
 * @returns Object containing the number of processed and failed items.
 */
export async function processSyncQueue(
  onProgress?: SyncProgressCallback
): Promise<{ processed: number; failed: number }> {
  if (_processing) return { processed: 0, failed: 0 };
  _processing = true;

  let processed = 0;
  let failed = 0;

  try {
    const items = await getPendingSyncItems();
    const total = items.length;

    if (total === 0) {
      onProgress?.({ total: 0, processed: 0, failed: 0, current: null });
      return { processed: 0, failed: 0 };
    }

    for (const item of items) {
      onProgress?.({ total, processed, failed, current: item.docId });

      try {
        await updateSyncItem({ ...item, status: SyncQueueStatus.Processing });
        await replayOperation(item);
        if (item.id !== null && item.id !== undefined) await removeSyncItem(item.id);
        processed++;
      } catch (err) {
        // Conflicto: NO reintentamos, marcamos como Conflict y guardamos
        // los detalles para que la UI ofrezca resolución al usuario.
        if (err instanceof SyncConflictError) {
          await updateSyncItem({
            ...item,
            status: SyncQueueStatus.Conflict,
            error: err.message,
            conflict: err.details
          });
          failed++;
          continue;
        }

        const retries = (item.retries || 0) + 1;
        if (retries >= MAX_RETRIES) {
          await updateSyncItem({
            ...item,
            status: SyncQueueStatus.Failed,
            retries,
            error: err instanceof Error ? err.message : String(err)
          });
          failed++;
        } else {
          await updateSyncItem({
            ...item,
            status: SyncQueueStatus.Pending,
            retries,
            error: err instanceof Error ? err.message : String(err)
          });
          await sleep(BASE_BACKOFF_MS * Math.pow(2, retries - 1));
        }
      }
    }

    onProgress?.({ total, processed, failed, current: null });
  } finally {
    _processing = false;
  }

  return { processed, failed };
}

/**
 * Checks if the sync queue is currently being processed.
 */
export function isProcessing(): boolean {
  return _processing;
}

let _autoSyncCleanup: (() => void) | null = null;

/**
 * Starts automatic synchronization when the network connection is restored.
 * @param onProgress - Optional callback to track sync progress.
 * @returns A cleanup function to stop auto-sync.
 */
export function startAutoSync(onProgress?: SyncProgressCallback): () => void {
  if (_autoSyncCleanup) _autoSyncCleanup();

  const handler = () => {
    setTimeout(() => {
      if (navigator.onLine) {
        processSyncQueue(onProgress).catch((err) =>
          console.warn('[offlineSync] Auto-sync failed:', err)
        );
      }
    }, 1_500);
  };

  window.addEventListener('online', handler);

  if (navigator.onLine) {
    handler();
  }

  _autoSyncCleanup = () => {
    window.removeEventListener('online', handler);
  };

  return _autoSyncCleanup;
}

/**
 * Helper to delay execution.
 * @param ms - Milliseconds to sleep.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
