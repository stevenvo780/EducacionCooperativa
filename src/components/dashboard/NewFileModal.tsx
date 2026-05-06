'use client';

import { useEffect } from 'react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import { FileText, Code, X } from 'lucide-react';

export type FileKind = 'md' | 'st';

interface FileTypeOption {
  kind: FileKind;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  border: string;
  bg: string;
}

const FILE_TYPES: FileTypeOption[] = [
  {
    kind: 'md',
    label: 'Documento Markdown',
    description: 'Texto con formato, ideal para notas, documentación y apuntes.',
    icon: <FileText className="w-6 h-6" />,
    accent: 'text-sky-400',
    border: 'border-sky-500/40 hover:border-sky-400',
    bg: 'hover:bg-sky-500/10'
  },
  {
    kind: 'st',
    label: 'Lógica ST',
    description: 'Archivo de lógica formal con soporte para múltiples sistemas.',
    icon: <Code className="w-6 h-6" />,
    accent: 'text-emerald-400',
    border: 'border-emerald-500/40 hover:border-emerald-400',
    bg: 'hover:bg-emerald-500/10'
  }
];

interface NewFileModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: FileKind) => void;
  modalFade: Transition;
  modalPop: Transition;
}

const NewFileModal = ({ open, onClose, onSelect, modalFade, modalPop }: NewFileModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={modalFade}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          style={{ willChange: 'opacity' }}
          onClick={onClose}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo archivo"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={modalPop}
            className="w-full max-w-sm bg-surface-800 border border-surface-600/60 rounded-2xl shadow-xl shadow-black/30 transform-gpu"
            style={{ willChange: 'transform, opacity' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Nuevo archivo</p>
                <p className="mt-1 text-xs text-surface-400 leading-relaxed">
                  Elige el tipo de archivo que deseas crear
                </p>
              </div>
              <button onClick={onClose} className="p-1 text-surface-500 hover:text-surface-200 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-2">
              {FILE_TYPES.map(({ kind, label, description, icon, accent, border, bg }) => (
                <button
                  key={kind}
                  onClick={() => onSelect(kind)}
                  className={`flex items-start gap-3 w-full text-left p-3 rounded-xl border transition ${border} ${bg} bg-surface-900/40`}
                >
                  <span className={`mt-0.5 ${accent}`}>{icon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${accent}`}>{label}</p>
                    <p className="text-[11px] text-surface-400 leading-relaxed mt-0.5">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default NewFileModal;
