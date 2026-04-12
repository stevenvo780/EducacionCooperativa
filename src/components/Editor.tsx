'use client';
import React from 'react';
import type { DocumentTypeId } from '@/types/documents';
import DocumentSurface from './DocumentSurface';

export type ViewMode = 'edit' | 'preview' | 'raw';

export interface SearchState {
  currentMatch: number;
  totalMatches: number;
}

export interface EditorProps {
  initialContent?: string;
  roomId: string;
  workspaceId?: string;
  onClose?: () => void;
  embedded?: boolean;
  viewMode?: ViewMode;
  externalSearchTerm?: string;
  onSearchStateChange?: (state: SearchState) => void;
  onNavigateSearch?: (direction: 'next' | 'prev') => void;
  searchNavRef?: React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
  initialDocument?: {
    type?: DocumentTypeId;
    name?: string;
    mimeType?: string;
    url?: string;
    storagePath?: string;
  };
}

export default function Editor(props: EditorProps) {
  return <DocumentSurface {...props} />;
}
