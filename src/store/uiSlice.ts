import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface PasswordFormState {
  current: string;
  new: string;
  confirm: string;
}

export interface UiState {
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
}

const initialState: UiState = {
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
  showMobileSidebar: false
};

const uiSlice = createSlice({
  name: 'ui',
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
  setShowMobileSidebar
} = uiSlice.actions;

export default uiSlice.reducer;
