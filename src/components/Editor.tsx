'use client';
import React from 'react';
import dynamic from 'next/dynamic';

const MosaicEditor = dynamic(() => import('./MosaicEditor'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-surface-400">Loading editor...</div>
});

export type ViewMode = 'edit' | 'split' | 'preview';

export interface SearchState {
  currentMatch: number;
  totalMatches: number;
}

export interface EditorProps {
  initialContent?: string;
  roomId: string;
  onClose?: () => void;
  embedded?: boolean;
  forceInline?: boolean;
  viewMode?: ViewMode;
  externalSearchTerm?: string;
  onSearchStateChange?: (state: SearchState) => void;
  onNavigateSearch?: (direction: 'next' | 'prev') => void;
  searchNavRef?: React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
}

export default function Editor(props: EditorProps) {
  if (props.embedded && !props.forceInline) {
    const src = `/editor/${encodeURIComponent(props.roomId)}?embedded=1`;
    return (
      <iframe
        src={src}
        title={`Editor ${props.roomId}`}
        className="h-full w-full border-0 bg-slate-950"
      />
    );
  }

  return <MosaicEditor {...props} />;
}
