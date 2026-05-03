'use client';

import { Plus, Terminal as TerminalIcon, X, Pencil } from 'lucide-react';
import type { TerminalSession } from '@/context/TerminalContext';

interface TerminalsListProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  isCreatingSession: boolean;
  workerStatus: 'online' | 'offline' | 'unknown';
  onCreate: () => void;
  onSelect: (sessionId: string) => void;
  onDestroy: (sessionId: string) => void;
  onRename: (sessionId: string) => void;
}

export default function TerminalsList({
  sessions,
  activeSessionId,
  isCreatingSession,
  workerStatus,
  onCreate,
  onSelect,
  onDestroy,
  onRename
}: TerminalsListProps) {
  return (
    <div className="flex h-full w-full flex-col bg-surface-900">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-surface-700/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        <span>Terminales</span>
        <button
          type="button"
          onClick={onCreate}
          disabled={isCreatingSession || workerStatus === 'offline'}
          title={workerStatus === 'offline' ? 'Worker sin conexión' : 'Nueva sesión (Ctrl+Shift+`)'}
          aria-label="Nueva sesión de terminal"
          className="flex h-6 w-6 items-center justify-center rounded text-surface-300 transition hover:bg-surface-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-surface-500">
            <TerminalIcon className="mx-auto mb-2 h-4 w-4 opacity-60" />
            <p>Sin sesiones de terminal</p>
            <button
              type="button"
              onClick={onCreate}
              disabled={isCreatingSession || workerStatus === 'offline'}
              className="mt-2 inline-flex items-center gap-1 rounded border border-surface-700 px-2 py-1 text-surface-300 transition hover:border-mandy-500/40 hover:text-white disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Crear
            </button>
          </div>
        )}

        <ul className="space-y-0.5 px-1">
          {sessions.map((s) => {
            const active = s.id === activeSessionId;
            return (
              <li key={s.id}>
                <div
                  className={`group flex items-center gap-1.5 rounded px-2 py-1.5 text-xs transition ${
                    active
                      ? 'bg-mandy-500/15 text-white'
                      : 'text-surface-200 hover:bg-surface-800/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className="flex flex-1 min-w-0 items-center gap-2 text-left"
                  >
                    <TerminalIcon className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                    <span className="truncate">{s.name || `Terminal ${s.id.slice(0, 6)}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRename(s.id)}
                    title="Renombrar"
                    aria-label="Renombrar sesión"
                    className="hidden h-5 w-5 items-center justify-center rounded text-surface-500 hover:bg-surface-800 hover:text-white group-hover:flex"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDestroy(s.id)}
                    title="Cerrar sesión"
                    aria-label="Cerrar sesión"
                    className="hidden h-5 w-5 items-center justify-center rounded text-surface-500 hover:bg-rose-500/15 hover:text-rose-300 group-hover:flex"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
