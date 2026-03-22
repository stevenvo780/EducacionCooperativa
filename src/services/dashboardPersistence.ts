import type { MosaicNode } from 'react-mosaic-component';
import type { DocItem, ViewMode } from '@/components/dashboard/types';

const STORAGE_KEY_PREFIX = 'dashboard_state';
const FAVORITES_STORAGE_KEY_PREFIX = 'dashboard_favorites';
const STORAGE_VERSION = 1;
const FAVORITES_STORAGE_VERSION = 1;

export const MAX_FAVORITE_DOCS = 8;

interface PersistedTabState {
  id: string;
  name: string;
  type?: string;
  folder?: string;
  mimeType?: string;
  sessionId?: string;
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

interface PersistedFavoritesState {
  version: number;
  workspaceId: string;
  userUid: string;
  favoriteDocIds: string[];
}

function getStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}_${workspaceId}`;
}

function getFavoritesStorageKey(workspaceId: string, userUid: string): string {
  return `${FAVORITES_STORAGE_KEY_PREFIX}_${workspaceId}_${userUid}`;
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
      .filter(tab => tab.type !== 'files')
      .map(tab => ({
        id: tab.id,
        name: tab.name,
        type: tab.type,
        folder: tab.folder,
        mimeType: tab.mimeType,
        sessionId: tab.sessionId
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
      continue;
    }
    if (persistedTab.type === 'board') {
      restoredTabs.push({
        id: persistedTab.id,
        name: persistedTab.name || 'Tablero',
        type: 'board'
      });
    }

    if (persistedTab.type === 'formalizer') {
      restoredTabs.push({
        id: persistedTab.id,
        name: persistedTab.name || 'Formalizador',
        type: 'formalizer'
      });
    }

    if (persistedTab.type === 'terminal') {
      restoredTabs.push({
        id: persistedTab.id,
        name: persistedTab.name || 'Terminal',
        type: 'terminal',
        sessionId: persistedTab.sessionId
      });
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

export function saveFavoriteDocIds(
  workspaceId: string,
  userUid: string,
  favoriteDocIds: string[]
): void {
  if (!workspaceId || !userUid || typeof window === 'undefined') return;

  try {
    const persistedState: PersistedFavoritesState = {
      version: FAVORITES_STORAGE_VERSION,
      workspaceId,
      userUid,
      favoriteDocIds: favoriteDocIds.slice(0, MAX_FAVORITE_DOCS)
    };

    localStorage.setItem(
      getFavoritesStorageKey(workspaceId, userUid),
      JSON.stringify(persistedState)
    );
  } catch (error) {
    console.warn('Failed to save favorite docs:', error);
  }
}

export function loadFavoriteDocIds(workspaceId: string, userUid: string): string[] {
  if (!workspaceId || !userUid || typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(getFavoritesStorageKey(workspaceId, userUid));
    if (!stored) return [];

    const parsed: PersistedFavoritesState = JSON.parse(stored);

    if (parsed.version !== FAVORITES_STORAGE_VERSION) {
      localStorage.removeItem(getFavoritesStorageKey(workspaceId, userUid));
      return [];
    }

    if (parsed.workspaceId !== workspaceId || parsed.userUid !== userUid) {
      return [];
    }

    if (!Array.isArray(parsed.favoriteDocIds)) {
      return [];
    }

    return parsed.favoriteDocIds
      .filter((docId): docId is string => typeof docId === 'string' && docId.trim().length > 0)
      .slice(0, MAX_FAVORITE_DOCS);
  } catch (error) {
    console.warn('Failed to load favorite docs:', error);
    return [];
  }
}

export function validateMosaicNode(
  node: MosaicNode<string> | null,
  openTabIds: Set<string>
): MosaicNode<string> | null {
  if (!node) return null;

  if (typeof node === 'string') {
    if (node === 'files' || node.startsWith('terminal-') || node.startsWith('formalizer-') || openTabIds.has(node)) {
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
