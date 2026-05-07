import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { DEFAULT_TOOLBAR_VISIBILITY } from '@/components/mosaic-editor/constants';

const selectEditorPrefsState = (state: RootState) => state.editorPrefs;
const selectUiState = (state: RootState) => state.ui;
const selectWorkspacesState = (state: RootState) => state.workspaces;

export const selectEditorToolbarVisibility = createSelector(
  [selectEditorPrefsState],
  (editorPrefs) => ({
    ...DEFAULT_TOOLBAR_VISIBILITY,
    ...editorPrefs.editorToolbarVisibility
  })
);

export const selectWorkspaces = (state: RootState) => state.workspaces.workspaces;
export const selectInvites = (state: RootState) => state.workspaces.invites;
export const selectCurrentWorkspace = (state: RootState) => state.workspaces.currentWorkspace;
export const selectDeletingWorkspaceId = (state: RootState) => state.workspaces.deletingWorkspaceId;

export const selectShowNewWorkspaceModal = (state: RootState) => state.ui.showNewWorkspaceModal;
export const selectShowMembersModal = (state: RootState) => state.ui.showMembersModal;
export const selectShowPasswordModal = (state: RootState) => state.ui.showPasswordModal;
export const selectPasswordForm = (state: RootState) => state.ui.passwordForm;
export const selectPasswordError = (state: RootState) => state.ui.passwordError;
export const selectPasswordSuccess = (state: RootState) => state.ui.passwordSuccess;
export const selectIsChangingPassword = (state: RootState) => state.ui.isChangingPassword;
export const selectShowQuickSearch = (state: RootState) => state.ui.showQuickSearch;
export const selectQuickSearchQuery = (state: RootState) => state.ui.quickSearchQuery;
export const selectQuickSearchIndex = (state: RootState) => state.ui.quickSearchIndex;
export const selectSidebarSearchQuery = (state: RootState) => state.ui.sidebarSearchQuery;
export const selectShowMobileSidebar = (state: RootState) => state.ui.showMobileSidebar;

export { selectUiState, selectWorkspacesState, selectEditorPrefsState };
