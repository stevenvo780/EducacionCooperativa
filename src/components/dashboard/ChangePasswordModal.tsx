'use client';

import { AnimatePresence, m, type Transition } from 'framer-motion';
import { Check, Key, Loader2, X } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-utils';

interface PasswordForm {
    current: string;
    new: string;
    confirm: string;
}

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    passwordForm: PasswordForm;
    setPasswordForm: (form: PasswordForm) => void;
    passwordError: string;
    setPasswordError: (error: string) => void;
    passwordSuccess: boolean;
    setPasswordSuccess: (success: boolean) => void;
    isChangingPassword: boolean;
    setIsChangingPassword: (value: boolean) => void;
    changePassword: (current: string, next: string) => Promise<void>;
    modalFade: Transition;
    modalPop: Transition;
}

export default function ChangePasswordModal({
    isOpen,
    onClose,
    passwordForm,
    setPasswordForm,
    passwordError,
    setPasswordError,
    passwordSuccess,
    setPasswordSuccess,
    isChangingPassword,
    setIsChangingPassword,
    changePassword,
    modalFade,
    modalPop
}: ChangePasswordModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={modalFade}
                    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                    style={{ willChange: 'opacity' }}
                    onClick={onClose}
                >
                    <m.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={modalPop}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-surface-800 rounded-2xl border border-surface-600/50 p-6 w-full max-w-md shadow-xl transform-gpu"
                        style={{ willChange: 'transform, opacity' }}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Key className="w-5 h-5 text-mandy-400" />
                                Cambiar Contraseña
                            </h2>
                            <button onClick={onClose} className="p-1 hover:bg-surface-700 rounded-full text-surface-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {passwordSuccess ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-green-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">¡Contraseña actualizada!</h3>
                                <p className="text-surface-400 text-sm">Tu contraseña ha sido cambiada exitosamente.</p>
                                <button
                                    onClick={onClose}
                                    className="mt-6 px-6 py-2 bg-gradient-mandy text-white rounded-lg hover:opacity-90"
                                >
                                    Cerrar
                                </button>
                            </div>
                        ) : (
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setPasswordError('');

                                    if (passwordForm.new !== passwordForm.confirm) {
                                        setPasswordError('Las contraseñas nuevas no coinciden');
                                        return;
                                    }

                                    if (passwordForm.new.length < 6) {
                                        setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
                                        return;
                                    }

                                    setIsChangingPassword(true);
                                    try {
                                        await changePassword(passwordForm.current, passwordForm.new);
                                        setPasswordSuccess(true);
                                    } catch (error: unknown) {
                                        setPasswordError(getErrorMessage(error, 'Error al cambiar la contraseña'));
                                    } finally {
                                        setIsChangingPassword(false);
                                    }
                                }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">
                                        Contraseña Actual
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={passwordForm.current}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                            className="w-full px-4 py-3 bg-surface-700 border border-surface-600 rounded-lg text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">
                                        Nueva Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={passwordForm.new}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                        className="w-full px-4 py-3 bg-surface-700 border border-surface-600 rounded-lg text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                                        placeholder="Mínimo 6 caracteres"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">
                                        Confirmar Nueva Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={passwordForm.confirm}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                        className="w-full px-4 py-3 bg-surface-700 border border-surface-600 rounded-lg text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                                        placeholder="Repite la nueva contraseña"
                                        required
                                    />
                                </div>

                                {passwordError && (
                                    <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                        {passwordError}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 px-4 py-3 bg-surface-700 text-surface-300 rounded-lg hover:bg-surface-600 transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isChangingPassword}
                                        className="flex-1 px-4 py-3 bg-gradient-mandy text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isChangingPassword ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Cambiando...
                                            </>
                                        ) : (
                                            'Cambiar Contraseña'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
