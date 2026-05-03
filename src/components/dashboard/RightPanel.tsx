'use client';

import dynamic from 'next/dynamic';
import { Sparkles, X } from 'lucide-react';
import type { Workspace } from '@/components/dashboard/types';
import { PanelErrorBoundary } from './PanelErrorBoundary';

const AgoraAIChat = dynamic(() => import('@/components/AgoraAIChat'), { ssr: false });

interface RightPanelProps {
  open: boolean;
  onToggle: () => void;
  currentWorkspace: Workspace | null;
}

/**
 * Panel secundario a la derecha del editor (estilo VS Code secondary
 * sidebar). Aloja Agora AI con su propio chrome — el chat ya incluye
 * sidebar de historial, modo agente/chat, quick prompts y rollback.
 *
 * Diseñado para aceptar futuras vistas (Outline, Backlinks, Debug)
 * cuando se introduzca un selector tipo SIDEBAR_VIEWS.
 */
export default function RightPanel({ open, onToggle, currentWorkspace }: RightPanelProps) {
  if (!open) return null;

  return (
    <aside
      className="flex h-full w-full flex-col bg-surface-900 border-l border-surface-700/60"
      aria-label="Panel Agora AI"
      data-shell="copilot"
    >
      {/* Botón cerrar flotante (top right) — el chrome del chat queda visible */}
      <button
        type="button"
        onClick={onToggle}
        title="Cerrar panel (Ctrl+Shift+I)"
        aria-label="Cerrar panel"
        className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded text-surface-400 transition hover:bg-surface-800 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>

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
