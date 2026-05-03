'use client';

import { useEffect } from 'react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsProps {
  open: boolean;
  onClose: () => void;
  modalFade?: Transition;
  modalPop?: Transition;
}

interface ShortcutGroup {
  title: string;
  items: { keys: string; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Vistas',
    items: [
      { keys: 'Ctrl+Shift+E', label: 'Explorador (Files)' },
      { keys: 'Ctrl+K', label: 'Buscar documentos' },
      { keys: 'Ctrl+Shift+G', label: 'Control de versiones (Git)' },
      { keys: 'Ctrl+Shift+I', label: 'Alternar Agora AI' },
      { keys: 'Ctrl+Shift+M', label: 'Alternar Problemas' },
      { keys: 'Ctrl+`', label: 'Alternar Terminal' }
    ]
  },
  {
    title: 'Comandos',
    items: [
      { keys: 'Ctrl+Shift+P', label: 'Paleta de comandos' },
      { keys: 'Ctrl+P', label: 'Buscar archivos' },
      { keys: 'Ctrl+N', label: 'Nuevo archivo' },
      { keys: 'Ctrl+B', label: 'Alternar barra lateral' },
      { keys: 'Ctrl+K Z', label: 'Modo Zen' },
      { keys: 'Ctrl+Shift+`', label: 'Nueva terminal' }
    ]
  },
  {
    title: 'Pestañas',
    items: [
      { keys: 'Ctrl+Tab', label: 'Siguiente pestaña' },
      { keys: 'Ctrl+Shift+Tab', label: 'Pestaña anterior' },
      { keys: 'Ctrl+W', label: 'Cerrar pestaña activa' }
    ]
  },
  {
    title: 'Edición',
    items: [
      { keys: 'Enter', label: 'Enviar mensaje en chat AI' },
      { keys: 'Shift+Enter', label: 'Nueva línea en chat AI' },
      { keys: 'Esc', label: 'Cerrar modal/popover' }
    ]
  }
];

export default function KeyboardShortcuts({ open, onClose, modalFade, modalPop }: ShortcutsProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <AnimatePresence>
      <m.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={modalFade}
        onMouseDown={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
      >
        <m.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={modalPop}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full max-w-2xl overflow-hidden rounded-lg border border-surface-700/60 bg-surface-900 shadow-2xl shadow-black/40"
        >
          <header className="flex items-center justify-between border-b border-surface-700/60 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-surface-100">
              <Keyboard className="h-4 w-4 text-mandy-300" />
              Atajos de teclado
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-7 w-7 items-center justify-center rounded text-surface-400 transition hover:bg-surface-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-3">
            {GROUPS.map((g) => (
              <section key={g.title}>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-surface-500">{g.title}</h3>
                <ul className="space-y-1">
                  {g.items.map((s) => (
                    <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-surface-300">{s.label}</span>
                      <kbd className="rounded border border-surface-700 bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-surface-300">
                        {s.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
