'use client';

import { Menu, Search } from 'lucide-react';

interface MobileTopBarProps {
  workspaceLabel: string;
  workspaceInitial: string;
  userInitial: string;
  hasInvites?: boolean;
  workerStatus: 'online' | 'offline' | 'unknown';
  onOpenDrawer: () => void;
  onOpenSearch: () => void;
  onOpenUserMenu: () => void;
}

export default function MobileTopBar({
  workspaceLabel,
  workspaceInitial,
  userInitial,
  hasInvites,
  workerStatus,
  onOpenDrawer,
  onOpenSearch,
  onOpenUserMenu
}: MobileTopBarProps) {
  const dotColor =
    workerStatus === 'online'
      ? 'bg-emerald-400'
      : workerStatus === 'offline'
      ? 'bg-rose-400'
      : 'bg-surface-500';

  return (
    <header className="md:hidden flex h-11 shrink-0 items-center gap-2 border-b border-surface-700/40 bg-surface-900 px-2">
      <button
        type="button"
        onClick={onOpenDrawer}
        title="Abrir menú"
        aria-label="Abrir menú"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-surface-200 transition hover:bg-surface-800/60"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-mandy text-[11px] font-bold text-white ring-1 ring-mandy-400/30">
          {workspaceInitial.toUpperCase()}
          {hasInvites && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-mandy-300 ring-2 ring-surface-900"
              aria-label="Invitaciones pendientes"
            />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-surface-200">{workspaceLabel}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} aria-label={`Worker ${workerStatus}`} />
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        title="Buscar"
        aria-label="Buscar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-surface-300 transition hover:bg-surface-800/60"
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onOpenUserMenu}
        title="Cuenta"
        aria-label="Menú de cuenta"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-800 text-[11px] font-semibold text-surface-200 transition hover:bg-surface-700"
      >
        {userInitial.toUpperCase()}
      </button>
    </header>
  );
}
