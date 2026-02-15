'use client';

import { DEFAULT_FOLDER_NAME } from '@/lib/folder-utils';
import { Folder } from 'lucide-react';

interface DragOverlayProps {
  isDragActive: boolean;
  workspaceName?: string | null;
  activeFolder?: string;
}

const DragOverlay = ({ isDragActive, workspaceName, activeFolder }: DragOverlayProps) => {
  if (!isDragActive) return null;

  const folderLabel = activeFolder || DEFAULT_FOLDER_NAME;

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-surface-900/70 border-2 border-dashed border-mandy-500/70" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface-800/80 border border-mandy-500/40 rounded-xl px-6 py-4 text-center shadow-xl shadow-black/40">
          <div className="text-sm font-semibold text-white">Suelta para subir</div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-surface-300 mt-1">
            <span>{workspaceName || 'Espacio Personal'}</span>
            <span className="text-surface-500">/</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Folder className="w-3 h-3" />
              {folderLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragOverlay;
