'use client';

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { MosaicNode } from 'react-mosaic-component';
import type { DocItem, ViewMode } from '@/components/dashboard/types';
import { loadDashboardState, restoreOpenTabs, saveDashboardState, validateMosaicNode } from '@/services/dashboardPersistence';

interface UseDashboardPersistenceParams {
  currentWorkspaceId: string | undefined;
  docs: DocItem[];
  loadingDocs: boolean;
  openTabs: DocItem[];
  selectedDocId: string | null;
  mosaicNode: MosaicNode<string> | null;
  docModes: Record<string, ViewMode>;
  sidebarWidth: number;
  activeFolder: string;
  isSidebarCollapsed: boolean;
  activityView?: string;
  bottomDockOpen?: boolean;
  rightPanelOpen?: boolean;
  closedFilesTabByWorkspace: Record<string, boolean>;
  rootFolderPath: string;
  zenRestoreRef: MutableRefObject<{ sidebar: boolean }>;
  setSidebarWidth: (value: number) => void;
  setActiveFolderSafe: (path: string) => void;
  setDocModes: (value: Record<string, ViewMode>) => void;
  setIsSidebarCollapsed: (value: boolean) => void;
  setIsZenMode: (value: boolean) => void;
  setOpenTabs: Dispatch<SetStateAction<DocItem[]>>;
  setMosaicNode: Dispatch<SetStateAction<MosaicNode<string> | null>>;
  setSelectedDocId: (value: string | null) => void;
  setClosedFilesTabByWorkspace: Dispatch<SetStateAction<Record<string, boolean>>>;
  setActivityView?: (value: string) => void;
  setBottomDockOpen?: (value: boolean) => void;
  setRightPanelOpen?: (value: boolean) => void;
  clearActiveSession: () => void;
}

export const useDashboardPersistence = ({
  currentWorkspaceId,
  docs,
  loadingDocs,
  openTabs,
  selectedDocId,
  mosaicNode,
  docModes,
  sidebarWidth,
  activeFolder,
  isSidebarCollapsed,
  activityView,
  bottomDockOpen,
  rightPanelOpen,
  closedFilesTabByWorkspace,
  rootFolderPath,
  zenRestoreRef,
  setSidebarWidth,
  setActiveFolderSafe,
  setDocModes,
  setIsSidebarCollapsed,
  setIsZenMode,
  setActivityView,
  setBottomDockOpen,
  setRightPanelOpen,
  setOpenTabs,
  setMosaicNode,
  setSelectedDocId,
  setClosedFilesTabByWorkspace,
  clearActiveSession
}: UseDashboardPersistenceParams) => {
  const stateRestoredForWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentWorkspaceId) return;

    const persisted = loadDashboardState(currentWorkspaceId);
    if (persisted) {
      if (persisted.sidebarWidth) {
        setSidebarWidth(persisted.sidebarWidth);
      }
      if (typeof persisted.activeFolder === 'string') {
        setActiveFolderSafe(persisted.activeFolder);
      }
      if (persisted.docModes) {
        setDocModes(persisted.docModes);
      }
      setIsSidebarCollapsed(Boolean(persisted.isSidebarCollapsed));
      if (persisted.activityView && setActivityView) setActivityView(persisted.activityView);
      if (typeof persisted.bottomDockOpen === 'boolean' && setBottomDockOpen) setBottomDockOpen(persisted.bottomDockOpen);
      if (typeof persisted.rightPanelOpen === 'boolean' && setRightPanelOpen) setRightPanelOpen(persisted.rightPanelOpen);
    } else {
      setDocModes({});
      setIsSidebarCollapsed(false);
    }

    setIsZenMode(false);
    zenRestoreRef.current = { sidebar: false };
    setOpenTabs([]);
    setMosaicNode(null);
    setSelectedDocId(null);
    setClosedFilesTabByWorkspace(prev => ({ ...prev, [currentWorkspaceId]: false }));
    stateRestoredForWorkspaceRef.current = null;
    clearActiveSession();
    // Al cambiar de workspace los diagnostics de los linters por documento
    // se vuelven irrelevantes — pertenecen al doc anterior. Limpiamos los
    // sources que sabemos que son por-documento.
    void import('@/lib/diagnostics-bus').then((m) => {
      m.clearDiagnostics('markdown-linter');
      m.clearDiagnostics('st-linter');
    });
  }, [
    currentWorkspaceId,
    clearActiveSession,
    setActiveFolderSafe,
    setClosedFilesTabByWorkspace,
    setDocModes,
    setIsSidebarCollapsed,
    setIsZenMode,
    setMosaicNode,
    setOpenTabs,
    setSelectedDocId,
    setSidebarWidth,
    setActivityView,
    setBottomDockOpen,
    setRightPanelOpen,
    zenRestoreRef
  ]);

  void closedFilesTabByWorkspace;

  useEffect(() => {
    if (!currentWorkspaceId || loadingDocs) return;
    if (stateRestoredForWorkspaceRef.current === currentWorkspaceId) return;

    const persisted = loadDashboardState(currentWorkspaceId);
    if (persisted?.openTabs && persisted.openTabs.length > 0) {
      const restoredTabs = restoreOpenTabs(persisted.openTabs, docs);
      if (restoredTabs.length > 0) {
        setOpenTabs(prev => {
          const existingIds = new Set(prev.map(tab => tab.id));
          const newTabs = restoredTabs.filter(tab => !existingIds.has(tab.id));
          return [...prev, ...newTabs];
        });

        if (persisted.mosaicNode) {
          void (async () => {
            const { createBalancedTreeFromLeaves } = await import('react-mosaic-component');
            setMosaicNode(() => {
              const tabIds = new Set([
                ...restoredTabs.map(tab => tab.id),
                ...openTabs.map(tab => tab.id)
              ]);
              const validatedNode = validateMosaicNode(persisted.mosaicNode!, tabIds);
              if (validatedNode) return validatedNode;
              const allIds = [...tabIds];
              return allIds.length > 0 ? createBalancedTreeFromLeaves(allIds) : null;
            });
          })();
        }

        if (persisted.selectedDocId) {
          const selectedExists = restoredTabs.some(tab => tab.id === persisted.selectedDocId)
            || openTabs.some(tab => tab.id === persisted.selectedDocId);
          if (selectedExists) {
            setSelectedDocId(persisted.selectedDocId);
          }
        }
      }
    }

    stateRestoredForWorkspaceRef.current = currentWorkspaceId;
  }, [currentWorkspaceId, docs, loadingDocs, openTabs, setMosaicNode, setOpenTabs, setSelectedDocId]);

  useEffect(() => {
    if (!currentWorkspaceId || loadingDocs) return;

    const timeoutId = setTimeout(() => {
      saveDashboardState(currentWorkspaceId, {
        openTabs,
        selectedDocId,
        mosaicNode,
        docModes,
        sidebarWidth,
        activeFolder,
        isSidebarCollapsed,
        activityView,
        bottomDockOpen,
        rightPanelOpen
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    currentWorkspaceId,
    loadingDocs,
    openTabs,
    selectedDocId,
    mosaicNode,
    docModes,
    sidebarWidth,
    activeFolder,
    isSidebarCollapsed,
    activityView,
    bottomDockOpen,
    rightPanelOpen
  ]);

  useEffect(() => {
    if (!currentWorkspaceId) return;

    const persisted = loadDashboardState(currentWorkspaceId);
    if (!persisted?.activeFolder) {
      setActiveFolderSafe(rootFolderPath);
    }
  }, [currentWorkspaceId, rootFolderPath, setActiveFolderSafe]);
};
