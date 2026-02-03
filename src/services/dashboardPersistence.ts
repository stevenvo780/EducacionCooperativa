import type { MosaicNode } from 'react-mosaic-component';
import type { DocItem, ViewMode } from '@/components/dashboard/types';

const STORAGE_KEY_PREFIX = 'dashboard_state';
const STORAGE_VERSION = 1;

interface PersistedTabState {
  id: string;
  name: string;
  type?: string;
  folder?: string;
  mimeType?: string;
}

interface PersistedState {
  version: number;
  workspaceId: string;
  openTabs: PersistedTabState[];
  selectedDocId: string | null;
  mosaicNode: MosaicNode<string> | null;
  docModes: Record<string, ViewMode>;
  sidebarWidth: number;
  activeFolder: string;
  isSidebarCollapsed?: boolean;
  isHeaderCollapsed?: boolean;
}

function getStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}_${workspaceId}`;
}

export function saveDashboardState(
  workspaceId: string,
  state: {
    openTabs: DocItem[];
    selectedDocId: string | null;
    mosaicNode: MosaicNode<string> | null;
    docModes: Record<string, ViewMode>;
    sidebarWidth: number;
    activeFolder: string;
    isSidebarCollapsed?: boolean;
    isHeaderCollapsed?: boolean;
  }
): void {
  if (!workspaceId || typeof window === 'undefined') return;

  try {
    const persistedTabs: PersistedTabState[] = state.openTabs
      .filter(tab => tab.type !== 'terminal' && tab.type !== 'files')
      .map(tab => ({
        id: tab.id,
        name: tab.name,
        type: tab.type,
        folder: tab.folder,
        mimeType: tab.mimeType
      }));

    const persistedState: PersistedState = {
      version: STORAGE_VERSION,
      workspaceId,
      openTabs: persistedTabs,
      selectedDocId: state.selectedDocId,
      mosaicNode: state.mosaicNode,
      docModes: state.docModes,
      sidebarWidth: state.sidebarWidth,
      activeFolder: state.activeFolder,
      isSidebarCollapsed: state.isSidebarCollapsed,
      isHeaderCollapsed: state.isHeaderCollapsed
    };

    localStorage.setItem(getStorageKey(workspaceId), JSON.stringify(persistedState));
  } catch (error) {
    console.warn('Failed to save dashboard state:', error);
  }
}

export function loadDashboardState(workspaceId: string): Partial<PersistedState> | null {
  if (!workspaceId || typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    if (!stored) return null;

    const parsed: PersistedState = JSON.parse(stored);
    
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(getStorageKey(workspaceId));
      return null;
    }

    if (parsed.workspaceId !== workspaceId) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to load dashboard state:', error);
    return null;
  }
}

export function restoreOpenTabs(
  persistedTabs: PersistedTabState[],
  availableDocs: DocItem[]
): DocItem[] {
  const restoredTabs: DocItem[] = [];
  
  for (const persistedTab of persistedTabs) {
    const doc = availableDocs.find(d => d.id === persistedTab.id);
    if (doc) {
      restoredTabs.push(doc);
    }
  }

  return restoredTabs;
}

export function clearDashboardState(workspaceId: string): void {
  if (!workspaceId || typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(getStorageKey(workspaceId));
  } catch (error) {
    console.warn('Failed to clear dashboard state:', error);
  }
}

export function validateMosaicNode(
  node: MosaicNode<string> | null,
  openTabIds: Set<string>
): MosaicNode<string> | null {
  if (!node) return null;

  if (typeof node === 'string') {
    if (node === 'files' || node.startsWith('terminal-') || openTabIds.has(node)) {
      return node;
    }
    return null;
  }

  const first = validateMosaicNode(node.first, openTabIds);
  const second = validateMosaicNode(node.second, openTabIds);

  if (first && second) {
    return { ...node, first, second };
  }
  
  return first || second;
}
