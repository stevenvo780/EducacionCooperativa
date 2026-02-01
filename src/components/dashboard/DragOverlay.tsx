'use client';

import { DEFAULT_FOLDER_NAME } from '@/lib/folder-utils';

interface DragOverlayProps {
  isDragActive: boolean;
  workspaceName?: string | null;
}

const DragOverlay = ({ isDragActive, workspaceName }: DragOverlayProps) => {
  if (!isDragActive) return null;

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-surface-900/70 border-2 border-dashed border-mandy-500/70" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface-800/80 border border-mandy-500/40 rounded-xl px-6 py-4 text-center shadow-xl shadow-black/40">
          <div className="text-sm font-semibold text-white">Suelta para subir</div>
          <div className="text-xs text-surface-300">
            Destino: {workspaceName || 'Espacio Personal'} / {DEFAULT_FOLDER_NAME}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragOverlay;
