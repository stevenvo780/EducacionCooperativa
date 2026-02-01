'use client';

import type React from 'react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import { Search } from 'lucide-react';
import type { DocItem } from '@/components/dashboard/types';

interface QuickSearchModalProps {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  results: DocItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
  onSelect: (doc: DocItem) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  getIcon: (doc: DocItem) => React.ReactNode;
  modalFade: Transition;
  modalPop: Transition;
}

const QuickSearchModal = ({
  open,
  query,
  onQueryChange,
  results,
  selectedIndex,
  onSelectIndex,
  onClose,
  onSelect,
  onKeyDown,
  inputRef,
  getIcon,
  modalFade,
  modalPop
}: QuickSearchModalProps) => {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={modalFade}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/70"
          style={{ willChange: 'opacity' }}
          onClick={onClose}
        >
          <m.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={modalPop}
            className="w-full max-w-xl bg-surface-800 border border-surface-600 rounded-xl shadow-xl overflow-hidden transform-gpu"
            style={{ willChange: 'transform, opacity' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700">
              <Search className="w-5 h-5 text-surface-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => {
                  onQueryChange(e.target.value);
                  onSelectIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Buscar archivos... (Arriba/Abajo navegar, Enter abrir)"
                className="flex-1 bg-transparent text-white placeholder-surface-500 outline-none text-sm"
                autoFocus
              />
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-medium bg-surface-700 text-surface-400 rounded">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-surface-500 text-sm">
                  No se encontraron archivos
                </div>
              ) : (
                results.map((doc, idx) => (
                  <button
                    key={doc.id}
                    onClick={() => onSelect(doc)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      idx === selectedIndex
                        ? 'bg-mandy-500/20 text-white'
                        : 'text-surface-300 hover:bg-surface-700/50'
                    }`}
                  >
                    {getIcon(doc)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{doc.name}</div>
                      {doc.folder && (
                        <div className="text-xs text-surface-500 truncate">{doc.folder || '/'}</div>
                      )}
                    </div>
                    {idx === selectedIndex && (
                      <kbd className="px-1.5 py-0.5 text-[10px] bg-surface-600 text-surface-400 rounded">Enter</kbd>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-surface-700 flex items-center justify-between text-[10px] text-surface-500">
              <span>
                Tip: Usa <kbd className="px-1 py-0.5 bg-surface-700 rounded mx-1">Ctrl+P</kbd> para abrir este buscador
              </span>
              <span>{results.length} archivos</span>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default QuickSearchModal;
