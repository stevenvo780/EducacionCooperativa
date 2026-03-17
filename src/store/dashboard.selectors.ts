import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { DEFAULT_TOOLBAR_VISIBILITY } from '@/components/mosaic-editor/constants';

const selectDashboardState = (state: RootState) => state.dashboard;

export const selectEditorToolbarVisibility = createSelector(
  [selectDashboardState],
  (dashboard) => ({
    ...DEFAULT_TOOLBAR_VISIBILITY,
    ...dashboard.editorToolbarVisibility
  })
);
