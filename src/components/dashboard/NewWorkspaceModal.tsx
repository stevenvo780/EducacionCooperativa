'use client';

import { AnimatePresence, m, type Transition } from 'framer-motion';
import { X } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useModalA11y';

interface NewWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceName: string;
    setWorkspaceName: (name: string) => void;
    onCreate: () => void;
    modalFade: Transition;
}

export default function NewWorkspaceModal({
    isOpen,
    onClose,
    workspaceName,
    setWorkspaceName,
    onCreate,
    modalFade
}: NewWorkspaceModalProps) {
    useEscapeClose(isOpen, onClose);
    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={modalFade}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    style={{ willChange: 'opacity' }}
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Nuevo Espacio de Trabajo"
                >
                    <div className="bg-surface-800 rounded-2xl shadow-xl shadow-black/40 p-6 w-full max-w-sm border border-surface-600/50" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <h2 className="text-lg font-bold text-white">Nuevo Espacio de Trabajo</h2>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Cerrar"
                                title="Cerrar"
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-surface-400 hover:bg-surface-700 hover:text-white transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <input
                            type="text"
                            aria-label="Nombre del nuevo espacio de trabajo"
                            placeholder="Nombre, ej: Grupo Física"
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                            className="w-full px-4 py-2 bg-surface-700 border border-surface-600 rounded-lg mb-4 text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                            autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 text-sm text-surface-300 bg-surface-700 border border-surface-600 hover:bg-surface-600 hover:text-white rounded-lg transition">Cancelar</button>
                            <button type="button" onClick={onCreate} disabled={!workspaceName.trim()} className="min-h-[44px] px-4 py-2 text-sm bg-gradient-mandy text-white rounded-lg hover:opacity-90 disabled:opacity-50">Crear</button>
                        </div>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
