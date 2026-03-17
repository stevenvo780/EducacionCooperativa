import reducer, {
  setCurrentWorkspace,
  setDeletingWorkspaceId,
  setEditorToolbarVisibility,
  setInvites,
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
  setSidebarSearchQuery,
  setWorkspaces
} from '@/store/dashboardSlice';
import { selectEditorToolbarVisibility } from '@/store/dashboard.selectors';

describe('dashboard store', () => {
  it('applies every dashboard reducer action', () => {
    let state = reducer(undefined, { type: 'unknown' });

    state = reducer(state, setShowWorkspaceMenu(true));
    state = reducer(state, setShowNewWorkspaceModal(true));
    state = reducer(state, setShowMembersModal(true));
    state = reducer(state, setShowPasswordModal(true));
    state = reducer(state, setPasswordForm({ current: 'a', new: 'b', confirm: 'b' }));
    state = reducer(state, setPasswordError('error'));
    state = reducer(state, setPasswordSuccess(true));
    state = reducer(state, setIsChangingPassword(true));
    state = reducer(state, setShowQuickSearch(true));
    state = reducer(state, setQuickSearchQuery('buscar'));
    state = reducer(state, setQuickSearchIndex(2));
    state = reducer(state, setSidebarSearchQuery('sidebar'));
    state = reducer(state, setShowMobileSidebar(true));
    state = reducer(state, setDeletingWorkspaceId('ws-1'));
    state = reducer(state, setWorkspaces([{ id: 'ws-1' }] as never[]));
    state = reducer(state, setInvites([{ id: 'ws-2' }] as never[]));
    state = reducer(state, setCurrentWorkspace({ id: 'ws-1' } as never));
    state = reducer(state, setEditorToolbarVisibility({ history: false }));

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
      showMobileSidebar: true,
      deletingWorkspaceId: 'ws-1',
      workspaces: [{ id: 'ws-1' }],
      invites: [{ id: 'ws-2' }],
      currentWorkspace: { id: 'ws-1' },
      editorToolbarVisibility: { history: false }
    });
  });

  it('merges toolbar visibility with defaults in the selector', () => {
    const result = selectEditorToolbarVisibility({
      dashboard: {
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
