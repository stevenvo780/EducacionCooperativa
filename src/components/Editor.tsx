'use client';
import React from 'react';
import dynamic from 'next/dynamic';

const MosaicEditor = dynamic(() => import('./MosaicEditor'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-surface-400">Loading editor...</div>
});

export type ViewMode = 'edit' | 'split' | 'preview';

export interface EditorProps {
  initialContent?: string;
  roomId: string;
  onClose?: () => void;
  embedded?: boolean;
  viewMode?: ViewMode;
}

export default function Editor(props: EditorProps) {
  return <MosaicEditor {...props} />;
}
