'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import type { MosaicNode } from 'react-mosaic-component';
import {
    createWorkspaceApi,
    deleteWorkspaceApi,
    inviteMemberApi,
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
    showDialog: (config: DialogConfig) => Promise<DialogResult>;
    inviteEmail: string;
    setInviteEmail: (email: string) => void;
}

interface UseWorkspaceActionsResult {
    createWorkspace: () => Promise<void>;
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
        deleteWorkspace,
        inviteMember,
        removeMember
    };
}
