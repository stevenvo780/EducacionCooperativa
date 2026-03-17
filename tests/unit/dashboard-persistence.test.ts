import {
  MAX_FAVORITE_DOCS,
  clearDashboardState,
  loadDashboardState,
  loadFavoriteDocIds,
  restoreOpenTabs,
  saveDashboardState,
  saveFavoriteDocIds,
  validateMosaicNode
} from '@/services/dashboardPersistence';

const baseState = {
  openTabs: [
    { id: 'files', name: 'Explorador', type: 'files' },
    { id: 'doc-1', name: 'Nota', type: 'text', folder: 'Curso', mimeType: 'text/markdown' },
    { id: 'board-1', name: 'Kanban', type: 'board' },
    { id: 'terminal-1', name: 'Term', type: 'terminal', sessionId: 's1' }
  ],
  selectedDocId: 'doc-1',
  mosaicNode: { direction: 'row', first: 'doc-1', second: 'terminal-1', splitPercentage: 50 } as const,
  docModes: { 'doc-1': 'editor' as const },
  sidebarWidth: 320,
  activeFolder: 'Curso',
  isSidebarCollapsed: true,
  isHeaderCollapsed: false
};

describe('dashboard persistence', () => {
  it('saves, loads and clears dashboard state', () => {
    expect(loadDashboardState('ws-missing')).toBeNull();

    saveDashboardState('ws-1', baseState);

    const raw = window.localStorage.getItem('dashboard_state_ws-1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.openTabs).toHaveLength(3);
    expect(parsed.openTabs.map((tab: { id: string }) => tab.id)).toEqual(['doc-1', 'board-1', 'terminal-1']);

    expect(loadDashboardState('ws-1')).toEqual(parsed);

    clearDashboardState('ws-1');
    expect(window.localStorage.getItem('dashboard_state_ws-1')).toBeNull();
  });

  it('handles dashboard state edge cases and recovery paths', () => {
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    saveDashboardState('', baseState);
    expect(window.localStorage.getItem('dashboard_state_')).toBeNull();

    window.localStorage.setItem('dashboard_state_ws-1', JSON.stringify({
      version: 999,
      workspaceId: 'ws-1'
    }));
    expect(loadDashboardState('ws-1')).toBeNull();
    expect(removeSpy).toHaveBeenCalledWith('dashboard_state_ws-1');

    window.localStorage.setItem('dashboard_state_ws-1', JSON.stringify({
      version: 1,
      workspaceId: 'ws-2'
    }));
    expect(loadDashboardState('ws-1')).toBeNull();

    window.localStorage.setItem('dashboard_state_ws-1', '{bad json');
    expect(loadDashboardState('ws-1')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });
    saveDashboardState('ws-1', baseState);

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('boom');
    });
    clearDashboardState('ws-1');
  });

  it('restores open tabs from available docs and synthetic tabs', () => {
    const restored = restoreOpenTabs(
      [
        { id: 'doc-1', name: 'Nota', type: 'text' },
        { id: 'board-1', name: 'Kanban', type: 'board' },
        { id: 'board-2', type: 'board' },
        { id: 'terminal-1', name: 'Term', type: 'terminal', sessionId: 's1' },
        { id: 'terminal-2', type: 'terminal' }
      ],
      [{ id: 'doc-1', name: 'Nota real', type: 'text' }] as never[]
    );

    expect(restored).toEqual([
      { id: 'doc-1', name: 'Nota real', type: 'text' },
      { id: 'board-1', name: 'Kanban', type: 'board' },
      { id: 'board-2', name: 'Tablero', type: 'board' },
      { id: 'terminal-1', name: 'Term', type: 'terminal', sessionId: 's1' },
      { id: 'terminal-2', name: 'Terminal', type: 'terminal', sessionId: undefined }
    ]);
  });

  it('stores and loads favorite docs safely', () => {
    expect(loadFavoriteDocIds('ws-missing', 'u1')).toEqual([]);

    saveFavoriteDocIds(
      'ws-1',
      'u1',
      Array.from({ length: MAX_FAVORITE_DOCS + 2 }, (_, index) => `doc-${index}`)
    );

    expect(loadFavoriteDocIds('ws-1', 'u1')).toHaveLength(MAX_FAVORITE_DOCS);
    expect(loadFavoriteDocIds('', 'u1')).toEqual([]);

    window.localStorage.setItem('dashboard_favorites_ws-1_u1', JSON.stringify({
      version: 999,
      workspaceId: 'ws-1',
      userUid: 'u1',
      favoriteDocIds: ['doc-1']
    }));
    expect(loadFavoriteDocIds('ws-1', 'u1')).toEqual([]);

    window.localStorage.setItem('dashboard_favorites_ws-1_u1', JSON.stringify({
      version: 1,
      workspaceId: 'ws-2',
      userUid: 'u1',
      favoriteDocIds: ['doc-1']
    }));
    expect(loadFavoriteDocIds('ws-1', 'u1')).toEqual([]);

    window.localStorage.setItem('dashboard_favorites_ws-1_u1', JSON.stringify({
      version: 1,
      workspaceId: 'ws-1',
      userUid: 'u1',
      favoriteDocIds: 'bad'
    }));
    expect(loadFavoriteDocIds('ws-1', 'u1')).toEqual([]);

    window.localStorage.setItem('dashboard_favorites_ws-1_u1', JSON.stringify({
      version: 1,
      workspaceId: 'ws-1',
      userUid: 'u1',
      favoriteDocIds: ['doc-1', '', '   ', 3, 'doc-2']
    }));
    expect(loadFavoriteDocIds('ws-1', 'u1')).toEqual(['doc-1', 'doc-2']);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem('dashboard_favorites_ws-1_u1', '{bad json');
    expect(loadFavoriteDocIds('ws-1', 'u1')).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });
    saveFavoriteDocIds('ws-1', 'u1', ['doc-1']);
  });

  it('validates mosaic nodes against currently open tabs', () => {
    const openTabIds = new Set(['doc-1']);

    expect(validateMosaicNode(null, openTabIds)).toBeNull();
    expect(validateMosaicNode('files', openTabIds)).toBe('files');
    expect(validateMosaicNode('terminal-1', openTabIds)).toBe('terminal-1');
    expect(validateMosaicNode('doc-1', openTabIds)).toBe('doc-1');
    expect(validateMosaicNode('doc-2', openTabIds)).toBeNull();

    expect(validateMosaicNode({
      direction: 'row',
      first: 'doc-1',
      second: 'terminal-1',
      splitPercentage: 50
    }, openTabIds)).toEqual({
      direction: 'row',
      first: 'doc-1',
      second: 'terminal-1',
      splitPercentage: 50
    });

    expect(validateMosaicNode({
      direction: 'row',
      first: 'doc-1',
      second: 'doc-2',
      splitPercentage: 50
    }, openTabIds)).toBe('doc-1');

    expect(validateMosaicNode({
      direction: 'row',
      first: 'doc-2',
      second: 'doc-1',
      splitPercentage: 50
    }, openTabIds)).toBe('doc-1');
  });

  it('short-circuits when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(loadDashboardState('ws-1')).toBeNull();
    expect(loadFavoriteDocIds('ws-1', 'u1')).toEqual([]);
    expect(() => saveDashboardState('ws-1', baseState)).not.toThrow();
    expect(() => saveFavoriteDocIds('ws-1', 'u1', ['doc-1'])).not.toThrow();
    expect(() => clearDashboardState('ws-1')).not.toThrow();
  });
});
