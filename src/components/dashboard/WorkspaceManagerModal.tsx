'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import { ArrowRightLeft, Briefcase, Check, Copy, Loader2, MoreVertical, Pencil, Plus, Search, Trash2, User, Users, X, type LucideIcon } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Workspace } from '@/components/dashboard/types';
import { WorkspaceType } from '@/types/workspace';
import { useEscapeClose } from '@/hooks/useModalA11y';

interface WorkspaceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  invites: Workspace[];
  currentWorkspace: Workspace | null;
  user: FirebaseUser | null;
  isAdmin: boolean;
  deletingWorkspaceId: string | null;
  personalWorkspaceId: string;
  onAcceptInvite: (workspace: Workspace) => void;
  onSelectWorkspace: (workspace: Workspace) => void;
  onRenameWorkspace: (workspace: Workspace) => void;
  onDuplicateWorkspace: (workspace: Workspace) => void;
  onMergeWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  onNewWorkspace: () => void;
  onOpenMembers: (workspace: Workspace) => void;
  modalFade: Transition;
  modalPop: Transition;
}

type WorkspaceActionItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  closeModal?: boolean;
};

export default function WorkspaceManagerModal({
  isOpen,
  onClose,
  workspaces,
  invites,
  currentWorkspace,
  user,
  isAdmin,
  deletingWorkspaceId,
  personalWorkspaceId,
  onAcceptInvite,
  onSelectWorkspace,
  onRenameWorkspace,
  onDuplicateWorkspace,
  onMergeWorkspace,
  onDeleteWorkspace,
  onNewWorkspace,
  onOpenMembers,
  modalFade,
  modalPop
}: WorkspaceManagerModalProps) {
  const [query, setQuery] = useState('');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  useEscapeClose(isOpen && !actionMenuId, onClose);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActionMenuId(null);
      setActionMenuPos(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!actionMenuId) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideMenu = actionMenuRef.current && actionMenuRef.current.contains(target);
      const insideButton = actionButtonRef.current && actionButtonRef.current.contains(target);
      if (!insideMenu && !insideButton) {
        setActionMenuId(null);
        setActionMenuPos(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionMenuId(null);
        setActionMenuPos(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [actionMenuId]);

  const filteredWorkspaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return workspaces;
    return workspaces.filter(workspace => (
      workspace.name.toLowerCase().includes(normalizedQuery)
      || workspace.id.toLowerCase().includes(normalizedQuery)
    ));
  }, [query, workspaces]);

  const closeActionMenu = () => {
    setActionMenuId(null);
    setActionMenuPos(null);
  };

  const copyWorkspaceId = (workspace: Workspace) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(workspace.id);
  };

  const canManageWorkspace = (workspace: Workspace) => Boolean(
    user
    && workspace.type === WorkspaceType.Shared
    && workspace.id !== personalWorkspaceId
    && (!workspace.ownerId || workspace.ownerId === user.uid || isAdmin)
  );

  const canMergeWorkspace = (workspace: Workspace) => Boolean(
    canManageWorkspace(workspace)
    && currentWorkspace
    && currentWorkspace.type === WorkspaceType.Shared
    && currentWorkspace.id !== workspace.id
    && (!currentWorkspace.ownerId || currentWorkspace.ownerId === user?.uid || isAdmin)
  );

  const getWorkspaceActions = (workspace: Workspace): WorkspaceActionItem[] => {
    const isPersonalWorkspace = workspace.id === personalWorkspaceId || workspace.type === WorkspaceType.Personal;
    const actions: WorkspaceActionItem[] = [];

    if (!isPersonalWorkspace) {
      actions.push({
        id: 'copy-id',
        label: 'Copiar ID',
        icon: Copy,
        onClick: () => copyWorkspaceId(workspace),
        closeModal: false
      });
    }

    if (workspace.type === WorkspaceType.Shared && workspace.id !== personalWorkspaceId) {
      actions.push({
        id: 'members',
        label: 'Miembros',
        icon: Users,
        onClick: () => onOpenMembers(workspace)
      });
    }

    if (canManageWorkspace(workspace)) {
      actions.push(
        {
          id: 'rename',
          label: 'Renombrar workspace',
          icon: Pencil,
          onClick: () => onRenameWorkspace(workspace)
        },
        {
          id: 'duplicate',
          label: 'Duplicar workspace',
          icon: Copy,
          onClick: () => onDuplicateWorkspace(workspace)
        }
      );
    }

    if (canMergeWorkspace(workspace)) {
      actions.push({
        id: 'merge',
        label: `Fusionar dentro de ${currentWorkspace?.name || 'actual'}`,
        icon: ArrowRightLeft,
        onClick: () => onMergeWorkspace(workspace)
      });
    }

    if (canManageWorkspace(workspace)) {
      actions.push({
        id: 'delete',
        label: 'Eliminar workspace',
        icon: deletingWorkspaceId === workspace.id ? Loader2 : Trash2,
        onClick: () => onDeleteWorkspace(workspace),
        danger: true,
        disabled: deletingWorkspaceId === workspace.id
      });
    }

    return actions;
  };

  const openActionMenu = (event: ReactMouseEvent<HTMLButtonElement>, workspaceId: string) => {
    event.stopPropagation();
    event.preventDefault();
    if (actionMenuId === workspaceId) {
      closeActionMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 240;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    setActionMenuPos({ top: rect.bottom + 6, left });
    setActionMenuId(workspaceId);
  };

  const selectedWorkspace = actionMenuId ? workspaces.find(workspace => workspace.id === actionMenuId) ?? null : null;
  const selectedActions = selectedWorkspace ? getWorkspaceActions(selectedWorkspace) : [];

  return (
    <AnimatePresence>
      {isOpen && (
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
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={modalPop}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-surface-600/60 bg-surface-800 shadow-2xl shadow-black/40"
            style={{ willChange: 'transform, opacity' }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-manager-title"
          >
            <div className="flex items-center justify-between gap-3 border-b border-surface-600/60 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-mandy-500/30 bg-mandy-500/10 text-mandy-300">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 id="workspace-manager-title" className="truncate text-base font-semibold text-white">Gestionar espacios</h2>
                  <p className="text-xs text-surface-500">{workspaces.length} espacios</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNewWorkspace();
                  }}
                  className="flex items-center gap-2 rounded-lg border border-surface-600 bg-surface-900/70 px-3 py-2 text-xs font-semibold text-surface-200 transition hover:border-mandy-500/50 hover:text-mandy-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo espacio
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-surface-500 transition hover:bg-surface-700 hover:text-surface-200"
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-surface-600/40 px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar espacio"
                  className="w-full rounded-lg border border-surface-600 bg-surface-900/70 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-surface-500 focus:border-mandy-500/60 focus:ring-2 focus:ring-mandy-500/20"
                  autoFocus
                />
              </div>
            </div>

            {invites.length > 0 && (
              <div className="border-b border-surface-600/40 bg-mandy-500/5 px-5 py-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-mandy-300">Invitaciones</div>
                <div className="space-y-2">
                  {invites.map(invite => (
                    <div key={invite.id} className="flex items-center gap-3 rounded-lg border border-mandy-500/20 bg-surface-900/40 px-3 py-2">
                      <Briefcase className="h-4 w-4 shrink-0 text-mandy-300" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-surface-100">{invite.name}</div>
                        <div className="truncate text-[10px] font-mono text-surface-500">{invite.id}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onAcceptInvite(invite);
                        }}
                        className="rounded-lg bg-mandy-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mandy-600"
                      >
                        Unirse
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-[55vh] space-y-2 overflow-y-auto px-5 py-4">
              {filteredWorkspaces.map(workspace => {
                const isCurrentWorkspace = currentWorkspace?.id === workspace.id;
                const isPersonalWorkspace = workspace.id === personalWorkspaceId || workspace.type === WorkspaceType.Personal;
                const actions = getWorkspaceActions(workspace);

                return (
                  <div
                    key={workspace.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition ${
                      isCurrentWorkspace
                        ? 'border-mandy-500/40 bg-mandy-500/10'
                        : 'border-surface-700 bg-surface-900/40 hover:border-surface-600 hover:bg-surface-700/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectWorkspace(workspace);
                        onClose();
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        isPersonalWorkspace
                          ? 'border-surface-600 bg-surface-800 text-surface-400'
                          : 'border-mandy-500/30 bg-mandy-500/10 text-mandy-300'
                      }`}
                      >
                        {isPersonalWorkspace ? <User className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold text-surface-100">{workspace.name}</span>
                          {isCurrentWorkspace && <Check className="h-3.5 w-3.5 shrink-0 text-mandy-300" />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-surface-500">
                          <span>{isPersonalWorkspace ? 'Personal' : 'Colaborativo'}</span>
                          {!isPersonalWorkspace && <span className="font-mono">{workspace.id}</span>}
                          <span>{workspace.members.length} miembros</span>
                        </div>
                      </div>
                    </button>
                    {actions.length > 0 && (
                      <button
                        ref={actionMenuId === workspace.id ? actionButtonRef : undefined}
                        type="button"
                        onClick={(event) => openActionMenu(event, workspace.id)}
                        className={`rounded-lg p-2 transition ${
                          actionMenuId === workspace.id
                            ? 'bg-surface-600 text-surface-100'
                            : 'text-surface-500 hover:bg-surface-700 hover:text-surface-100'
                        }`}
                        title={`Opciones de ${workspace.name}`}
                        aria-label={`Opciones de ${workspace.name}`}
                        aria-haspopup="menu"
                        aria-expanded={actionMenuId === workspace.id}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}

              {filteredWorkspaces.length === 0 && (
                <div className="rounded-lg border border-dashed border-surface-700 px-4 py-8 text-center text-sm text-surface-500">
                  No hay espacios con ese nombre.
                </div>
              )}
            </div>
          </m.div>

          {selectedWorkspace && actionMenuPos && (
            <div
              ref={actionMenuRef}
              role="menu"
              className="fixed z-[70] w-60 overflow-hidden rounded-lg border border-surface-600/60 bg-surface-800 shadow-2xl shadow-black/50"
              style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
              onClick={(event) => event.stopPropagation()}
            >
              {selectedActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    title={action.label}
                    disabled={action.disabled}
                    onClick={() => {
                      closeActionMenu();
                      if (action.closeModal !== false) onClose();
                      action.onClick();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      action.danger
                        ? 'text-red-400 hover:bg-red-500/10'
                        : 'text-surface-300 hover:bg-surface-700 hover:text-surface-100'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${action.id === 'delete' && deletingWorkspaceId === selectedWorkspace.id ? 'animate-spin' : ''}`} />
                    <span className="truncate">{action.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}
