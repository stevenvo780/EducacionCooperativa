'use client';

import { AnimatePresence, m, type Transition } from 'framer-motion';

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
    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={modalFade}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    style={{ willChange: 'opacity' }}
                >
                    <div className="bg-surface-800 rounded-2xl shadow-xl shadow-black/40 p-6 w-full max-w-sm border border-surface-600/50">
                        <h2 className="text-lg font-bold mb-4 text-white">Nuevo Espacio de Trabajo</h2>
                        <input
                            type="text"
                            placeholder="Nombre, ej: Grupo Física"
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                            className="w-full px-4 py-2 bg-surface-700 border border-surface-600 rounded-lg mb-4 text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                            autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-surface-400 hover:bg-surface-700 rounded-lg">Cancelar</button>
                            <button onClick={onCreate} disabled={!workspaceName.trim()} className="px-4 py-2 text-sm bg-gradient-mandy text-white rounded-lg hover:opacity-90 disabled:opacity-50">Crear</button>
                        </div>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
