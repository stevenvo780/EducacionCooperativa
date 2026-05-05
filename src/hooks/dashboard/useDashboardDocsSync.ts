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

  useEffect(() => {
    latestStateRef.current = {
      user,
      currentWorkspace,
      docsLength,
      applyDocsSnapshot,
      setLoadingDocs
    };
  }, [user, currentWorkspace, docsLength, applyDocsSnapshot, setLoadingDocs]);

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

  const requestDocsRefreshRef = useRef<((options?: SyncRequestOptions) => Promise<void>) | null>(null);

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

  requestDocsRefreshRef.current = requestDocsRefresh;

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
      void requestDocsRefreshRef.current?.({ delayMs: 0 });
    }, 600);
  }, [isPageVisible]);

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
        void requestDocsRefreshRef.current?.({ force: true, delayMs: 0 });
      }
    }, 60000);

    return () => {
      clearInterval(intervalId);
      if (syncFetchTimerRef.current) {
        clearTimeout(syncFetchTimerRef.current);
        syncFetchTimerRef.current = null;
      }
    };
  }, [currentWorkspace, user, isPageVisible]);

  useEffect(() => {
    if (!isPageVisible || !currentWorkspace || !user) return;
    void requestDocsRefresh({ force: true, delayMs: 0 });
  }, [isPageVisible, currentWorkspace, user, requestDocsRefresh]);

  // Coalescer único: todos los triggers externos (RTDB via TerminalContext,
  // agora:docs-changed, agora:documents-mutated) entran por el mismo handler
  // que dedupe + throttle vía requestDocsRefresh. Antes había 3 effects
  // separados; cada uno disparaba su propio refresh y a veces se sumaban.
  useEffect(() => {
    if (!currentWorkspace || !user) return;

    const matchesActiveWorkspace = (eventWorkspaceId: string | null | undefined): boolean => {
      if (!eventWorkspaceId) return false;
      if (eventWorkspaceId === currentWorkspace.id) return true;
      if (currentWorkspace.id === personalWorkspaceId) {
        if (eventWorkspaceId === PERSONAL_WORKSPACE_ID) return true;
        if (eventWorkspaceId === `${PERSONAL_WORKSPACE_ID}:${user.uid}`) return true;
      }
      return false;
    };

    const triggerRefresh = (source: string) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Sync] coalesced refresh from ${source}`);
      }
      scheduleSyncFetch();
    };

    const docsChangedHandler = () => triggerRefresh('agora:docs-changed');
    const docsMutatedHandler = (event: Event) => {
      const detail = (event as CustomEvent<AgentDocumentsMutatedEventDetail>).detail;
      if (!matchesActiveWorkspace(detail?.workspaceId)) return;
      triggerRefresh('agora:documents-mutated');
    };

    window.addEventListener('agora:docs-changed', docsChangedHandler);
    window.addEventListener('agora:documents-mutated', docsMutatedHandler as EventListener);

    let unsubscribeDocChange: (() => void) | null = null;
    if (onDocChangeCallback) {
      const unsubscribe = onDocChangeCallback((event) => {
        if (matchesActiveWorkspace(event.workspaceId)) {
          triggerRefresh('terminal:doc-change');
        }
      });
      if (typeof unsubscribe === 'function') unsubscribeDocChange = unsubscribe;
    }

    return () => {
      window.removeEventListener('agora:docs-changed', docsChangedHandler);
      window.removeEventListener('agora:documents-mutated', docsMutatedHandler as EventListener);
      unsubscribeDocChange?.();
    };
  }, [currentWorkspace, user, onDocChangeCallback, personalWorkspaceId, scheduleSyncFetch]);

  return {
    fetchDocs,
    requestDocsRefresh
  };
};
