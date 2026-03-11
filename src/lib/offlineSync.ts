/**
 * offlineSync.ts — Sync-queue processor.
 *
 * Processes pending offline operations when the network is restored.
 * FIFO order, up to MAX_RETRIES with exponential backoff.
 */

import {
  getPendingSyncItems,
  updateSyncItem,
  removeSyncItem,
  type SyncQueueItem
} from '@/lib/offlineStorage';
import { authFetch } from '@/services/apiClient';

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2_000; // 2s, 4s, 8s

export type SyncProgress = {
  total: number;
  processed: number;
  failed: number;
  current: string | null; // docId being processed
};

export type SyncProgressCallback = (progress: SyncProgress) => void;

// ─── Replay a single operation ─────────────────────────────────
async function replayOperation(item: SyncQueueItem): Promise<void> {
  const { operation, payload } = item;
  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  switch (operation) {
    case 'create': {
      const res = await authFetch('/api/documents', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      break;
    }

    case 'update': {
      const docId = payload.docId as string;
      const body = { ...payload };
      delete body.docId;
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      break;
    }

    case 'delete': {
      const docId = payload.docId as string;
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      // 404 is ok — already deleted on server
      if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
      break;
    }

    case 'rename': {
      const docId = payload.docId as string;
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: payload.name })
      });
      if (!res.ok) throw new Error(`Rename failed: ${res.status}`);
      break;
    }

    case 'move': {
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

// ─── Process the full queue ─────────────────────────────────────
let _processing = false;

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
        // Mark as processing
        await updateSyncItem({ ...item, status: 'processing' });
        await replayOperation(item);
        // Success — remove from queue
        if (item.id !== null && item.id !== undefined) await removeSyncItem(item.id);
        processed++;
      } catch (err) {
        const retries = (item.retries || 0) + 1;
        if (retries >= MAX_RETRIES) {
          await updateSyncItem({
            ...item,
            status: 'failed',
            retries,
            error: err instanceof Error ? err.message : String(err)
          });
          failed++;
        } else {
          // Back to pending with incremented retries — will be retried next cycle
          await updateSyncItem({
            ...item,
            status: 'pending',
            retries,
            error: err instanceof Error ? err.message : String(err)
          });
          // Exponential backoff delay before next item
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

export function isProcessing(): boolean {
  return _processing;
}

// ─── Auto-sync on connectivity ──────────────────────────────────
let _autoSyncCleanup: (() => void) | null = null;

export function startAutoSync(onProgress?: SyncProgressCallback): () => void {
  if (_autoSyncCleanup) _autoSyncCleanup();

  const handler = () => {
    // Small delay to ensure connection is stable
    setTimeout(() => {
      if (navigator.onLine) {
        processSyncQueue(onProgress).catch((err) =>
          console.warn('[offlineSync] Auto-sync failed:', err)
        );
      }
    }, 1_500);
  };

  window.addEventListener('online', handler);

  // Also try immediately if already online
  if (navigator.onLine) {
    handler();
  }

  _autoSyncCleanup = () => {
    window.removeEventListener('online', handler);
  };

  return _autoSyncCleanup;
}

// ─── Utility ────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
