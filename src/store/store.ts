import { configureStore } from '@reduxjs/toolkit';
import uiReducer from '@/store/uiSlice';
import workspacesReducer from '@/store/workspacesSlice';
import editorPrefsReducer from '@/store/editorPrefsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    workspaces: workspacesReducer,
    editorPrefs: editorPrefsReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
