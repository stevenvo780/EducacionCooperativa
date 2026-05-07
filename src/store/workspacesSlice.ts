import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workspace } from '@/components/dashboard/types';

export interface WorkspacesState {
  workspaces: Workspace[];
  invites: Workspace[];
  currentWorkspace: Workspace | null;
  deletingWorkspaceId: string | null;
}

const initialState: WorkspacesState = {
  workspaces: [],
  invites: [],
  currentWorkspace: null,
  deletingWorkspaceId: null
};

const workspacesSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    setWorkspaces(state, action: PayloadAction<Workspace[]>) {
      state.workspaces = action.payload;
    },
    setInvites(state, action: PayloadAction<Workspace[]>) {
      state.invites = action.payload;
    },
    setCurrentWorkspace(state, action: PayloadAction<Workspace | null>) {
      state.currentWorkspace = action.payload;
    },
    setDeletingWorkspaceId(state, action: PayloadAction<string | null>) {
      state.deletingWorkspaceId = action.payload;
    }
  }
});

export const {
  setWorkspaces,
  setInvites,
  setCurrentWorkspace,
  setDeletingWorkspaceId
} = workspacesSlice.actions;

export default workspacesSlice.reducer;
