'use client';

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { MosaicNode } from 'react-mosaic-component';
import type { DocItem, ViewMode, Workspace } from '@/components/dashboard/types';
import { loadDashboardState, restoreOpenTabs, saveDashboardState, validateMosaicNode } from '@/services/dashboardPersistence';

interface UseDashboardPersistenceParams {
  /** @deprecated retained for call-site stability; el auto-inject del tile Files se removió. */
  currentWorkspace?: Workspace | null;
  currentWorkspaceId: string | undefined;
  /** @deprecated retained for call-site stability. */
  userUid?: string;
  docs: DocItem[];
  loadingDocs: boolean;
  openTabs: DocItem[];
  selectedDocId: string | null;
  mosaicNode: MosaicNode<string> | null;
  docModes: Record<string, ViewMode>;
  sidebarWidth: number;
  activeFolder: string;
  isSidebarCollapsed: boolean;
  isHeaderCollapsed: boolean;
  closedFilesTabByWorkspace: Record<string, boolean>;
  rootFolderPath: string;
  zenRestoreRef: MutableRefObject<{ sidebar: boolean; header: boolean }>;
  setSidebarWidth: (value: number) => void;
  setActiveFolderSafe: (path: string) => void;
  setDocModes: (value: Record<string, ViewMode>) => void;
  setIsSidebarCollapsed: (value: boolean) => void;
  setIsHeaderCollapsed: (value: boolean) => void;
  setIsZenMode: (value: boolean) => void;
  setOpenTabs: Dispatch<SetStateAction<DocItem[]>>;
  setMosaicNode: Dispatch<SetStateAction<MosaicNode<string> | null>>;
  setSelectedDocId: (value: string | null) => void;
  setClosedFilesTabByWorkspace: Dispatch<SetStateAction<Record<string, boolean>>>;
  clearActiveSession: () => void;
}

export const useDashboardPersistence = ({
  currentWorkspace: _currentWorkspace,
  currentWorkspaceId,
  userUid: _userUid,
  docs,
  loadingDocs,
  openTabs,
  selectedDocId,
  mosaicNode,
  docModes,
  sidebarWidth,
  activeFolder,
  isSidebarCollapsed,
  isHeaderCollapsed,
  closedFilesTabByWorkspace,
  rootFolderPath,
  zenRestoreRef,
  setSidebarWidth,
  setActiveFolderSafe,
  setDocModes,
  setIsSidebarCollapsed,
  setIsHeaderCollapsed,
  setIsZenMode,
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
      setIsHeaderCollapsed(Boolean(persisted.isHeaderCollapsed));
    } else {
      setDocModes({});
      setIsSidebarCollapsed(false);
      setIsHeaderCollapsed(false);
    }

    setIsZenMode(false);
    zenRestoreRef.current = { sidebar: false, header: false };
    setOpenTabs([]);
    setMosaicNode(null);
    setSelectedDocId(null);
    setClosedFilesTabByWorkspace(prev => ({ ...prev, [currentWorkspaceId]: false }));
    stateRestoredForWorkspaceRef.current = null;
    clearActiveSession();
  }, [
    currentWorkspaceId,
    clearActiveSession,
    setActiveFolderSafe,
    setClosedFilesTabByWorkspace,
    setDocModes,
    setIsHeaderCollapsed,
    setIsSidebarCollapsed,
    setIsZenMode,
    setMosaicNode,
    setOpenTabs,
    setSelectedDocId,
    setSidebarWidth,
    zenRestoreRef
  ]);

  // El sidebar izquierdo ya muestra el árbol de archivos completo. El tile
  // "Archivos" del Mosaic se mantiene como vista opcional (botón en HeaderBar)
  // y NO se auto-inyecta al abrir un workspace — antes lo hacía y dejaba al
  // editor compitiendo por ancho con un explorador duplicado.
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
        isHeaderCollapsed
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
    isHeaderCollapsed
  ]);

  useEffect(() => {
    if (!currentWorkspaceId) return;

    const persisted = loadDashboardState(currentWorkspaceId);
    if (!persisted?.activeFolder) {
      setActiveFolderSafe(rootFolderPath);
    }
  }, [currentWorkspaceId, rootFolderPath, setActiveFolderSafe]);
};
