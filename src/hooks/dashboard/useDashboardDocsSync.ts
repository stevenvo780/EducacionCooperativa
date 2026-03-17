'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { DocItem, Workspace } from '@/components/dashboard/types';
import { fetchDocsApi } from '@/services/dashboardApi';
import { useSyncEvents } from '@/hooks/useSyncEvents';
import type { User as FirebaseUser } from 'firebase/auth';
import { PERSONAL_WORKSPACE_ID, WorkspaceType } from '@/types/workspace';

interface SyncRequestOptions {
  delayMs?: number;
  showLoading?: boolean;
  force?: boolean;
}

interface UseDashboardDocsSyncParams {
  user: FirebaseUser | null;
  currentWorkspace: Workspace | null;
  docsLength: number;
  isOnline: boolean;
  pendingCount: number;
  isPageVisible: boolean;
  syncNow: () => Promise<unknown>;
  personalWorkspaceId: string;
  applyDocsSnapshot: (fetched: DocItem[]) => void;
  setLoadingDocs: (value: boolean) => void;
  onDocChangeCallback?: ((callback: (event: { workspaceId?: string | null }) => void) => (() => void) | void) | null;
}

export const useDashboardDocsSync = ({
  user,
  currentWorkspace,
  docsLength,
  isOnline,
  pendingCount,
  isPageVisible,
  syncNow,
  personalWorkspaceId,
  applyDocsSnapshot,
  setLoadingDocs,
  onDocChangeCallback
}: UseDashboardDocsSyncParams) => {
  const fetchInFlightRef = useRef<Promise<void> | null>(null);
  const pendingRefetchRef = useRef(false);
  const syncFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncEventRef = useRef(0);
  const lastDocsFetchAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (syncFetchTimerRef.current) {
        clearTimeout(syncFetchTimerRef.current);
        syncFetchTimerRef.current = null;
      }
      if (docsRefreshTimerRef.current) {
        clearTimeout(docsRefreshTimerRef.current);
        docsRefreshTimerRef.current = null;
      }
    };
  }, []);

  const fetchDocs = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!user || !currentWorkspace) return;
    if (fetchInFlightRef.current) {
      pendingRefetchRef.current = true;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Sync] fetchDocs skipped (in-flight), trailing refetch queued');
      }
      return fetchInFlightRef.current;
    }

    const showLoading = options?.showLoading ?? docsLength === 0;
    if (showLoading) {
      setLoadingDocs(true);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Sync] fetchDocs starting API call…');
    }

    const fetchPromise = (async () => {
      try {
        const workspaceId = currentWorkspace.id === personalWorkspaceId ? PERSONAL_WORKSPACE_ID : currentWorkspace.id;
        const fetched = await fetchDocsApi({
          workspaceId,
          ownerId: currentWorkspace.id === personalWorkspaceId ? user.uid : undefined,
          view: 'metadata'
        });

        if (process.env.NODE_ENV !== 'production') {
          console.debug('[Sync] fetchDocs got', fetched.length, 'docs from API');
        }

        applyDocsSnapshot(fetched);
      } catch (error) {
        console.error('Error fetching docs', error);
      }
    })();

    fetchInFlightRef.current = fetchPromise;

    try {
      await fetchPromise;
    } finally {
      fetchInFlightRef.current = null;
      lastDocsFetchAtRef.current = Date.now();
      if (showLoading) {
        setLoadingDocs(false);
      }
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        setTimeout(() => {
          void fetchDocs();
        }, 800);
      }
    }
  }, [user, currentWorkspace, docsLength, personalWorkspaceId, applyDocsSnapshot, setLoadingDocs]);

  const requestDocsRefresh = useCallback((options?: SyncRequestOptions) => {
    const delayMs = options?.delayMs ?? 250;
    const showLoading = options?.showLoading ?? false;
    const force = options?.force ?? false;

    if (docsRefreshTimerRef.current) {
      clearTimeout(docsRefreshTimerRef.current);
      docsRefreshTimerRef.current = null;
    }

    const elapsed = Date.now() - lastDocsFetchAtRef.current;
    const throttleDelay = !force && elapsed < 1200 ? 1200 - elapsed : 0;
    const effectiveDelay = Math.max(delayMs, throttleDelay);

    return new Promise<void>((resolve) => {
      docsRefreshTimerRef.current = setTimeout(() => {
        docsRefreshTimerRef.current = null;
        Promise.resolve(fetchDocs(showLoading ? { showLoading: true } : undefined))
          .finally(resolve);
      }, effectiveDelay);
    });
  }, [fetchDocs]);

  useEffect(() => {
    if (!currentWorkspace || !user) return;
    void fetchDocs({ showLoading: true });
  }, [currentWorkspace, user, fetchDocs]);

  useEffect(() => {
    if (!isOnline || !currentWorkspace || !user || pendingCount <= 0) return;
    syncNow()
      .then(() => requestDocsRefresh({ force: true }))
      .catch(() => requestDocsRefresh({ force: true }));
  }, [isOnline, currentWorkspace, user, pendingCount, syncNow, requestDocsRefresh]);

  const scheduleSyncFetch = useCallback(() => {
    if (!isPageVisible) return;
    lastSyncEventRef.current = Date.now();
    if (syncFetchTimerRef.current) {
      clearTimeout(syncFetchTimerRef.current);
    }
    syncFetchTimerRef.current = setTimeout(() => {
      syncFetchTimerRef.current = null;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Sync] debounced fetch triggered');
      }
      void requestDocsRefresh({ delayMs: 0 });
    }, 600);
  }, [isPageVisible, requestDocsRefresh]);

  const handleSyncEvent = useCallback((event: { type: string; path: string }) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Sync] RTDB event received:', event.type, event.path);
    }
    scheduleSyncFetch();
  }, [scheduleSyncFetch]);

  useSyncEvents({
    workspaceId: currentWorkspace?.id === personalWorkspaceId ? null : currentWorkspace?.id || null,
    userId: user?.uid || null,
    workspaceType: currentWorkspace?.id === personalWorkspaceId ? WorkspaceType.Personal : WorkspaceType.Shared,
    onEvent: handleSyncEvent,
    enabled: !!currentWorkspace && !!user && isPageVisible
  });

  useEffect(() => {
    if (!currentWorkspace || !user || !isPageVisible) return;
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastSyncEventRef.current >= 60000) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[Sync] fallback polling triggered (no RTDB event in 60s)');
        }
        void requestDocsRefresh({ force: true, delayMs: 0 });
      }
    }, 60000);

    return () => {
      clearInterval(intervalId);
      if (syncFetchTimerRef.current) {
        clearTimeout(syncFetchTimerRef.current);
        syncFetchTimerRef.current = null;
      }
    };
  }, [currentWorkspace, user, isPageVisible, requestDocsRefresh]);

  useEffect(() => {
    if (!isPageVisible || !currentWorkspace || !user) return;
    void requestDocsRefresh({ force: true, delayMs: 0 });
  }, [isPageVisible, currentWorkspace, user, requestDocsRefresh]);

  useEffect(() => {
    if (!currentWorkspace || !user || !onDocChangeCallback) return;

    const unsubscribe = onDocChangeCallback((event) => {
      const eventWorkspaceId = event.workspaceId;
      const currentWorkspaceToken = currentWorkspace.id === personalWorkspaceId
        ? `${PERSONAL_WORKSPACE_ID}:${user.uid}`
        : currentWorkspace.id;

      if (eventWorkspaceId === currentWorkspaceToken || eventWorkspaceId === currentWorkspace.id) {
        scheduleSyncFetch();
      }
    });

    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [currentWorkspace, user, onDocChangeCallback, personalWorkspaceId, scheduleSyncFetch]);

  return {
    fetchDocs,
    requestDocsRefresh
  };
};
