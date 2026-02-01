/**
 * Dashboard state persistence service
 * Saves and restores layout, open tabs, and other UI state to localStorage
 */

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
}

function getStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}_${workspaceId}`;
}

/**
 * Save dashboard state to localStorage
 */
export function saveDashboardState(
  workspaceId: string,
  state: {
    openTabs: DocItem[];
    selectedDocId: string | null;
    mosaicNode: MosaicNode<string> | null;
    docModes: Record<string, ViewMode>;
    sidebarWidth: number;
    activeFolder: string;
  }
): void {
  if (!workspaceId || typeof window === 'undefined') return;

  try {
    const persistedTabs: PersistedTabState[] = state.openTabs
      .filter(tab => tab.type !== 'terminal' && tab.type !== 'files') // Only persist document tabs
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
      activeFolder: state.activeFolder
    };

    localStorage.setItem(getStorageKey(workspaceId), JSON.stringify(persistedState));
  } catch (error) {
    console.warn('Failed to save dashboard state:', error);
  }
}

/**
 * Load dashboard state from localStorage
 */
export function loadDashboardState(workspaceId: string): Partial<PersistedState> | null {
  if (!workspaceId || typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    if (!stored) return null;

    const parsed: PersistedState = JSON.parse(stored);
    
    // Check version compatibility
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(getStorageKey(workspaceId));
      return null;
    }

    // Verify workspace matches
    if (parsed.workspaceId !== workspaceId) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to load dashboard state:', error);
    return null;
  }
}

/**
 * Restore open tabs from persisted state, matching with actual docs
 */
export function restoreOpenTabs(
  persistedTabs: PersistedTabState[],
  availableDocs: DocItem[]
): DocItem[] {
  const restoredTabs: DocItem[] = [];
  
  for (const persistedTab of persistedTabs) {
    // Find the actual doc in available docs
    const doc = availableDocs.find(d => d.id === persistedTab.id);
    if (doc) {
      restoredTabs.push(doc);
    }
  }

  return restoredTabs;
}

/**
 * Clear persisted state for a workspace
 */
export function clearDashboardState(workspaceId: string): void {
  if (!workspaceId || typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(getStorageKey(workspaceId));
  } catch (error) {
    console.warn('Failed to clear dashboard state:', error);
  }
}

/**
 * Validate and clean mosaicNode to ensure all referenced tabs exist
 */
export function validateMosaicNode(
  node: MosaicNode<string> | null,
  openTabIds: Set<string>
): MosaicNode<string> | null {
  if (!node) return null;

  if (typeof node === 'string') {
    // Leaf node - check if tab exists
    // Allow special tabs like 'files', 'terminal-*'
    if (node === 'files' || node.startsWith('terminal-') || openTabIds.has(node)) {
      return node;
    }
    return null;
  }

  // Branch node
  const first = validateMosaicNode(node.first, openTabIds);
  const second = validateMosaicNode(node.second, openTabIds);

  if (first && second) {
    return { ...node, first, second };
  }
  
  // If only one child is valid, return just that child
  return first || second;
}
