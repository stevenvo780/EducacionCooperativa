'use client';

import dynamic from 'next/dynamic';
import { Sparkles, X, ChevronRight } from 'lucide-react';
import type { Workspace } from '@/components/dashboard/types';

const AgoraAIChat = dynamic(() => import('@/components/AgoraAIChat'), { ssr: false });

interface RightPanelProps {
  open: boolean;
  onToggle: () => void;
  currentWorkspace: Workspace | null;
}

/**
 * Panel secundario a la derecha del editor (estilo VS Code secondary
 * sidebar). Por defecto cerrado; al abrirlo aloja Agora AI como un chat
 * tipo Copilot. Diseñado para aceptar mas vistas en el futuro (Outline,
 * Backlinks, Debug, etc.) extendiendo `tab` localmente.
 */
export default function RightPanel({ open, onToggle, currentWorkspace }: RightPanelProps) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Abrir Agora AI (Ctrl+Shift+I)"
        aria-label="Abrir panel Agora AI"
        className="absolute top-3 right-3 z-30 flex h-8 items-center gap-1.5 rounded-md border border-surface-700/60 bg-surface-900/90 px-2.5 text-xs text-surface-300 shadow-xl shadow-black/30 backdrop-blur transition hover:border-mandy-500/40 hover:text-white"
      >
        <Sparkles className="h-3.5 w-3.5 text-sky-300" />
        Agora AI
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
      </button>
    );
  }

  return (
    <aside
      className="flex h-full w-full flex-col bg-surface-900 border-l border-surface-700/60"
      aria-label="Panel Agora AI"
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-surface-700/60 px-2 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        <span className="flex items-center gap-1.5 px-1">
          <Sparkles className="h-3.5 w-3.5 text-sky-300" />
          Agora AI
        </span>
        <button
          type="button"
          onClick={onToggle}
          title="Cerrar (Ctrl+Shift+I)"
          aria-label="Cerrar panel"
          className="flex h-7 w-7 items-center justify-center rounded text-surface-400 transition hover:bg-surface-800 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="flex-1 min-h-0">
        {currentWorkspace ? (
          <AgoraAIChat workspaceId={currentWorkspace.id} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-surface-500">
            Selecciona un workspace para chatear con Agora AI.
          </div>
        )}
      </div>
    </aside>
  );
}
