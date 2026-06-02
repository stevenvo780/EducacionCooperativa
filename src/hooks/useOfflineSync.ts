/**
 * Hook para la orquestación de la sincronización offline.
 *
 * Combina la detección de conectividad, el procesamiento de la cola de sincronización
 * y el estado de progreso para la interfaz de usuario.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { processSyncQueue, type SyncProgress } from '@/lib/offlineSync';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { apiUrl } from '@/services/apiClient';
import {
  clearCompletedSync,
  getConflictSyncItems,
  getFailedSyncItems,
  getSyncQueueCount,
  removeSyncItem,
  SyncQueueStatus,
  updateSyncItem,
  type SyncQueueItem
} from '@/lib/offlineStorage';

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  conflicts: SyncQueueItem[];
  lastSyncAt: number | null;
  syncProgress: SyncProgress | null;
}

/**
 * Gestiona el estado y la lógica de sincronización offline de la aplicación.
 */
export function useOfflineSync() {
  const isPageVisible = usePageVisibility();

  const [state, setState] = useState<OfflineSyncState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    conflicts: [],
    lastSyncAt: null,
    syncProgress: null
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    /**
     * Determina la conectividad real realizando una petición HEAD.
     * navigator.onLine puede ser poco fiable en ciertos entornos.
     */
    const checkRealConnectivity = async (): Promise<boolean> => {
      if (navigator.onLine) return true;
      try {
        const res = await fetch(apiUrl('/api/auth'), { method: 'HEAD', cache: 'no-store' });
        return res.ok || res.status === 405 || res.status === 401;
      } catch {
        return false;
      }
    };

    checkRealConnectivity().then((online) => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isOnline: online }));
      }
    });

    const goOffline = () => {
      checkRealConnectivity().then((stillOnline) => {
        if (isMounted.current) {
          setState(prev => ({ ...prev, isOnline: stillOnline }));
        }
      });
    };

    window.addEventListener('offline', goOffline);

    return () => {
      isMounted.current = false;
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /**
   * Refresca los contadores de la cola de sincronización desde IndexedDB.
   */
  const refreshCounts = useCallback(async () => {
    try {
      const [pending, failed, conflicts] = await Promise.all([
        getSyncQueueCount(),
        getFailedSyncItems(),
        getConflictSyncItems()
      ]);
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          pendingCount: pending,
          failedCount: failed.length,
          conflictCount: conflicts.length,
          conflicts
        }));
      }
    } catch {
      // IndexedDB no disponible
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isOnline: true }));
        void refreshCounts();
      }
    };
    const onEnqueued = () => {
      if (isMounted.current) void refreshCounts();
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('agora:sync-enqueued', onEnqueued);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('agora:sync-enqueued', onEnqueued);
    };
  }, [refreshCounts]);

  useEffect(() => {
    refreshCounts();
    if (!isPageVisible) return;
    const interval = setInterval(refreshCounts, 60000);
    return () => clearInterval(interval);
  }, [refreshCounts, isPageVisible]);

  /**
   * Dispara el proceso de sincronización de manera inmediata si hay conexión.
   */
  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;

    setState(prev => ({ ...prev, isSyncing: true, syncProgress: null }));

    try {
      const result = await processSyncQueue((progress) => {
        if (isMounted.current) {
          setState(prev => ({ ...prev, syncProgress: progress }));
        }
      });

      await clearCompletedSync();

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncAt: Date.now(),
          syncProgress: null
        }));
      }

      await refreshCounts();
      return result;
    } catch (err) {
      console.warn('[useOfflineSync] Sync failed:', err);
      if (isMounted.current) {
        setState(prev => ({ ...prev, isSyncing: false, syncProgress: null }));
      }
      await refreshCounts();
      return { processed: 0, failed: 0 };
    }
  }, [refreshCounts]);

  useEffect(() => {
    if (state.isOnline && state.pendingCount > 0 && !state.isSyncing) {
      const timer = setTimeout(() => {
        syncNow();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.isOnline, state.pendingCount, state.isSyncing, syncNow]);

  /**
   * Mantener la versión local: re-encola el item con la versión del servidor
   * como expectedVersion para que el próximo replay pase el If-Match.
   */
  const keepLocalConflict = useCallback(async (item: SyncQueueItem) => {
    if (item.id === undefined || item.id === null) return;
    const serverVersion = item.conflict?.serverVersion;
    const nextPayload = { ...item.payload };
    if (typeof serverVersion === 'number') nextPayload.expectedVersion = serverVersion;
    await updateSyncItem({
      ...item,
      payload: nextPayload,
      status: SyncQueueStatus.Pending,
      retries: 0,
      error: undefined,
      conflict: undefined
    });
    await refreshCounts();
    await syncNow();
  }, [refreshCounts, syncNow]);

  /**
   * Aceptar la versión del servidor: descarta el cambio local sin pushearlo.
   */
  const acceptServerConflict = useCallback(async (item: SyncQueueItem) => {
    if (item.id === undefined || item.id === null) return;
    await removeSyncItem(item.id);
    await refreshCounts();
  }, [refreshCounts]);

  /**
   * Reintenta procesar los elementos fallidos de la cola.
   */
  const retryFailed = useCallback(async () => {
    try {
      const failed = await getFailedSyncItems();
      const { updateSyncItem } = await import('@/lib/offlineStorage');
      for (const item of failed) {
        await updateSyncItem({ ...item, status: SyncQueueStatus.Pending, retries: 0, error: undefined });
      }
      await refreshCounts();
      await syncNow();
    } catch (err) {
      console.warn('[useOfflineSync] Retry failed:', err);
    }
  }, [refreshCounts, syncNow]);

  return {
    ...state,
    syncNow,
    retryFailed,
    refreshCounts,
    keepLocalConflict,
    acceptServerConflict
  };
}

export default useOfflineSync;
