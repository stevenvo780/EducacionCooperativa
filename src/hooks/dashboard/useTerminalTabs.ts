'use client';

import { useCallback, useEffect } from 'react';
import type { MosaicNode } from 'react-mosaic-component';
import type { User } from 'firebase/auth';
import { canAccessTerminals, type Plan } from '@/types/subscription';
import { WorkspaceType, PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import type { TerminalSession } from '@/context/TerminalContext';
import type { DocItem, Workspace } from '@/components/dashboard/types';

interface UseTerminalTabsOptions {
    currentPlan: Plan;
    setShowPricingModal: (value: boolean) => void;
    openTabs: DocItem[];
    setOpenTabs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    setMosaicNode: React.Dispatch<React.SetStateAction<MosaicNode<string> | null>>;
    setSelectedDocId: (id: string | null) => void;
    setShowMobileSidebar: (value: boolean) => void;
    selectSession: (id: string) => void;
    activeSessionId: string | null | undefined;
    terminalSessions: TerminalSession[];
    user: User | null;
    currentWorkspace: Workspace | null;
    createSession: (workerToken: string, workspaceType: string, name: string) => void;
    getSessionsForWorkspace: (workerToken: string) => TerminalSession[];
}

interface UseTerminalTabsResult {
    openTerminal: (session?: { id: string; name?: string }) => Promise<void>;
    handleRequestNewTerminal: () => void;
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
    activeSessionId,
    terminalSessions,
    user,
    currentWorkspace,
    createSession,
    getSessionsForWorkspace
}: UseTerminalTabsOptions): UseTerminalTabsResult {

    const openTerminal = async (session?: { id: string; name?: string }) => {
        if (!canAccessTerminals(currentPlan)) {
            setShowPricingModal(true);
            return;
        }
        const terminalId = session ? `terminal-${session.id}` : 'terminal-main';
        const terminalName = session?.name || 'Mi Asistente';

        if (session?.id) {
            const existingTab = openTabs.find(t => t.type === 'terminal' && t.sessionId === session.id);
            if (existingTab) {
                selectSession(session.id);
                setSelectedDocId(existingTab.id);
                setShowMobileSidebar(false);
                return;
            }
            const mainTab = openTabs.find(t => t.id === 'terminal-main');
            if (mainTab) {
                selectSession(session.id);
                setOpenTabs(prev => prev.map(t =>
                    t.id === 'terminal-main'
                        ? { ...t, id: terminalId, name: terminalName, sessionId: session.id }
                        : t
                ));
                const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
                setMosaicNode(current => {
                    const leaves = getLeaves(current).map(l => l === 'terminal-main' ? terminalId : l);
                    return createBalancedTreeFromLeaves(leaves);
                });
                setSelectedDocId(terminalId);
                setShowMobileSidebar(false);
                return;
            }
        } else {
            const anyTerminal = openTabs.find(t => t.type === 'terminal');
            if (anyTerminal) {
                setSelectedDocId(anyTerminal.id);
                setShowMobileSidebar(false);
                return;
            }
        }
        if (openTabs.find(t => t.id === terminalId)) {
            if (session?.id) selectSession(session.id);
            setSelectedDocId(terminalId);
            setShowMobileSidebar(false);
            return;
        }

        const newTerminalItem: DocItem = {
            id: terminalId,
            name: terminalName,
            type: 'terminal',
            sessionId: session?.id,
            updatedAt: new Date(),
            ownerId: user?.uid || 'system'
        };

        setOpenTabs(prev => [...prev, newTerminalItem]);
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(terminalId)) return current;
            return createBalancedTreeFromLeaves([...leaves, terminalId]);
        });
        if (session?.id) {
            selectSession(session.id);
        }
        setShowMobileSidebar(false);
        setSelectedDocId(terminalId);
    };

    // Auto-replace terminal-main with the session-specific tab, or open a new tab if created from an existing terminal
    useEffect(() => {
        if (!activeSessionId) return;
        const session = terminalSessions.find(s => s.id === activeSessionId);
        const terminalId = `terminal-${activeSessionId}`;
        const terminalName = session?.name || `Terminal ${activeSessionId.slice(-4)}`;

        if (openTabs.find(t => t.id === terminalId)) return;

        const mainTab = openTabs.find(t => t.id === 'terminal-main' && t.type === 'terminal');
        if (mainTab) {
            setOpenTabs(prev => prev.map(t =>
                t.id === 'terminal-main'
                    ? { ...t, id: terminalId, name: terminalName, sessionId: activeSessionId }
                    : t
            ));
            setMosaicNode(current => {
                if (!current) return current;
                const replaceMosaicId = (node: MosaicNode<string>): MosaicNode<string> => {
                    if (typeof node === 'string') return node === 'terminal-main' ? terminalId : node;
                    return { ...node, first: replaceMosaicId(node.first), second: replaceMosaicId(node.second) };
                };
                return replaceMosaicId(current);
            });
            setSelectedDocId(terminalId);
        } else {
            const newTerminalItem: DocItem = {
                id: terminalId,
                name: terminalName,
                type: 'terminal',
                sessionId: activeSessionId,
                updatedAt: new Date(),
                ownerId: user?.uid || 'system'
            };
            setOpenTabs(prev => [...prev, newTerminalItem]);
            import('react-mosaic-component').then(({ getLeaves, createBalancedTreeFromLeaves }) => {
                setMosaicNode(current => {
                    const leaves = getLeaves(current);
                    if (leaves.includes(terminalId)) return current;
                    return createBalancedTreeFromLeaves([...leaves, terminalId]);
                });
            });
            selectSession(activeSessionId);
            setSelectedDocId(terminalId);
        }
    }, [activeSessionId, terminalSessions, openTabs, selectSession, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRequestNewTerminal = useCallback(() => {
        if (!currentWorkspace || !user) return;
        const workerToken = currentWorkspace.type === WorkspaceType.Personal || currentWorkspace.id === PERSONAL_WORKSPACE_ID
            ? `${PERSONAL_WORKSPACE_ID}:${user.uid}`
            : currentWorkspace.id;
        const workspaceSessions = getSessionsForWorkspace(workerToken);
        createSession(workerToken, currentWorkspace.type, `Terminal ${workspaceSessions.length + 1}`);
    }, [currentWorkspace, user, createSession, getSessionsForWorkspace]);

    return {
        openTerminal,
        handleRequestNewTerminal
    };
}
