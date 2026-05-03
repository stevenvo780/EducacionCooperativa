'use client';

import { Eye, EyeOff } from 'lucide-react';
import { SIDEBAR_VIEWS, type ActivityView } from './sidebar-views';

export type { ActivityView } from './sidebar-views';

interface ActivityBarProps {
  active: ActivityView;
  onChange: (view: ActivityView) => void;

  isZenMode: boolean;
  onToggleZenMode: () => void;

  userInitial: string;
  userMenuOpen: boolean;
  onToggleUserMenu: () => void;
  userMenuButtonRef?: React.Ref<HTMLButtonElement>;

  className?: string;
}

export default function ActivityBar({
  active,
  onChange,
  isZenMode,
  onToggleZenMode,
  userInitial,
  userMenuOpen,
  onToggleUserMenu,
  userMenuButtonRef,
  className = ''
}: ActivityBarProps) {
  return (
    <nav
      aria-label="Barra de actividad"
      className={`flex w-12 shrink-0 flex-col items-center justify-between border-r border-surface-700/40 bg-surface-900 py-2 ${className}`}
    >
      <div className="flex flex-col items-center gap-1">
        <ul className="flex flex-col items-center gap-0.5">
          {SIDEBAR_VIEWS.map((item) => {
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

      <div className="flex flex-col items-center gap-0.5">
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
