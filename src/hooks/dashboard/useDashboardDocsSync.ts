'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { DocItem, Workspace } from '@/components/dashboard/types';
import { fetchDocsApi } from '@/services/dashboardApi';
import type { User as FirebaseUser } from 'firebase/auth';
import type { AgentDocumentsMutatedEventDetail } from '@/lib/agora-ai/types';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

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
  const pendingRefetchOptionsRef = useRef<{ showLoading?: boolean } | undefined>(undefined);
  const fetchDocsRef = useRef<((options?: { showLoading?: boolean }) => Promise<void>) | null>(null);
  const latestStateRef = useRef({
    user,
    currentWorkspace,
    docsLength,
    applyDocsSnapshot,
    setLoadingDocs
  });

  latestStateRef.current = {
    user,
    currentWorkspace,
    docsLength,
    applyDocsSnapshot,
    setLoadingDocs
  };

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

  const resolveWorkspaceRequest = useCallback((workspace: Workspace | null, currentUser: FirebaseUser | null) => {
    if (!workspace || !currentUser) return null;

    return {
      workspaceId: workspace.id === personalWorkspaceId ? PERSONAL_WORKSPACE_ID : workspace.id,
      ownerId: workspace.id === personalWorkspaceId ? currentUser.uid : undefined
    };
  }, [personalWorkspaceId]);

  const fetchDocs = useCallback(async (options?: { showLoading?: boolean }) => {
    const latestState = latestStateRef.current;
    const request = resolveWorkspaceRequest(latestState.currentWorkspace, latestState.user);
    if (!request) return;

    if (fetchInFlightRef.current) {
      pendingRefetchRef.current = true;
      pendingRefetchOptionsRef.current = {
        showLoading: Boolean(pendingRefetchOptionsRef.current?.showLoading || options?.showLoading)
      };
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Sync] fetchDocs skipped (in-flight), trailing refetch queued');
      }
      return fetchInFlightRef.current;
    }

    const showLoading = options?.showLoading ?? latestState.docsLength === 0;
    if (showLoading) {
      latestState.setLoadingDocs(true);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Sync] fetchDocs starting API call…');
    }

    const requestWorkspaceId = request.workspaceId;
    const fetchPromise = (async () => {
      try {
        const fetched = await fetchDocsApi({
          workspaceId: request.workspaceId,
          ownerId: request.ownerId,
          view: 'metadata'
        });

        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Sync] fetchDocs got', fetched.length, 'docs from API');
        }

        const activeRequest = resolveWorkspaceRequest(
          latestStateRef.current.currentWorkspace,
          latestStateRef.current.user
        );
        if (activeRequest?.workspaceId !== requestWorkspaceId) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[Sync] ignoring stale docs response for workspace', requestWorkspaceId);
          }
          return;
        }

        latestStateRef.current.applyDocsSnapshot(fetched);
      } catch (error) {
        console.error('Error fetching docs', error);
      }
    })();

    fetchInFlightRef.current = fetchPromise;

    try {
      await fetchPromise;
    } finally {
      if (fetchInFlightRef.current === fetchPromise) {
        fetchInFlightRef.current = null;
      }
      lastDocsFetchAtRef.current = Date.now();
      const activeRequest = resolveWorkspaceRequest(
        latestStateRef.current.currentWorkspace,
        latestStateRef.current.user
      );
      if (showLoading && activeRequest?.workspaceId === requestWorkspaceId) {
        latestStateRef.current.setLoadingDocs(false);
      }
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        const queuedOptions = pendingRefetchOptionsRef.current;
        pendingRefetchOptionsRef.current = undefined;
        setTimeout(() => {
          void fetchDocsRef.current?.(queuedOptions);
        }, 100);
      }
    }
  }, [resolveWorkspaceRequest]);

  fetchDocsRef.current = fetchDocs;

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
        console.warn('[Sync] debounced fetch triggered');
      }
      void requestDocsRefresh({ delayMs: 0 });
    }, 600);
  }, [isPageVisible, requestDocsRefresh]);

  // RTDB listener vive en SyncEventsBridge (layout root) y dispara
  // `agora:docs-changed`, escuchado abajo.

  useEffect(() => {
    if (!currentWorkspace || !user || !isPageVisible) return;
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastSyncEventRef.current >= 60000) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Sync] fallback polling triggered (no RTDB event in 60s)');
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

  // Escuchar evento global para refrescar docs (usado por MosaicEditor al crear .st companions)
  useEffect(() => {
    const handler = () => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Sync] agora:docs-changed event received, refreshing…');
      }
      void requestDocsRefresh({ force: true, delayMs: 0 });
    };
    window.addEventListener('agora:docs-changed', handler);
    return () => window.removeEventListener('agora:docs-changed', handler);
  }, [requestDocsRefresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AgentDocumentsMutatedEventDetail>).detail;
      if (!detail?.workspaceId || !currentWorkspace || !user) return;

      const matchesCurrentWorkspace = detail.workspaceId === currentWorkspace.id
        || (currentWorkspace.id === personalWorkspaceId && detail.workspaceId === PERSONAL_WORKSPACE_ID);

      if (!matchesCurrentWorkspace) return;

      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Sync] agora:documents-mutated event received, refreshing…');
      }
      void requestDocsRefresh({ force: true, delayMs: 0 });
    };

    window.addEventListener('agora:documents-mutated', handler as EventListener);
    return () => window.removeEventListener('agora:documents-mutated', handler as EventListener);
  }, [currentWorkspace, personalWorkspaceId, requestDocsRefresh, user]);

  return {
    fetchDocs,
    requestDocsRefresh
  };
};
