/**
 * useOfflineSync.ts — React hook for offline sync orchestration.
 *
 * Combines connectivity detection, sync-queue processing, and progress state.
 * Exposes everything the UI needs: isOnline, isSyncing, pendingCount, lastSyncAt.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { processSyncQueue, type SyncProgress } from '@/lib/offlineSync';
import {
  getSyncQueueCount,
  getFailedSyncItems,
  clearCompletedSync
} from '@/lib/offlineStorage';

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  syncProgress: SyncProgress | null;
}

export function useOfflineSync() {
  // Always start as online=true on server; real status set in useEffect after mount
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    lastSyncAt: null,
    syncProgress: null
  });

  const isMounted = useRef(true);

  // ─── Connectivity listeners ──────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    // Determine real connectivity: navigator.onLine can be unreliable
    // (returns false in headless/server environments). Cross-check with a
    // lightweight fetch if navigator.onLine says offline.
    const checkRealConnectivity = async (): Promise<boolean> => {
      if (navigator.onLine) return true;
      // navigator.onLine is false — verify with a real request
      try {
        const res = await fetch('/api/auth', { method: 'HEAD', cache: 'no-store' });
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

    const goOnline = () => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isOnline: true }));
      }
    };
    const goOffline = () => {
      // Double-check: navigator.onLine can lie
      checkRealConnectivity().then((stillOnline) => {
        if (isMounted.current) {
          setState(prev => ({ ...prev, isOnline: stillOnline }));
        }
      });
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      isMounted.current = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ─── Refresh queue counts ────────────────────────────────────
  const refreshCounts = useCallback(async () => {
    try {
      const pending = await getSyncQueueCount();
      const failed = await getFailedSyncItems();
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          pendingCount: pending,
          failedCount: failed.length
        }));
      }
    } catch {
      // IDB not available
    }
  }, []);

  // Poll counts periodically (every 5s) so UI stays current
  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 5000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  // ─── Auto-sync when going online ────────────────────────────
  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;

    setState(prev => ({ ...prev, isSyncing: true, syncProgress: null }));

    try {
      const result = await processSyncQueue((progress) => {
        if (isMounted.current) {
          setState(prev => ({ ...prev, syncProgress: progress }));
        }
      });

      // Cleanup completed items
      await clearCompletedSync();

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncAt: Date.now(),
          syncProgress: null
        }));
      }

      // Refresh counts after sync
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

  // Auto-trigger sync when going online
  useEffect(() => {
    if (state.isOnline && state.pendingCount > 0 && !state.isSyncing) {
      const timer = setTimeout(() => {
        syncNow();
      }, 2000); // 2s delay to ensure stable connection
      return () => clearTimeout(timer);
    }
  }, [state.isOnline, state.pendingCount, state.isSyncing, syncNow]);

  // ─── Retry failed items ──────────────────────────────────────
  const retryFailed = useCallback(async () => {
    try {
      const failed = await getFailedSyncItems();
      const { updateSyncItem } = await import('@/lib/offlineStorage');
      for (const item of failed) {
        await updateSyncItem({ ...item, status: 'pending', retries: 0, error: undefined });
      }
      await refreshCounts();
      // Trigger sync
      await syncNow();
    } catch (err) {
      console.warn('[useOfflineSync] Retry failed:', err);
    }
  }, [refreshCounts, syncNow]);

  return {
    ...state,
    syncNow,
    retryFailed,
    refreshCounts
  };
}

export default useOfflineSync;
