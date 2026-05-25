'use client';

import { AnimatePresence, m, type Transition } from 'framer-motion';
import { ChevronDown, Trash2, Users, X } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Workspace } from './types';
import { useEscapeClose } from '@/hooks/useModalA11y';

const ROLE_LABELS: Record<'member' | 'viewer', string> = {
    member: 'Miembro',
    viewer: 'Lector'
};

interface MembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWorkspace: Workspace;
    user: FirebaseUser | null;
    memberProfiles: Record<string, { email?: string | null; displayName?: string | null }>;
    inviteEmail: string;
    setInviteEmail: (email: string) => void;
    inviteRole: 'member' | 'viewer';
    setInviteRole: (role: 'member' | 'viewer') => void;
    inviteMember: () => void;
    removeMember: (userId: string) => void;
    changeRole: (userId: string, role: 'member' | 'viewer') => void;
    modalFade: Transition;
}

export default function MembersModal({
    isOpen,
    onClose,
    currentWorkspace,
    user,
    memberProfiles,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteMember,
    removeMember,
    changeRole,
    modalFade
}: MembersModalProps) {
    useEscapeClose(isOpen, onClose);

    const isOwner = user?.uid === currentWorkspace.ownerId;

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
                    aria-label="Miembros del Espacio"
                >
                    <div className="bg-surface-800 rounded-2xl shadow-xl shadow-black/40 p-6 w-full max-w-md border border-surface-600/50" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                                <Users className="w-5 h-5 text-mandy-400" />
                                Miembros del Espacio
                            </h2>
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

                        {isOwner && (
                            <div className="mb-6">
                                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Invitar por Email</label>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        inputMode="email"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        placeholder="usuario@ejemplo.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="flex-1 px-4 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                                    />
                                    <div className="relative">
                                        <select
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value as 'member' | 'viewer')}
                                            aria-label="Rol para la invitación"
                                            className="appearance-none h-full pl-3 pr-7 bg-surface-700 border border-surface-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none cursor-pointer"
                                        >
                                            <option value="member">Miembro</option>
                                            <option value="viewer">Lector</option>
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400" />
                                    </div>
                                    <button onClick={inviteMember} className="bg-gradient-mandy text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 whitespace-nowrap">Enviar</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Miembros ({currentWorkspace.members.length})</label>
                            <div className="max-h-56 overflow-y-auto scrollbar-hide pr-2 space-y-2">
                                {currentWorkspace.members.map((uid) => {
                                    const profile = memberProfiles[uid];
                                    const email = profile?.email || (uid === user?.uid ? user?.email : null);
                                    const label = email || profile?.displayName || `UID: ${uid.substring(0, 8)}...`;
                                    const isThisOwner = uid === currentWorkspace.ownerId;
                                    const currentRole: 'member' | 'viewer' = isThisOwner
                                        ? 'member'
                                        : (currentWorkspace.memberRoles?.[uid] ?? 'member');

                                    return (
                                        <div key={uid} className="flex items-center justify-between p-2 bg-surface-700 rounded-lg text-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-8 h-8 bg-mandy-500/15 text-mandy-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                                                    U
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-surface-200 text-sm truncate" title={email || uid}>{label}</span>
                                                    {!email && profile?.displayName && (
                                                        <span className="text-[10px] text-surface-500 font-mono truncate">{uid.substring(0, 8)}...</span>
                                                    )}
                                                </div>
                                                {isThisOwner && (
                                                    <span className="shrink-0 bg-accent-purple/20 text-accent-purple-light text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                {!isThisOwner && isOwner ? (
                                                    <div className="relative">
                                                        <select
                                                            value={currentRole}
                                                            onChange={(e) => changeRole(uid, e.target.value as 'member' | 'viewer')}
                                                            aria-label={`Rol de ${label}`}
                                                            className="appearance-none pl-2 pr-6 py-0.5 bg-surface-600 border border-surface-500 rounded text-[11px] text-surface-200 focus:ring-1 focus:ring-mandy-500/50 outline-none cursor-pointer"
                                                        >
                                                            <option value="member">Miembro</option>
                                                            <option value="viewer">Lector</option>
                                                        </select>
                                                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400" />
                                                    </div>
                                                ) : !isThisOwner ? (
                                                    <span className="text-[11px] text-surface-400 px-1">{ROLE_LABELS[currentRole]}</span>
                                                ) : null}
                                                {isOwner && uid !== user?.uid && (
                                                    <button
                                                        onClick={() => removeMember(uid)}
                                                        className="p-1 hover:bg-surface-600 text-surface-400 hover:text-red-400 rounded transition-colors"
                                                        title="Eliminar miembro"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
