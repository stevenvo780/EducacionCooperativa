'use client';

import { Files, Search, GitBranch, Sparkles, Settings, type LucideIcon } from 'lucide-react';

export type ActivityView = 'files' | 'search' | 'git' | 'ai';

interface ActivityItem {
  id: ActivityView;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

const ITEMS: ActivityItem[] = [
  { id: 'files', label: 'Archivos', icon: Files, shortcut: 'Ctrl+Shift+E' },
  { id: 'search', label: 'Buscar', icon: Search, shortcut: 'Ctrl+K' },
  { id: 'git', label: 'Control de versiones', icon: GitBranch, shortcut: 'Ctrl+Shift+G' },
  { id: 'ai', label: 'Agora AI', icon: Sparkles }
];

interface ActivityBarProps {
  active: ActivityView;
  onChange: (view: ActivityView) => void;
  onOpenSettings?: () => void;
  className?: string;
}

export default function ActivityBar({ active, onChange, onOpenSettings, className = '' }: ActivityBarProps) {
  return (
    <nav
      aria-label="Barra de actividad"
      className={`hidden md:flex w-12 shrink-0 flex-col items-center justify-between border-r border-surface-700/60 bg-surface-950 py-2 ${className}`}
    >
      <ul className="flex flex-col items-center gap-1">
        {ITEMS.map((item) => {
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

      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          title="Ajustes"
          aria-label="Ajustes"
          className="flex h-10 w-10 items-center justify-center rounded-md text-surface-400 transition hover:bg-surface-800/60 hover:text-surface-100"
        >
          <Settings className="h-5 w-5" strokeWidth={1.7} />
        </button>
      )}
    </nav>
  );
}
