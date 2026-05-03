'use client';

import { useEffect, useState } from 'react';
import {
  Terminal as TerminalIcon,
  AlertCircle,
  Sparkles,
  Wifi,
  WifiOff,
  AlertTriangle
} from 'lucide-react';
import { subscribeDiagnostics, type ResolvedDiagnostic } from '@/lib/diagnostics-bus';

interface StatusBarProps {
  workspaceLabel: string;
  workerStatus: 'online' | 'offline' | 'unknown';
  isOnline: boolean;

  bottomDockOpen: boolean;
  onToggleDock: () => void;
  onOpenProblems: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

/**
 * Barra de estado global, anclada al pie de la app. Sustituye a los
 * botones flotantes de Terminal/AI: aqui viven los toggles de los
 * paneles inferiores y derechos junto con los indicadores de estado.
 * La idea es separar visualmente "altera la sidebar" (activity bar
 * arriba) de "altera vistas/paneles" (esta barra abajo).
 */
export default function StatusBar({
  workspaceLabel,
  workerStatus,
  isOnline,
  bottomDockOpen,
  onToggleDock,
  onOpenProblems,
  rightPanelOpen,
  onToggleRightPanel
}: StatusBarProps) {
  const [diagnostics, setDiagnostics] = useState<ResolvedDiagnostic[]>([]);
  useEffect(() => subscribeDiagnostics(setDiagnostics), []);
  const errors = diagnostics.filter((p) => p.severity === 'error').length;
  const warns = diagnostics.filter((p) => p.severity === 'warning').length;

  return (
    <div className="flex h-6 shrink-0 items-center justify-between gap-2 border-t border-surface-700/40 bg-surface-925/80 px-2 text-[11px] text-surface-300">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-surface-400">{workspaceLabel}</span>
        <WorkerDot status={workerStatus} />
        <ConnectivityDot online={isOnline} />
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <StatusButton
          label={`Problemas${errors + warns > 0 ? ` ${errors + warns}` : ''}`}
          icon={<AlertCircle className="h-3 w-3" />}
          onClick={onOpenProblems}
          tone={errors > 0 ? 'error' : warns > 0 ? 'warning' : undefined}
        />
        <StatusButton
          label="Terminal"
          icon={<TerminalIcon className="h-3 w-3" />}
          onClick={onToggleDock}
          active={bottomDockOpen}
          shortcut="Ctrl+`"
        />
        <StatusButton
          label="Agora AI"
          icon={<Sparkles className="h-3 w-3" />}
          onClick={onToggleRightPanel}
          active={rightPanelOpen}
          shortcut="Ctrl+Shift+I"
        />
      </div>
    </div>
  );
}

function StatusButton({
  label,
  icon,
  onClick,
  active,
  shortcut,
  tone
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  shortcut?: string;
  tone?: 'error' | 'warning';
}) {
  const toneClass = tone === 'error'
    ? 'text-rose-300'
    : tone === 'warning'
    ? 'text-amber-300'
    : '';
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
      className={`flex h-5 items-center gap-1 rounded px-1.5 transition ${
        active
          ? 'bg-mandy-500/15 text-white'
          : `text-surface-400 hover:bg-surface-800/60 hover:text-surface-100 ${toneClass}`
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function WorkerDot({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  if (status === 'offline') {
    return (
      <span className="flex items-center gap-1 text-rose-300" title="Worker sin conexión">
        <AlertTriangle className="h-3 w-3" />
        <span className="hidden sm:inline">worker offline</span>
      </span>
    );
  }
  const color = status === 'online' ? 'bg-emerald-400' : 'bg-surface-500';
  return (
    <span
      className="flex items-center gap-1 text-surface-400"
      title={status === 'online' ? 'Worker en línea' : 'Worker desconocido'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
    </span>
  );
}

function ConnectivityDot({ online }: { online: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 ${online ? 'text-surface-400' : 'text-rose-300'}`}
      title={online ? 'Conectado' : 'Sin conexión a Internet'}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
    </span>
  );
}
