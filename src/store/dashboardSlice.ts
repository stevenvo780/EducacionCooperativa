import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workspace } from '@/components/dashboard/types';

export interface PasswordFormState {
  current: string;
  new: string;
  confirm: string;
}

export interface DashboardState {
  showWorkspaceMenu: boolean;
  showNewWorkspaceModal: boolean;
  showMembersModal: boolean;
  showPasswordModal: boolean;
  passwordForm: PasswordFormState;
  passwordError: string;
  passwordSuccess: boolean;
  isChangingPassword: boolean;
  showQuickSearch: boolean;
  quickSearchQuery: string;
  quickSearchIndex: number;
  sidebarSearchQuery: string;
  showMobileSidebar: boolean;
  deletingWorkspaceId: string | null;
  workspaces: Workspace[];
  invites: Workspace[];
  currentWorkspace: Workspace | null;
}

const initialState: DashboardState = {
  showWorkspaceMenu: false,
  showNewWorkspaceModal: false,
  showMembersModal: false,
  showPasswordModal: false,
  passwordForm: { current: '', new: '', confirm: '' },
  passwordError: '',
  passwordSuccess: false,
  isChangingPassword: false,
  showQuickSearch: false,
  quickSearchQuery: '',
  quickSearchIndex: 0,
  sidebarSearchQuery: '',
  showMobileSidebar: false,
  deletingWorkspaceId: null,
  workspaces: [],
  invites: [],
  currentWorkspace: null
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setShowWorkspaceMenu(state, action: PayloadAction<boolean>) {
      state.showWorkspaceMenu = action.payload;
    },
    setShowNewWorkspaceModal(state, action: PayloadAction<boolean>) {
      state.showNewWorkspaceModal = action.payload;
    },
    setShowMembersModal(state, action: PayloadAction<boolean>) {
      state.showMembersModal = action.payload;
    },
    setShowPasswordModal(state, action: PayloadAction<boolean>) {
      state.showPasswordModal = action.payload;
    },
    setPasswordForm(state, action: PayloadAction<PasswordFormState>) {
      state.passwordForm = action.payload;
    },
    setPasswordError(state, action: PayloadAction<string>) {
      state.passwordError = action.payload;
    },
    setPasswordSuccess(state, action: PayloadAction<boolean>) {
      state.passwordSuccess = action.payload;
    },
    setIsChangingPassword(state, action: PayloadAction<boolean>) {
      state.isChangingPassword = action.payload;
    },
    setShowQuickSearch(state, action: PayloadAction<boolean>) {
      state.showQuickSearch = action.payload;
    },
    setQuickSearchQuery(state, action: PayloadAction<string>) {
      state.quickSearchQuery = action.payload;
    },
    setQuickSearchIndex(state, action: PayloadAction<number>) {
      state.quickSearchIndex = action.payload;
    },
    setSidebarSearchQuery(state, action: PayloadAction<string>) {
      state.sidebarSearchQuery = action.payload;
    },
    setShowMobileSidebar(state, action: PayloadAction<boolean>) {
      state.showMobileSidebar = action.payload;
    },
    setDeletingWorkspaceId(state, action: PayloadAction<string | null>) {
      state.deletingWorkspaceId = action.payload;
    },
    setWorkspaces(state, action: PayloadAction<Workspace[]>) {
      state.workspaces = action.payload;
    },
    setInvites(state, action: PayloadAction<Workspace[]>) {
      state.invites = action.payload;
    },
    setCurrentWorkspace(state, action: PayloadAction<Workspace | null>) {
      state.currentWorkspace = action.payload;
    }
  }
});

export const {
  setShowWorkspaceMenu,
  setShowNewWorkspaceModal,
  setShowMembersModal,
  setShowPasswordModal,
  setPasswordForm,
  setPasswordError,
  setPasswordSuccess,
  setIsChangingPassword,
  setShowQuickSearch,
  setQuickSearchQuery,
  setQuickSearchIndex,
  setSidebarSearchQuery,
  setShowMobileSidebar,
  setDeletingWorkspaceId,
  setWorkspaces,
  setInvites,
  setCurrentWorkspace
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
