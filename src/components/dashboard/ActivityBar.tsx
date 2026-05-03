'use client';

import {
  Files,
  Search,
  GitBranch,
  Sparkles,
  LayoutGrid,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  AlertTriangle,
  type LucideIcon
} from 'lucide-react';

export type ActivityView = 'files' | 'search' | 'git' | 'tools' | 'ai';

interface ViewItem {
  id: ActivityView;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

const VIEWS: ViewItem[] = [
  { id: 'files', label: 'Archivos', icon: Files, shortcut: 'Ctrl+Shift+E' },
  { id: 'search', label: 'Buscar', icon: Search, shortcut: 'Ctrl+K' },
  { id: 'git', label: 'Control de versiones', icon: GitBranch, shortcut: 'Ctrl+Shift+G' },
  { id: 'tools', label: 'Herramientas', icon: LayoutGrid },
  { id: 'ai', label: 'Agora AI', icon: Sparkles }
];

interface ActivityBarProps {
  active: ActivityView;
  onChange: (view: ActivityView) => void;

  workspaceLabel: string;
  workspaceInitial: string;
  hasInvites?: boolean;
  onOpenWorkspaceManager: () => void;

  isZenMode: boolean;
  onToggleZenMode: () => void;

  workerStatus: 'online' | 'offline' | 'unknown';
  isOnline: boolean;

  userInitial: string;
  userMenuOpen: boolean;
  onToggleUserMenu: () => void;
  userMenuButtonRef?: React.Ref<HTMLButtonElement>;

  className?: string;
}

export default function ActivityBar({
  active,
  onChange,
  workspaceLabel,
  workspaceInitial,
  hasInvites,
  onOpenWorkspaceManager,
  isZenMode,
  onToggleZenMode,
  workerStatus,
  isOnline,
  userInitial,
  userMenuOpen,
  onToggleUserMenu,
  userMenuButtonRef,
  className = ''
}: ActivityBarProps) {
  return (
    <nav
      aria-label="Barra de actividad"
      className={`hidden md:flex w-12 shrink-0 flex-col items-center justify-between border-r border-surface-700/40 bg-surface-900 py-2 ${className}`}
    >
      {/* TOP: workspace switcher */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onOpenWorkspaceManager}
          title={`Workspace: ${workspaceLabel}\nClick para gestionar`}
          aria-label={`Workspace ${workspaceLabel}. Gestionar workspaces`}
          className="relative flex h-9 w-9 items-center justify-center rounded-md bg-gradient-mandy text-white text-sm font-bold shadow-sm ring-1 ring-mandy-400/30 transition hover:brightness-110"
        >
          {workspaceInitial.toUpperCase()}
          {hasInvites && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-mandy-300 ring-2 ring-surface-900"
              aria-label="Invitaciones pendientes"
            />
          )}
        </button>

        <div className="my-1 h-px w-6 bg-surface-700/60" aria-hidden />

        {/* MIDDLE: views */}
        <ul className="flex flex-col items-center gap-0.5">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onChange(item.id)}
                  title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-md transition ${
                    isActive
                      ? 'text-white'
                      : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/60'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-mandy-400" aria-hidden />
                  )}
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* BOTTOM: status + zen + user */}
      <div className="flex flex-col items-center gap-0.5">
        <StatusDot status={workerStatus} />
        <ConnectivityDot online={isOnline} />

        <button
          type="button"
          onClick={onToggleZenMode}
          title={isZenMode ? 'Salir de modo Zen' : 'Modo Zen (Ctrl+K Z)'}
          aria-label="Alternar modo Zen"
          aria-pressed={isZenMode}
          className={`flex h-10 w-10 items-center justify-center rounded-md transition ${
            isZenMode
              ? 'text-mandy-300 bg-mandy-500/10'
              : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-100'
          }`}
        >
          {isZenMode ? <EyeOff className="h-5 w-5" strokeWidth={1.7} /> : <Eye className="h-5 w-5" strokeWidth={1.7} />}
        </button>

        <button
          ref={userMenuButtonRef}
          type="button"
          onClick={onToggleUserMenu}
          title="Cuenta"
          aria-label="Menú de cuenta"
          aria-expanded={userMenuOpen}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition ${
            userMenuOpen
              ? 'bg-surface-700 text-white ring-1 ring-mandy-400/40'
              : 'bg-surface-800 text-surface-200 hover:bg-surface-700'
          }`}
        >
          {userInitial.toUpperCase()}
        </button>
      </div>
    </nav>
  );
}

function StatusDot({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  const config = {
    online: { color: 'bg-emerald-400', label: 'Worker en línea' },
    offline: { color: 'bg-rose-400', label: 'Worker sin conexión' },
    unknown: { color: 'bg-surface-500', label: 'Worker desconocido' }
  }[status];
  return (
    <div
      className="flex h-7 w-10 items-center justify-center"
      title={config.label}
      aria-label={config.label}
    >
      {status === 'offline' ? (
        <AlertTriangle className="h-3.5 w-3.5 text-rose-300" strokeWidth={2} />
      ) : (
        <span className={`h-2 w-2 rounded-full ${config.color}`} />
      )}
    </div>
  );
}

function ConnectivityDot({ online }: { online: boolean }) {
  return (
    <div
      className="flex h-7 w-10 items-center justify-center text-surface-400"
      title={online ? 'Conectado' : 'Sin conexión a Internet'}
      aria-label={online ? 'En línea' : 'Sin conexión'}
    >
      {online ? <Wifi className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} /> : <WifiOff className="h-3.5 w-3.5 text-rose-300" strokeWidth={2} />}
    </div>
  );
}
