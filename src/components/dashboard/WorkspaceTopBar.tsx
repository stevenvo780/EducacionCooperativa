'use client';

import { PanelLeft, PanelBottom, PanelRight, type LucideIcon } from 'lucide-react';

interface WorkspaceTopBarProps {
  workspaceLabel: string;
  workspaceInitial: string;
  hasInvites: boolean;
  onOpenWorkspaceManager: () => void;

  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  bottomDockOpen: boolean;
  onToggleBottomDock: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;

  /** Ancho total que debe ocupar la barra (ActivityBar + Sidebar). */
  totalWidth: number;
}

/**
 * Franja superior estilo Obsidian que cubre ActivityBar + Sidebar.
 * Independiente de la vista (archivos / búsqueda / snippets / IA…).
 *
 * Estructura: [avatar workspace + nombre] ........ [toggles paneles].
 *
 * Cuando la sidebar está colapsada se reduce al ancho del activitybar
 * y oculta el nombre, dejando solo el toggle PanelLeft visible para
 * reabrirla — así no necesitamos un FAB flotante.
 */
export default function WorkspaceTopBar({
  workspaceLabel,
  workspaceInitial,
  hasInvites,
  onOpenWorkspaceManager,
  sidebarCollapsed,
  onToggleSidebar,
  bottomDockOpen,
  onToggleBottomDock,
  rightPanelOpen,
  onToggleRightPanel,
  totalWidth
}: WorkspaceTopBarProps) {
  return (
    <div
      style={{ width: totalWidth }}
      className="shrink-0 flex h-10 items-center gap-1 border-b border-surface-700/40 bg-surface-925/80 px-1.5"
    >
      {!sidebarCollapsed && (
        <button
          type="button"
          onClick={onOpenWorkspaceManager}
          title={`Workspace: ${workspaceLabel}\nClick para gestionar`}
          aria-label={`Workspace ${workspaceLabel}. Gestionar workspaces`}
          className="relative flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 transition hover:bg-surface-800/60"
        >
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-mandy text-xs font-bold text-white ring-1 ring-mandy-400/30">
            {workspaceInitial.toUpperCase()}
            {hasInvites && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-mandy-300 ring-1 ring-surface-900" aria-label="Invitaciones pendientes" />
            )}
          </span>
          <span className="text-xs font-medium text-surface-200 truncate" title={workspaceLabel}>
            {workspaceLabel}
          </span>
        </button>
      )}

      <div className={`flex items-center gap-0 shrink-0 ${sidebarCollapsed ? 'mx-auto' : ''}`}>
        <Toggle
          icon={PanelLeft}
          label={sidebarCollapsed ? 'Mostrar barra lateral' : 'Cerrar barra lateral'}
          active={!sidebarCollapsed}
          onClick={onToggleSidebar}
          shortcut="Ctrl+B"
        />
        {!sidebarCollapsed && (
          <>
            <Toggle
              icon={PanelBottom}
              label="Panel inferior"
              active={bottomDockOpen}
              onClick={onToggleBottomDock}
              shortcut="Ctrl+`"
            />
            <Toggle
              icon={PanelRight}
              label="Agora AI"
              active={rightPanelOpen}
              onClick={onToggleRightPanel}
              shortcut="Ctrl+Shift+I"
            />
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  active,
  onClick,
  shortcut
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded transition ${
        active
          ? 'text-mandy-300 bg-mandy-500/10'
          : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800/60'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.7} />
    </button>
  );
}
