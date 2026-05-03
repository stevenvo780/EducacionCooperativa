'use client';

import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import type { Workspace } from '@/components/dashboard/types';
import { PanelErrorBoundary } from './PanelErrorBoundary';

const AgoraAIChat = dynamic(() => import('@/components/AgoraAIChat'), { ssr: false });

interface RightPanelProps {
  open: boolean;
  currentWorkspace: Workspace | null;
}

/**
 * Panel secundario a la derecha del editor. Para cerrarlo el usuario
 * usa el toggle PanelRight de la WorkspaceTopBar (Ctrl+Shift+I).
 */
export default function RightPanel({ open, currentWorkspace }: RightPanelProps) {
  if (!open) return null;

  return (
    <aside
      className="relative flex h-full w-full flex-col bg-surface-900 border-l border-surface-700/60"
      aria-label="Panel Agora AI"
      data-shell="copilot"
    >
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
