'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Wifi,
  WifiOff,
  AlertTriangle,
  PanelLeft
} from 'lucide-react';
import { subscribeDiagnostics } from '@/lib/diagnostics-bus';
import { subscribeStatus, type StatusSegment, type StatusTone } from '@/lib/status-bus';
import LintersStatusButton from './LintersStatusButton';

interface StatusBarProps {
  workspaceLabel: string;
  workerStatus: 'online' | 'offline' | 'unknown';
  isOnline: boolean;

  /** Toggle de Problemas: queda en el status bar porque es informativo
   *  (cuenta errores+warnings) y no equivale a un panel completo. */
  onOpenProblems: () => void;

  /** Cuando la sidebar está colapsada, el status bar muestra un único
   *  botón para reabrirla — así no necesitamos un FAB flotante. */
  sidebarCollapsed: boolean;
  onShowSidebar: () => void;

  /** Extensión del archivo activo (sin punto, lowercase). Se usa para
   *  filtrar qué linters aplican al archivo en foco. Null → ningún
   *  archivo abierto (no se muestra el menú de linters). */
  activeFileExt: string | null;
}

/**
 * Status bar global. Se compone de:
 * - Segmentos LEFT: (botón mostrar sidebar si colapsada) + workspace +
 *   worker dot + online dot + segments del bus con slot=left.
 * - Segmentos RIGHT: segments del bus con slot=right (Guardado, linter,
 *   encoding…) + toggle de Problemas (informativo).
 *
 * Los toggles de Terminal / Agora AI / sidebar viven en la mini navbar
 * horizontal de la cabecera de la sidebar (estilo Obsidian).
 */
export default function StatusBar({
  workspaceLabel,
  workerStatus,
  isOnline,
  onOpenProblems,
  sidebarCollapsed,
  onShowSidebar,
  activeFileExt
}: StatusBarProps) {
  const [counts, setCounts] = useState({ errors: 0, warns: 0 });
  const [segments, setSegments] = useState<StatusSegment[]>([]);

  useEffect(() => subscribeDiagnostics((items) => {
    let errors = 0, warns = 0;
    for (const i of items) {
      if (i.severity === 'error') errors++;
      else if (i.severity === 'warning') warns++;
    }
    setCounts((prev) => prev.errors === errors && prev.warns === warns ? prev : { errors, warns });
  }), []);

  useEffect(() => subscribeStatus(setSegments), []);

  const left = segments.filter((s) => (s.slot ?? 'left') === 'left');
  const right = segments.filter((s) => s.slot === 'right');
  const { errors, warns } = counts;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="flex h-6 shrink-0 items-center justify-between gap-2 border-t border-surface-700/40 bg-surface-925/80 px-2 text-[11px] text-surface-300"
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={onShowSidebar}
            title="Mostrar barra lateral (Ctrl+B)"
            aria-label="Mostrar barra lateral"
            className="flex h-5 items-center gap-1 rounded px-1.5 text-surface-300 hover:bg-surface-800/60 hover:text-surface-100"
          >
            <PanelLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Mostrar barra</span>
          </button>
        )}
        <span className="truncate text-surface-400">{workspaceLabel}</span>
        <WorkerDot status={workerStatus} />
        <ConnectivityDot online={isOnline} />
        {left.length > 0 && <Divider />}
        {left.map((s) => <SegmentPill key={s.id} segment={s} />)}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {right.map((s) => <SegmentPill key={s.id} segment={s} />)}
        {right.length > 0 && <Divider />}
        <LintersStatusButton activeFileExt={activeFileExt} />
        <ToggleButton
          label={`Problemas${errors + warns > 0 ? ` ${errors + warns}` : ''}`}
          icon={<AlertCircle className="h-3 w-3" />}
          onClick={onOpenProblems}
          tone={errors > 0 ? 'error' : warns > 0 ? 'warning' : undefined}
        />
      </div>
    </div>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-surface-700/60 mx-0.5" aria-hidden />;
}

function SegmentPill({ segment }: { segment: StatusSegment }) {
  const Icon = segment.icon;
  const toneClass = toneToClass(segment.tone);
  const hideClass = segment.hideBelow === 'lg' ? 'hidden lg:flex'
    : segment.hideBelow === 'md' ? 'hidden md:flex'
    : segment.hideBelow === 'sm' ? 'hidden sm:flex'
    : 'flex';
  const interactive = Boolean(segment.onClick);
  const baseClass = `${hideClass} h-5 items-center gap-1 rounded px-1.5 transition ${toneClass} ${
    interactive ? 'hover:bg-surface-800/60 cursor-pointer' : ''
  }`;

  const inner: ReactNode = (
    <>
      {Icon && <Icon className="h-3 w-3" />}
      <span className="truncate max-w-[12rem]">{segment.label}</span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={segment.onClick} title={segment.title} className={baseClass}>
        {inner}
      </button>
    );
  }
  return <span title={segment.title} className={baseClass}>{inner}</span>;
}

function toneToClass(tone?: StatusTone): string {
  switch (tone) {
    case 'error': return 'text-rose-300';
    case 'warning': return 'text-amber-300';
    case 'info': return 'text-sky-300';
    case 'success': return 'text-emerald-300';
    case 'muted': return 'text-surface-300';
    default: return 'text-surface-300';
  }
}

function ToggleButton({
  label, icon, onClick, active, shortcut, tone
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
