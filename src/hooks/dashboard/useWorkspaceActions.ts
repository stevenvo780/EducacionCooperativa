'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import type { MosaicNode } from 'react-mosaic-component';
import {
    createWorkspaceApi,
    deleteWorkspaceApi,
    duplicateWorkspaceApi,
    inviteMemberApi,
    mergeWorkspaceApi,
    renameWorkspaceApi,
    removeMemberApi
} from '@/services/dashboardApi';
import { clearDashboardState } from '@/services/dashboardPersistence';
import { DialogKind, type DocItem, type FolderItem, type Workspace, type DialogConfig, type DialogResult } from '@/components/dashboard/types';
import { PERSONAL_WORKSPACE_ID, WorkspaceType } from '@/types/workspace';

const ROOT_FOLDER_PATH = '';

interface UseWorkspaceActionsOptions {
    user: User | null;
    currentWorkspace: Workspace | null;
    isAdmin: boolean;
    newWorkspaceName: string;
    setNewWorkspaceName: (name: string) => void;
    setShowNewWorkspaceModal: (value: boolean) => void;
    setShowMembersModal: (value: boolean) => void;
    setShowWorkspaceMenu: (value: boolean) => void;
    setDeletingWorkspaceId: (id: string | null) => void;
    fetchWorkspaces: () => Promise<void>;
    selectWorkspace: (workspace: Workspace) => void;
    setDocs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    setFolders: React.Dispatch<React.SetStateAction<FolderItem[]>>;
    setOpenTabs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    setMosaicNode: React.Dispatch<React.SetStateAction<MosaicNode<string> | null>>;
    setSelectedDocId: (id: string | null) => void;
    setActiveFolderSafe: (path: string) => void;
    setClosedFilesTabByWorkspace: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    requestDocsRefresh: (options?: { force?: boolean; delayMs?: number; showLoading?: boolean }) => Promise<void>;
    showDialog: (config: DialogConfig) => Promise<DialogResult>;
    inviteEmail: string;
    setInviteEmail: (email: string) => void;
}

interface UseWorkspaceActionsResult {
    createWorkspace: () => Promise<void>;
    renameWorkspace: (workspace: Workspace) => Promise<void>;
    duplicateWorkspace: (workspace: Workspace) => Promise<void>;
    mergeWorkspaceIntoCurrent: (sourceWorkspace: Workspace) => Promise<void>;
    deleteWorkspace: (workspace: Workspace) => Promise<void>;
    inviteMember: () => Promise<void>;
    removeMember: (userId: string) => Promise<void>;
}

