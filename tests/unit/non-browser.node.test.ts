// @vitest-environment node

import {
  clearDashboardState,
  loadDashboardState,
  loadFavoriteDocIds,
  saveDashboardState,
  saveFavoriteDocIds
} from '@/services/dashboardPersistence';
import {
  loadSemanticWorkspaceState,
  saveSemanticWorkspaceState
} from '@/services/editorSemanticStore';
import { getAuthToken } from '@/services/apiClient';

describe('non-browser fallbacks', () => {
  it('short-circuits dashboard persistence without window', () => {
    expect(loadDashboardState('ws-1')).toBeNull();
    expect(loadFavoriteDocIds('ws-1', 'u1')).toEqual([]);
    expect(() => saveDashboardState('ws-1', {
      openTabs: [],
      selectedDocId: null,
      mosaicNode: null,
      docModes: {},
      sidebarWidth: 0,
      activeFolder: ''
    })).not.toThrow();
    expect(() => saveFavoriteDocIds('ws-1', 'u1', ['doc-1'])).not.toThrow();
    expect(() => clearDashboardState('ws-1')).not.toThrow();
  });

  it('returns semantic state unchanged without window', () => {
    expect(loadSemanticWorkspaceState({ workspaceId: 'ws-1', userId: 'u1' })).toMatchObject({
      concepts: [],
      fragments: [],
      relations: [],
      updatedAt: 0,
      preferences: {
        experienceMode: 'hybrid',
        showSTPreview: true,
        showPedagogicalHints: true
      }
    });

    expect(saveSemanticWorkspaceState(
      { workspaceId: 'ws-1', userId: 'u1' },
      {
        concepts: [], fragments: [], relations: [], updatedAt: 10,
        preferences: { experienceMode: 'hybrid', showSTPreview: true, showPedagogicalHints: true }
      }
    )).toMatchObject({
      concepts: [],
      fragments: [],
      relations: [],
      updatedAt: 10,
      preferences: {
        experienceMode: 'hybrid',
        showSTPreview: true,
        showPedagogicalHints: true
      }
    });
  });

  it('returns null auth token without window', async () => {
    await expect(getAuthToken()).resolves.toBeNull();
  });
});
