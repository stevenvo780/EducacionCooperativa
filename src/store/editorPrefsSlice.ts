import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface EditorPrefsState {
  editorToolbarVisibility: Record<string, boolean>;
}

const initialState: EditorPrefsState = {
  editorToolbarVisibility: {
    history: true,
    inline: true,
    structure: true,
    lists: true,
    media: true,
    insert: true,
    snippets: true,
    advanced: true
  }
};

const editorPrefsSlice = createSlice({
  name: 'editorPrefs',
  initialState,
  reducers: {
    setEditorToolbarVisibility(state, action: PayloadAction<Record<string, boolean>>) {
      state.editorToolbarVisibility = action.payload;
    }
  }
});

export const { setEditorToolbarVisibility } = editorPrefsSlice.actions;

export default editorPrefsSlice.reducer;
