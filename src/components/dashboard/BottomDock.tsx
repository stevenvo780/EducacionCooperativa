'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Terminal as TerminalIcon, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { WorkspaceTypeId } from '@/types/workspace';

const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });

export type DockTab = 'terminal' | 'problems';

interface BottomDockProps {
  open: boolean;
  onToggle: () => void;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: WorkspaceTypeId;
  nexusUrl: string;
  problems?: ReactNode;
}

export default function BottomDock({
  open,
  onToggle,
  workspaceId,
  workspaceName,
  workspaceType,
  nexusUrl,
  problems
}: BottomDockProps) {
  const [active, setActive] = useState<DockTab>('terminal');

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Abrir terminal/output (Ctrl+`)"
        aria-label="Abrir panel inferior"
        className="absolute bottom-3 right-3 z-30 flex h-8 items-center gap-1.5 rounded-md border border-surface-700/60 bg-surface-900/90 px-2.5 text-xs text-surface-300 shadow-xl shadow-black/30 backdrop-blur transition hover:border-mandy-500/40 hover:text-white"
      >
        <TerminalIcon className="h-3.5 w-3.5" />
        Terminal
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-surface-950 border-t border-surface-700/60">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-surface-700/60 px-2">
        <div role="tablist" className="flex items-center gap-0.5">
          <DockTabButton
            label="Terminal"
            icon={<TerminalIcon className="h-3.5 w-3.5" />}
            active={active === 'terminal'}
            onClick={() => setActive('terminal')}
          />
          <DockTabButton
            label="Problemas"
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            active={active === 'problems'}
            onClick={() => setActive('problems')}
          />
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggle}
            title="Ocultar panel"
            aria-label="Ocultar panel inferior"
            className="flex h-7 w-7 items-center justify-center rounded text-surface-400 transition hover:bg-surface-800 hover:text-white"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            title="Cerrar"
            aria-label="Cerrar panel inferior"
            className="flex h-7 w-7 items-center justify-center rounded text-surface-400 transition hover:bg-surface-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-black">
        {active === 'terminal' ? (
          <Terminal
            nexusUrl={nexusUrl}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            workspaceType={workspaceType}
          />
        ) : (
          <div className="h-full w-full overflow-y-auto p-3 text-xs text-surface-300">
            {problems ?? (
              <p className="text-surface-500">Sin problemas detectados.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DockTabButton({
  label,
  icon,
  active,
  onClick
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs transition ${
        active
          ? 'bg-surface-800 text-white'
          : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
