import uiReducer, {
  setIsChangingPassword,
  setPasswordError,
  setPasswordForm,
  setPasswordSuccess,
  setQuickSearchIndex,
  setQuickSearchQuery,
  setShowMembersModal,
  setShowMobileSidebar,
  setShowNewWorkspaceModal,
  setShowPasswordModal,
  setShowQuickSearch,
  setShowWorkspaceMenu,
  setSidebarSearchQuery
} from '@/store/uiSlice';
import workspacesReducer, {
  setCurrentWorkspace,
  setDeletingWorkspaceId,
  setInvites,
  setWorkspaces
} from '@/store/workspacesSlice';
import editorPrefsReducer, {
  setEditorToolbarVisibility
} from '@/store/editorPrefsSlice';
import { selectEditorToolbarVisibility } from '@/store/dashboard.selectors';

describe('dashboard store', () => {
  it('applies every ui slice reducer action', () => {
    let state = uiReducer(undefined, { type: 'unknown' });

    state = uiReducer(state, setShowWorkspaceMenu(true));
    state = uiReducer(state, setShowNewWorkspaceModal(true));
    state = uiReducer(state, setShowMembersModal(true));
    state = uiReducer(state, setShowPasswordModal(true));
    state = uiReducer(state, setPasswordForm({ current: 'a', new: 'b', confirm: 'b' }));
    state = uiReducer(state, setPasswordError('error'));
    state = uiReducer(state, setPasswordSuccess(true));
    state = uiReducer(state, setIsChangingPassword(true));
    state = uiReducer(state, setShowQuickSearch(true));
    state = uiReducer(state, setQuickSearchQuery('buscar'));
    state = uiReducer(state, setQuickSearchIndex(2));
    state = uiReducer(state, setSidebarSearchQuery('sidebar'));
    state = uiReducer(state, setShowMobileSidebar(true));

    expect(state).toMatchObject({
      showWorkspaceMenu: true,
      showNewWorkspaceModal: true,
      showMembersModal: true,
      showPasswordModal: true,
      passwordForm: { current: 'a', new: 'b', confirm: 'b' },
      passwordError: 'error',
      passwordSuccess: true,
      isChangingPassword: true,
      showQuickSearch: true,
      quickSearchQuery: 'buscar',
      quickSearchIndex: 2,
      sidebarSearchQuery: 'sidebar',
      showMobileSidebar: true
    });
  });

  it('applies every workspaces slice reducer action', () => {
    let state = workspacesReducer(undefined, { type: 'unknown' });

    state = workspacesReducer(state, setDeletingWorkspaceId('ws-1'));
    state = workspacesReducer(state, setWorkspaces([{ id: 'ws-1' }] as never[]));
    state = workspacesReducer(state, setInvites([{ id: 'ws-2' }] as never[]));
    state = workspacesReducer(state, setCurrentWorkspace({ id: 'ws-1' } as never));

    expect(state).toMatchObject({
      deletingWorkspaceId: 'ws-1',
      workspaces: [{ id: 'ws-1' }],
      invites: [{ id: 'ws-2' }],
      currentWorkspace: { id: 'ws-1' }
    });
  });

  it('applies editor prefs toolbar visibility action', () => {
    let state = editorPrefsReducer(undefined, { type: 'unknown' });
    state = editorPrefsReducer(state, setEditorToolbarVisibility({ history: false }));

    expect(state).toMatchObject({
      editorToolbarVisibility: { history: false }
    });
  });

  it('merges toolbar visibility with defaults in the selector', () => {
    const result = selectEditorToolbarVisibility({
      editorPrefs: {
        editorToolbarVisibility: {
          history: false,
          insert: false
        }
      }
    } as never);

    expect(result).toEqual({
      history: false,
      inline: true,
      structure: true,
      lists: true,
      media: true,
      insert: false,
      snippets: true,
      advanced: true
    });
  });
});