export function useWorkspaceActions({
    user,
    currentWorkspace,
    isAdmin,
    newWorkspaceName,
    setNewWorkspaceName,
    setShowNewWorkspaceModal,
    setShowMembersModal,
    setShowWorkspaceMenu,
    setDeletingWorkspaceId,
    fetchWorkspaces,
    selectWorkspace,
    setDocs,
    setFolders,
    setOpenTabs,
    setMosaicNode,
    setSelectedDocId,
    setActiveFolderSafe,
    setClosedFilesTabByWorkspace,
    requestDocsRefresh,
    showDialog,
    inviteEmail,
    setInviteEmail
}: UseWorkspaceActionsOptions): UseWorkspaceActionsResult {

    const createWorkspace = async () => {
        if (!newWorkspaceName.trim() || !user) return;
        try {
            const data = await createWorkspaceApi({ name: newWorkspaceName, ownerId: user.uid });
            setNewWorkspaceName('');
            setShowNewWorkspaceModal(false);
            // El backend acaba de agregar el custom claim `workspaces[newId]`.
            // Forzar refresh del JWT para que RTDB rules dejen pasar los
            // listeners de sync-events/<newId> y presence/<newId> desde el
            // primer intento, sin esperar el refresh automático de ~1h.
            await user.getIdToken(true).catch(() => { /* ignorar si falla, el listener reintentará */ });
            await fetchWorkspaces();
            selectWorkspace({
                id: String(data.id),
                name: data.name ?? newWorkspaceName,
                ownerId: data.ownerId ?? user.uid,
                members: Array.isArray(data.members) ? data.members : [user.uid],
                type: WorkspaceType.Shared
            });
        } catch (e) {
            console.error('Error creating workspace', e);
        }
    };

    const renameWorkspace = async (workspace: Workspace) => {
        if (!user) return;
        if (workspace.id === PERSONAL_WORKSPACE_ID || workspace.type === WorkspaceType.Personal) {
            await showDialog({ type: DialogKind.Info, title: 'No se puede renombrar', message: 'El espacio personal no se puede renombrar.' });
            return;
        }

        const isOwner = !workspace.ownerId || workspace.ownerId === user.uid;
        if (!isOwner && !isAdmin) {
            await showDialog({ type: DialogKind.Error, title: 'Sin permisos', message: 'Solo el administrador o el propietario pueden renombrar este espacio.' });
            return;
        }

        setShowWorkspaceMenu(false);

        const result = await showDialog({
            type: DialogKind.Input,
            title: 'Renombrar espacio',
            message: 'Ingresa el nuevo nombre del espacio.',
            defaultValue: workspace.name,
            placeholder: 'Nombre del espacio'
        });

        if (!result.confirmed) return;
        const nextName = (result.value ?? '').trim();
        if (!nextName || nextName === workspace.name.trim()) return;

        try {
            await renameWorkspaceApi({ workspaceId: workspace.id, name: nextName });
            if (currentWorkspace?.id === workspace.id) {
                selectWorkspace({ ...workspace, name: nextName });
            }
            await fetchWorkspaces();
            await showDialog({ type: DialogKind.Info, title: 'Espacio renombrado', message: nextName });
        } catch (error) {
            console.error('Error renaming workspace', error);
            await showDialog({ type: DialogKind.Error, title: 'Error al renombrar', message: workspace.name });
        }
    };

    const duplicateWorkspace = async (workspace: Workspace) => {
        if (!user) return;
        if (workspace.id === PERSONAL_WORKSPACE_ID || workspace.type === WorkspaceType.Personal) {
            await showDialog({ type: DialogKind.Info, title: 'No disponible', message: 'El espacio personal no se puede duplicar desde este menú.' });
            return;
        }

        const isOwner = !workspace.ownerId || workspace.ownerId === user.uid;
        if (!isOwner && !isAdmin) {
            await showDialog({ type: DialogKind.Error, title: 'Sin permisos', message: 'Solo el administrador o el propietario pueden duplicar este espacio.' });
            return;
        }

        setShowWorkspaceMenu(false);

        const result = await showDialog({
            type: DialogKind.Input,
            title: 'Duplicar espacio',
            message: 'Ingresa el nombre del nuevo espacio duplicado.',
            defaultValue: `${workspace.name} (copia)`,
            placeholder: 'Nombre del nuevo espacio'
        });

        if (!result.confirmed) return;
        const nextName = (result.value ?? '').trim();
        if (!nextName) return;

        try {
            const duplicated = await duplicateWorkspaceApi({ workspaceId: workspace.id, name: nextName });
            await fetchWorkspaces();
            selectWorkspace(duplicated.workspace);
            setShowWorkspaceMenu(false);
            await showDialog({
                type: DialogKind.Info,
                title: 'Espacio duplicado',
                message: `${duplicated.workspace.name} | Documentos: ${duplicated.documentsCreated}`
            });
        } catch (error) {
            console.error('Error duplicating workspace', error);
            await showDialog({ type: DialogKind.Error, title: 'Error al duplicar', message: workspace.name });
        }
    };

    const mergeWorkspaceIntoCurrent = async (sourceWorkspace: Workspace) => {
        if (!user || !currentWorkspace) return;
        if (currentWorkspace.id === PERSONAL_WORKSPACE_ID || currentWorkspace.type === WorkspaceType.Personal) {
            await showDialog({ type: DialogKind.Info, title: 'Destino no valido', message: 'Selecciona primero un workspace colaborativo como destino.' });
            return;
        }
        if (sourceWorkspace.id === currentWorkspace.id) {
            await showDialog({ type: DialogKind.Info, title: 'No se puede fusionar', message: 'El origen y el destino son el mismo espacio.' });
            return;
        }

        const canManageSource = (!sourceWorkspace.ownerId || sourceWorkspace.ownerId === user.uid) || isAdmin;
        const canManageCurrent = (!currentWorkspace.ownerId || currentWorkspace.ownerId === user.uid) || isAdmin;

        if (!canManageSource || !canManageCurrent) {
            await showDialog({
                type: DialogKind.Error,
                title: 'Sin permisos',
                message: 'Necesitas permisos sobre el workspace origen y el destino para fusionarlos.'
            });
            return;
        }

        setShowWorkspaceMenu(false);

        const confirmResult = await showDialog({
            type: DialogKind.Confirm,
            title: 'Fusionar workspaces',
            message: `Se copiara el contenido de "${sourceWorkspace.name}" dentro de "${currentWorkspace.name}". Los nombres repetidos se ajustaran automaticamente.`,
            confirmLabel: 'Fusionar',
            cancelLabel: 'Cancelar'
        });
        if (!confirmResult.confirmed) return;

        try {
            const merged = await mergeWorkspaceApi({
                targetWorkspaceId: currentWorkspace.id,
                sourceWorkspaceId: sourceWorkspace.id
            });
            await requestDocsRefresh({ force: true, showLoading: true, delayMs: 0 });
            await showDialog({
                type: DialogKind.Info,
                title: 'Workspaces fusionados',
                message: [
                    `Documentos copiados: ${merged.documentsCreated}`,
                    `Carpetas existentes omitidas: ${merged.skippedFolders}`,
                    `Columnas del tablero: ${merged.boardColumnsCreated}`,
                    `Tarjetas del tablero: ${merged.boardCardsCreated}`
                ].join(' | ')
            });
        } catch (error) {
            console.error('Error merging workspace', error);
            await showDialog({ type: DialogKind.Error, title: 'Error al fusionar', message: sourceWorkspace.name });
        }
    };

    const deleteWorkspace = async (workspace: Workspace) => {
        if (!user) return;
        if (workspace.id === PERSONAL_WORKSPACE_ID || workspace.type === WorkspaceType.Personal) {
            await showDialog({ type: DialogKind.Info, title: 'No se puede eliminar', message: 'El espacio personal no se puede borrar.' });
            return;
        }
        const isOwner = !workspace.ownerId || workspace.ownerId === user.uid;
        if (!isOwner && !isAdmin) {
            await showDialog({ type: DialogKind.Error, title: 'Sin permisos', message: 'Solo el administrador o el propietario pueden eliminar este espacio.' });
            return;
        }

        setShowWorkspaceMenu(false);
        const confirmResult = await showDialog({
            type: DialogKind.Input,
            title: 'Eliminar espacio de trabajo',
            message: `Escribe "${workspace.name}" para confirmar. Esta acción eliminará documentos, archivos, tablero, miembros e invitaciones asociadas.`,
            placeholder: workspace.name,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        const typedName = (confirmResult.value ?? '').trim();
        if (typedName !== workspace.name.trim()) {
            await showDialog({ type: DialogKind.Error, title: 'Nombre incorrecto', message: 'El nombre no coincide.' });
            return;
        }

        try {
            setDeletingWorkspaceId(workspace.id);
            await deleteWorkspaceApi({ workspaceId: workspace.id, ownerId: user.uid });
            clearDashboardState(workspace.id);
            setClosedFilesTabByWorkspace(prev => {
                if (!prev[workspace.id]) return prev;
                const next = { ...prev };
                delete next[workspace.id];
                return next;
            });
            if (currentWorkspace?.id === workspace.id) {
                const personalSpace: Workspace = {
                    id: PERSONAL_WORKSPACE_ID,
                    name: 'Espacio Personal',
                    ownerId: user.uid,
                    members: [user.uid],
                    type: WorkspaceType.Personal
                };
                selectWorkspace(personalSpace);
                setDocs([]);
                setFolders([]);
                setOpenTabs([]);
                setMosaicNode(null);
                setSelectedDocId(null);
                setActiveFolderSafe(ROOT_FOLDER_PATH);
            }
            await fetchWorkspaces();
            setShowMembersModal(false);
            await showDialog({ type: DialogKind.Info, title: 'Espacio eliminado', message: workspace.name });
        } catch (e) {
            console.error('Error deleting workspace', e);
            await showDialog({ type: DialogKind.Error, title: 'Error al eliminar', message: workspace.name });
        } finally {
            setDeletingWorkspaceId(null);
        }
    };

    const inviteMember = async () => {
        if (!inviteEmail || !currentWorkspace || currentWorkspace.type === WorkspaceType.Personal) return;
        const emailToInvite = inviteEmail.trim();
        if (!emailToInvite) return;
        try {
            await inviteMemberApi({ workspaceId: currentWorkspace.id, email: emailToInvite });
            setInviteEmail('');
            setShowMembersModal(false);
            await showDialog({
                type: DialogKind.Info,
                title: 'Invitación enviada',
                message: `Se ha enviado una invitación a "${emailToInvite}". Cuando el usuario acepte, aparecerá como miembro del espacio.`
            });
        } catch (e) {
            console.error('Error inviting', e);
            await showDialog({ type: DialogKind.Error, title: 'Error al invitar', message: 'No se pudo enviar la invitación. Intenta de nuevo.' });
        }
    };

    const removeMember = async (userId: string) => {
        if (!currentWorkspace || currentWorkspace.type === WorkspaceType.Personal) return;
        try {
            const confirmResult = await showDialog({
                type: DialogKind.Confirm,
                title: 'Eliminar miembro',
                message: '¿Estás seguro de que quieres eliminar a este miembro del espacio de trabajo?',
                confirmLabel: 'Eliminar',
                cancelLabel: 'Cancelar',
                danger: true
            });
            if (!confirmResult.confirmed) return;

            await removeMemberApi({ workspaceId: currentWorkspace.id, userId });

            const updatedMembers = currentWorkspace.members.filter(m => m !== userId);
            const updatedWorkspace = { ...currentWorkspace, members: updatedMembers };
            selectWorkspace(updatedWorkspace);

            await showDialog({ type: DialogKind.Info, title: 'Miembro eliminado', message: 'El usuario ha sido eliminado del espacio de trabajo.' });
        } catch (e) {
            console.error('Error removing member', e);
            await showDialog({ type: DialogKind.Error, title: 'Error', message: 'No se pudo eliminar al miembro.' });
        }
    };

    return {
        createWorkspace,
        renameWorkspace,
        duplicateWorkspace,
        mergeWorkspaceIntoCurrent,
        deleteWorkspace,
        inviteMember,
        removeMember
    };
}
