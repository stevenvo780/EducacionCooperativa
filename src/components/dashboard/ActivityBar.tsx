'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      const target = document.documentElement;
      if (!target || !target.isConnected) return;
      target.requestFullscreen().catch(() => {});
    } catch {
      /* algunos browsers tiran TypeError sync si el elemento no es fullscreen-capable */
    }
  };

  return (
    <nav
      aria-label="Barra de actividad"
      className={`flex w-12 shrink-0 flex-col items-center justify-between border-r border-surface-700/40 bg-surface-900 py-1.5 ${className}`}
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
                  className={`relative flex h-11 w-11 items-center justify-center rounded-md transition ${
                    isActive
                      ? 'text-white'
                      : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/60'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-mandy-400" aria-hidden />
                  )}
                  <Icon className="h-6 w-6" strokeWidth={1.7} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Salir de pantalla completa (F11)' : 'Pantalla completa (F11)'}
          aria-label="Alternar pantalla completa"
          aria-pressed={isFullscreen}
          className={`flex h-11 w-11 items-center justify-center rounded-md transition ${
            isFullscreen
              ? 'text-mandy-300 bg-mandy-500/10'
              : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-100'
          }`}
        >
          {isFullscreen ? <Minimize2 className="h-6 w-6" strokeWidth={1.7} /> : <Maximize2 className="h-6 w-6" strokeWidth={1.7} />}
        </button>

        <button
          type="button"
          onClick={onToggleZenMode}
          title={isZenMode ? 'Salir de modo Zen' : 'Modo Zen (Ctrl+K Z)'}
          aria-label="Alternar modo Zen"
          aria-pressed={isZenMode}
          className={`flex h-11 w-11 items-center justify-center rounded-md transition ${
            isZenMode
              ? 'text-mandy-300 bg-mandy-500/10'
              : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-100'
          }`}
        >
          {isZenMode ? <EyeOff className="h-6 w-6" strokeWidth={1.7} /> : <Eye className="h-6 w-6" strokeWidth={1.7} />}
        </button>

        <button
          ref={userMenuButtonRef}
          type="button"
          onClick={onToggleUserMenu}
          title="Cuenta"
          aria-label="Menú de cuenta"
          aria-expanded={userMenuOpen}
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
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
