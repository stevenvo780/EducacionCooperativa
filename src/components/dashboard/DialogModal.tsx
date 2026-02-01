'use client';

import { AnimatePresence, m, type Transition } from 'framer-motion';
import { X } from 'lucide-react';
import type { DialogConfig } from '@/components/dashboard/types';

interface DialogModalProps {
  dialogConfig: DialogConfig | null;
  dialogInputValue: string;
  onDialogInputChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  modalFade: Transition;
  modalPop: Transition;
}

const DialogModal = ({
  dialogConfig,
  dialogInputValue,
  onDialogInputChange,
  onConfirm,
  onCancel,
  modalFade,
  modalPop
}: DialogModalProps) => {
  return (
    <AnimatePresence>
      {dialogConfig && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={modalFade}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] motion-reduce:backdrop-blur-none p-4"
          onClick={() => {
            if (dialogConfig.type === 'confirm' || dialogConfig.type === 'input') onCancel();
          }}
        >
          <m.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={modalPop}
            className="w-full max-w-sm bg-surface-800 border border-surface-600/60 rounded-2xl shadow-xl shadow-black/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{dialogConfig.title}</p>
                {dialogConfig.message && (
                  <p className="mt-1 text-xs text-surface-400 leading-relaxed">{dialogConfig.message}</p>
                )}
              </div>
              <button onClick={onCancel} className="p-1 text-surface-500 hover:text-surface-200 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {dialogConfig.type === 'input' && (
              <div className="px-5 pb-2">
                <input
                  autoFocus
                  value={dialogInputValue}
                  onChange={(e) => onDialogInputChange(e.target.value)}
                  placeholder={dialogConfig.placeholder || 'Ingresa un valor'}
                  className="w-full px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/60 focus:border-mandy-500 outline-none"
                />
              </div>
            )}

            <div className="px-5 py-4 flex justify-end gap-2">
              {(dialogConfig.type === 'confirm' || dialogConfig.type === 'input') && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-semibold text-surface-300 bg-surface-700 border border-surface-600 rounded-lg hover:text-white hover:border-surface-500 transition"
                >
                  {dialogConfig.cancelLabel || 'Cancelar'}
                </button>
              )}
              <button
                onClick={onConfirm}
                disabled={dialogConfig.type === 'input' && dialogConfig.required !== false && !dialogInputValue.trim()}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${dialogConfig.danger ? 'bg-red-600 text-white hover:bg-red-500 disabled:hover:bg-red-600' : 'bg-gradient-mandy text-white hover:opacity-90 disabled:hover:opacity-50'}`}
              >
                {dialogConfig.confirmLabel || (dialogConfig.type === 'confirm' ? 'Confirmar' : 'Aceptar')}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default DialogModal;
