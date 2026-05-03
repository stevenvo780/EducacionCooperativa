'use client';

import { useCallback, useEffect } from 'react';
import type { MosaicNode } from 'react-mosaic-component';
import type { User } from 'firebase/auth';
import { canAccessTerminals, type PlanId } from '@/types/subscription';
import { WorkspaceType, PERSONAL_WORKSPACE_ID, type WorkspaceTypeId } from '@/types/workspace';
import type { TerminalSession } from '@/context/TerminalContext';
import type { DocItem, Workspace } from '@/components/dashboard/types';

/**
 * Las terminales viven exclusivamente en el BottomDock estilo VS Code.
 * Nunca abren un tile en el grid del editor: este hook solo selecciona la
 * sesion activa y pide al dashboard que abra el dock. Si vienen
 * pestañas `type=terminal` de versiones anteriores en el state persistido,
 * se eliminan al montar para evitar incongruencias.
 */
interface UseTerminalTabsOptions {
    currentPlan: PlanId;
    setShowPricingModal: (value: boolean) => void;
    openTabs: DocItem[];
    setOpenTabs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    setMosaicNode: React.Dispatch<React.SetStateAction<MosaicNode<string> | null>>;
    setSelectedDocId: (id: string | null) => void;
    setShowMobileSidebar: (value: boolean) => void;
    selectSession: (id: string) => void;
    user: User | null;
    currentWorkspace: Workspace | null;
    createSession: (workspaceId: string, workspaceType: WorkspaceTypeId, workspaceName?: string) => void;
    getSessionsForWorkspace: (workerToken: string) => TerminalSession[];
    onOpenDock: () => void;
}

interface UseTerminalTabsResult {
    openTerminal: (session?: { id: string; name?: string }) => Promise<void>;
    handleRequestNewTerminal: () => void;
}

function withoutTerminalTiles(
    openTabs: DocItem[],
    mosaicNode: MosaicNode<string> | null
): { tabs: DocItem[]; node: MosaicNode<string> | null } {
    const terminalIds = new Set(openTabs.filter((t) => t.type === 'terminal').map((t) => t.id));
    if (terminalIds.size === 0) return { tabs: openTabs, node: mosaicNode };

    const tabs = openTabs.filter((t) => !terminalIds.has(t.id));

    const stripNode = (node: MosaicNode<string> | null): MosaicNode<string> | null => {
        if (!node) return null;
        if (typeof node === 'string') return terminalIds.has(node) ? null : node;
        const first = stripNode(node.first);
        const second = stripNode(node.second);
        if (first && second) return { ...node, first, second };
        return first || second;
    };

    return { tabs, node: stripNode(mosaicNode) };
}

export function useTerminalTabs({
    currentPlan,
    setShowPricingModal,
    openTabs,
    setOpenTabs,
    setMosaicNode,
    setSelectedDocId,
    setShowMobileSidebar,
    selectSession,
    user,
    currentWorkspace,
    createSession,
    getSessionsForWorkspace,
    onOpenDock
}: UseTerminalTabsOptions): UseTerminalTabsResult {

    // Cleanup: eliminar tiles 'terminal' que vinieran del state persistido
    // pre-rediseño. Corre cuando openTabs cambia y detecta cualquiera.
    useEffect(() => {
        const hasTerminalTabs = openTabs.some((t) => t.type === 'terminal');
        if (!hasTerminalTabs) return;
        setOpenTabs((prev) => withoutTerminalTiles(prev, null).tabs);
        setMosaicNode((prev) => withoutTerminalTiles(openTabs, prev).node);
        setSelectedDocId(null);
    }, [openTabs, setOpenTabs, setMosaicNode, setSelectedDocId]);

    const openTerminal = async (session?: { id: string; name?: string }) => {
        if (!canAccessTerminals(currentPlan)) {
            setShowPricingModal(true);
            return;
        }
        if (session?.id) selectSession(session.id);
        onOpenDock();
        setShowMobileSidebar(false);
    };

    const handleRequestNewTerminal = useCallback(() => {
        if (!currentWorkspace || !user) return;
        const workerToken = currentWorkspace.type === WorkspaceType.Personal || currentWorkspace.id === PERSONAL_WORKSPACE_ID
            ? `${PERSONAL_WORKSPACE_ID}:${user.uid}`
            : currentWorkspace.id;
        const workspaceSessions = getSessionsForWorkspace(workerToken);
        createSession(workerToken, currentWorkspace.type, `Terminal ${workspaceSessions.length + 1}`);
        onOpenDock();
    }, [currentWorkspace, user, createSession, getSessionsForWorkspace, onOpenDock]);

    return {
        openTerminal,
        handleRequestNewTerminal
    };
}
