'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, BookPlus, EyeOff, ToggleLeft } from 'lucide-react';

export type LinterActionType = 'dictionary' | 'ignoreRule' | 'ignoreDiag';

export interface LinterActionRequest {
  type: LinterActionType;
  /** The word to add to dictionary (type=dictionary) or the text to suppress (type=ignoreDiag) */
  word?: string;
  /** Rule ID for ignoreRule or ignoreDiag */
  ruleId?: string;
  /** Human-readable rule name for ignoreRule */
  ruleName?: string;
}

interface LinterConfirmModalProps {
  action: LinterActionRequest;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIG: Record<LinterActionType, {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  confirmLabel: string;
  confirmClass: string;
}> = {
  dictionary: {
    icon: <BookPlus className="w-5 h-5 text-blue-400" />,
    title: 'Añadir al diccionario',
    accentColor: 'border-blue-500/40',
    confirmLabel: 'Añadir',
    confirmClass: 'bg-blue-600 hover:bg-blue-500'
  },
  ignoreRule: {
    icon: <ToggleLeft className="w-5 h-5 text-amber-400" />,
    title: 'Deshabilitar regla',
    accentColor: 'border-amber-500/40',
    confirmLabel: 'Deshabilitar',
    confirmClass: 'bg-amber-600 hover:bg-amber-500'
  },
  ignoreDiag: {
    icon: <EyeOff className="w-5 h-5 text-slate-400" />,
    title: 'Ignorar diagnóstico',
    accentColor: 'border-slate-500/40',
    confirmLabel: 'Ignorar',
    confirmClass: 'bg-slate-600 hover:bg-slate-500'
  }
};

function getDescription(action: LinterActionRequest): string {
  switch (action.type) {
    case 'dictionary':
      return `La palabra "${action.word}" se añadirá a tu diccionario personal y dejará de marcarse como error ortográfico en todos los documentos.`;
    case 'ignoreRule':
      return `Se deshabilitará la regla "${action.ruleName}" para todos los documentos. Puedes reactivarla desde el panel de configuración del linter.`;
    case 'ignoreDiag':
      return `El texto "${action.word}" dejará de generar diagnósticos de la regla "${action.ruleName}". Se aplicará a todos los documentos.`;
    default:
      return '';
  }
}

export function LinterConfirmModal({ action, onConfirm, onCancel }: LinterConfirmModalProps) {
  const config = CONFIG[action.type];
  const dialogRef = useRef<HTMLDivElement>(null);

  // Trap focus & close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    // Auto-focus first button
    const firstBtn = dialogRef.current?.querySelector('button');
    if (firstBtn) (firstBtn as HTMLElement).focus();
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100200] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className={`bg-slate-900 border ${config.accentColor} rounded-xl shadow-2xl p-5 w-full max-w-sm mx-4 flex flex-col gap-4`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="linter-modal-title"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          {config.icon}
          <h3 id="linter-modal-title" className="text-sm font-bold text-white">
            {config.title}
          </h3>
        </div>

        {/* Warning badge */}
        <div className="flex items-start gap-2 rounded-lg bg-slate-800/60 border border-slate-700/50 p-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            {getDescription(action)}
          </p>
        </div>

        {/* Word/rule preview */}
        {action.word && (
          <div className="text-center">
            <span className="inline-block px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-sm font-mono text-white">
              {action.word}
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-xs font-bold text-white rounded-md transition-colors ${config.confirmClass}`}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
