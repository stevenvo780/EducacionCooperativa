import type React from 'react';

export type ViewMode = 'edit' | 'preview' | 'raw';

export interface SearchState {
  currentMatch: number;
  totalMatches: number;
}

export interface EditorProps {
  initialContent?: string;
  roomId: string;
  onClose?: () => void;
  embedded?: boolean;
  viewMode?: ViewMode;
  externalSearchTerm?: string;
  onSearchStateChange?: (state: SearchState) => void;
  searchNavRef?: React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
  /**
   * Cuando true, oculta la barra de stats inline del editor y publica
   * los segments al status-bus global. Se usa cuando el editor vive
   * dentro del workspace shell, que ya tiene su StatusBar.
   */
  hideInlineStatus?: boolean;
}

export type ToolbarGroupKey =
  | 'history'
  | 'inline'
  | 'structure'
  | 'lists'
  | 'media'
  | 'insert'
  | 'snippets'
  | 'advanced';

export type ToolbarVisibility = Record<ToolbarGroupKey, boolean>;

export type QuickInsert = {
  id: string;
  title: string;
  description: string;
  markdown: string;
};

export type MarkdownDocMeta = {
  workspaceId: string | null;
  folder: string;
  name: string;
};
