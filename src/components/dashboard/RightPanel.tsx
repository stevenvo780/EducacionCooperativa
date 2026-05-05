'use client';

import dynamic from 'next/dynamic';
import { Sparkles, X } from 'lucide-react';
import type { Workspace } from '@/components/dashboard/types';
import { PanelErrorBoundary } from './PanelErrorBoundary';

const AgoraAIChat = dynamic(() => import('@/components/AgoraAIChat'), { ssr: false });

interface RightPanelProps {
  open: boolean;
  currentWorkspace: Workspace | null;
  /** Cuando se pasa, renderiza un botón X visible para cerrar el panel.
   *  Necesario en isCompact (mobile/tablet) donde el panel cubre todo el viewport. */
  onClose?: () => void;
}

/**
 * Panel secundario a la derecha del editor. En desktop se cierra con el toggle
 * PanelRight de la WorkspaceTopBar (Ctrl+Shift+I); en mobile recibe onClose
 * para mostrar un X interno (sin él el user queda atrapado en el overlay).
 */
export default function RightPanel({ open, currentWorkspace, onClose }: RightPanelProps) {
  if (!open) return null;

  return (
    <aside
      className="relative flex h-full w-full flex-col bg-surface-900 border-l border-surface-700/60"
      aria-label="Panel Agora AI"
      data-shell="copilot"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-800/80 text-surface-200 hover:bg-surface-700 transition"
          aria-label="Cerrar panel Agora AI"
          title="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex-1 min-h-0">
        <PanelErrorBoundary name="Agora AI">
          {currentWorkspace ? (
            <AgoraAIChat workspaceId={currentWorkspace.id} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-xs text-surface-500">
              <Sparkles className="h-5 w-5 text-sky-300" />
              <p>Selecciona un workspace para chatear con Agora AI.</p>
            </div>
          )}
        </PanelErrorBoundary>
      </div>
    </aside>
  );
}
