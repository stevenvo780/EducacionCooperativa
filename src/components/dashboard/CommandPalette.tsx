'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import { rankCommands } from '@/lib/command-search';

export interface Command {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  keywords?: string[];
  run: () => void | Promise<void>;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  modalFade?: Transition;
  modalPop?: Transition;
}

export default function CommandPalette({ open, onClose, commands, modalFade, modalPop }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const ranked = useMemo(() => rankCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (index >= ranked.length) setIndex(Math.max(0, ranked.length - 1));
  }, [index, ranked.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelectorAll('button[role="option"]')[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const run = (cmd: Command) => {
    onClose();
    void cmd.run();
  };

  return (
    <AnimatePresence>
      <m.div
        key="cp-overlay"
        className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={modalFade}
        onMouseDown={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
      >
        <m.div
          className="w-full max-w-xl overflow-hidden rounded-lg border border-surface-700/60 bg-surface-900 shadow-2xl shadow-black/40"
          initial={{ scale: 0.96, y: -8, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: -8, opacity: 0 }}
          transition={modalPop}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-surface-700/60 px-3 py-2">
            <Search className="h-4 w-4 text-surface-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe un comando…"
              aria-label="Buscar comando"
              className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIndex((i) => Math.min(i + 1, ranked.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const sel = ranked[index];
                  if (sel) run(sel);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
            <kbd className="hidden rounded border border-surface-700 bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-surface-400 sm:inline">
              Esc
            </kbd>
          </div>

          <ul ref={listRef} className="max-h-[55vh] overflow-y-auto py-1" role="listbox">
            {ranked.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-surface-500">Sin coincidencias</li>
            )}
            {ranked.map((cmd, i) => {
              const active = i === index;
              return (
                <li key={cmd.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => run(cmd)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                      active ? 'bg-mandy-500/15 text-white' : 'text-surface-200 hover:bg-surface-800/60'
                    }`}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      {cmd.category && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-surface-500">
                          {cmd.category}
                        </span>
                      )}
                      <span className="truncate">{cmd.label}</span>
                    </span>
                    {cmd.shortcut && (
                      <kbd className="shrink-0 rounded border border-surface-700 bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-surface-400">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
