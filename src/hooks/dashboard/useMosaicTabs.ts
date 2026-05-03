'use client';

import { useCallback } from 'react';
import type { MosaicNode } from 'react-mosaic-component';
import type { User } from 'firebase/auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import type { DocItem, Workspace } from '@/components/dashboard/types';
import type { TerminalSession } from '@/context/TerminalContext';

interface UseMosaicTabsOptions {
    currentWorkspace: Workspace | null;
    user: User | null;
    openTabs: DocItem[];
    setOpenTabs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    setMosaicNode: React.Dispatch<React.SetStateAction<MosaicNode<string> | null>>;
    selectedDocId: string | null;
    setSelectedDocId: (id: string | null) => void;
    setShowMobileSidebar: (value: boolean) => void;
    setClosedFilesTabByWorkspace: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    docs: DocItem[];
    terminalSessions: TerminalSession[];
    clearActiveSession: () => void;
    setActiveFolderSafe: (path: string) => void;
}

interface UseMosaicTabsResult {
    openBoard: () => Promise<void>;
    openStRunner: () => Promise<void>;
    openSemanticBrowser: () => Promise<void>;
    openFormalizer: () => Promise<void>;
    openAgoraAI: () => Promise<void>;
    openFilesTab: () => Promise<void>;
    openSnippetsGallery: () => Promise<void>;
    closeTabById: (docId: string) => Promise<void>;
    openDocument: (doc: DocItem) => Promise<void>;
    openDocumentInTile: (doc: DocItem, targetTileId?: string | null) => Promise<void>;
    handleDropDocOnTile: (droppedDocId: string, targetTileId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'replace') => Promise<void>;
    handleDropDocOnEmpty: (droppedDocId: string) => Promise<void>;
}

export function useMosaicTabs({
    currentWorkspace,
    user,
    openTabs,
    setOpenTabs,
    setMosaicNode,
    selectedDocId,
    setSelectedDocId,
    setShowMobileSidebar,
    setClosedFilesTabByWorkspace,
    docs,
    terminalSessions,
    clearActiveSession,
    setActiveFolderSafe
}: UseMosaicTabsOptions): UseMosaicTabsResult {

    const openBoard = useCallback(async () => {
        if (!currentWorkspace || !user) return;
        const boardId = `board-${currentWorkspace.id}`;
        if (openTabs.find(tab => tab.id === boardId)) {
            setSelectedDocId(boardId);
            setShowMobileSidebar(false);
            return;
        }
        const newBoardItem: DocItem = {
            id: boardId,
            name: 'Tablero',
            type: 'board',
            workspaceId: currentWorkspace.id,
            ownerId: user.uid,
            updatedAt: new Date()
        };
        setOpenTabs(prev => [...prev, newBoardItem]);
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(boardId)) return current;
            return createBalancedTreeFromLeaves([...leaves, boardId]);
        });
        setShowMobileSidebar(false);
        setSelectedDocId(boardId);
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]); // eslint-disable-line react-hooks/exhaustive-deps

    const openStRunner = useCallback(async () => {
        if (!currentWorkspace || !user) return;
        const stId = `st-runner-${currentWorkspace.id}`;
        if (openTabs.find(tab => tab.id === stId)) {
            setSelectedDocId(stId);
            setShowMobileSidebar(false);
            return;
        }
        const newStItem: DocItem = {
            id: stId,
            name: 'ST Logic',
            type: 'st-runner',
            workspaceId: currentWorkspace.id,
            ownerId: user.uid,
            updatedAt: new Date()
        };
        setOpenTabs(prev => [...prev, newStItem]);
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(stId)) return current;
            return createBalancedTreeFromLeaves([...leaves, stId]);
        });
        setShowMobileSidebar(false);
        setSelectedDocId(stId);
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]); // eslint-disable-line react-hooks/exhaustive-deps

    const openSemanticBrowser = useCallback(async () => {
        if (!currentWorkspace || !user) return;
        const semId = `semantic-browser-${currentWorkspace.id}`;
        if (openTabs.find(tab => tab.id === semId)) {
            setSelectedDocId(semId);
            setShowMobileSidebar(false);
            return;
        }
        const newSemItem: DocItem = {
            id: semId,
            name: 'Mesa Semántica',
            type: 'semantic-browser',
            workspaceId: currentWorkspace.id,
            ownerId: user.uid,
            updatedAt: new Date()
        };
        setOpenTabs(prev => [...prev, newSemItem]);
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(semId)) return current;
            return createBalancedTreeFromLeaves([...leaves, semId]);
        });
        setShowMobileSidebar(false);
        setSelectedDocId(semId);
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]); // eslint-disable-line react-hooks/exhaustive-deps

    const openFormalizer = useCallback(async () => {
        if (!currentWorkspace || !user) return;
        const formalId = `formalizer-${currentWorkspace.id}`;
        if (openTabs.find(tab => tab.id === formalId)) {
            setSelectedDocId(formalId);
            setShowMobileSidebar(false);
            return;
        }
        const newItem: DocItem = {
            id: formalId,
            name: 'Formalizador',
            type: 'formalizer',
            workspaceId: currentWorkspace.id,
            ownerId: user.uid,
            updatedAt: new Date()
        };
        setOpenTabs(prev => [...prev, newItem]);
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(formalId)) return current;
            return createBalancedTreeFromLeaves([...leaves, formalId]);
        });
        setShowMobileSidebar(false);
        setSelectedDocId(formalId);
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]); // eslint-disable-line react-hooks/exhaustive-deps

    const closeTabById = useCallback(async (docId: string) => {
        if (currentWorkspace && docId === `files-${currentWorkspace.id}`) {
            setClosedFilesTabByWorkspace(prev => ({ ...prev, [currentWorkspace.id]: true }));
        }
        // Limpia los diagnostics asociados al doc cerrado en todas las
        // fuentes conocidas (markdown-linter, st-linter, etc.) — evita
        // que el panel "Problemas" muestre items huerfanos.
        void import('@/lib/diagnostics-bus').then((m) => {
            m.clearDiagnosticsFor('markdown-linter', docId);
            m.clearDiagnosticsFor('st-linter', docId);
        });
        setOpenTabs(prev => {
            const tabToClose = prev.find(t => t.id === docId);
            if (tabToClose?.type === 'terminal' && tabToClose.sessionId) {
                clearActiveSession();
            }
            const next = prev.filter(t => t.id !== docId);
            if (selectedDocId === docId) {
                setSelectedDocId(next[next.length - 1]?.id ?? null);
            }
            return next;
        });
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            if (!current) return null;
            const leaves = getLeaves(current);
            const newLeaves = leaves.filter(leaf => leaf !== docId);
            if (newLeaves.length === 0) return null;
            return createBalancedTreeFromLeaves(newLeaves);
        });
    }, [selectedDocId, currentWorkspace, clearActiveSession]); // eslint-disable-line react-hooks/exhaustive-deps

    const replaceLeafId = useCallback((node: MosaicNode<string>, fromId: string, toId: string): MosaicNode<string> => {
        if (typeof node === 'string') {
            return node === fromId ? toId : node;
        }
        return {
            ...node,
            first: replaceLeafId(node.first, fromId, toId),
            second: replaceLeafId(node.second, fromId, toId)
        };
    }, []);

    const removeLeafId = useCallback((node: MosaicNode<string>, leafId: string): MosaicNode<string> | null => {
        if (typeof node === 'string') {
            return node === leafId ? null : node;
        }
        const first = removeLeafId(node.first, leafId);
        const second = removeLeafId(node.second, leafId);
        if (!first && !second) return null;
        if (!first) return second;
        if (!second) return first;
        return { ...node, first, second };
    }, []);

    const splitLeafInTree = useCallback((
        node: MosaicNode<string>,
        targetId: string,
        newId: string,
        position: 'left' | 'right' | 'top' | 'bottom'
    ): MosaicNode<string> => {
        if (typeof node === 'string') {
            if (node !== targetId) return node;
            const direction = (position === 'left' || position === 'right') ? 'row' : 'column';
            const first = (position === 'left' || position === 'top') ? newId : targetId;
            const second = (position === 'left' || position === 'top') ? targetId : newId;
            return { direction, first, second, splitPercentage: 50 };
        }
        return {
            ...node,
            first: splitLeafInTree(node.first, targetId, newId, position),
            second: splitLeafInTree(node.second, targetId, newId, position)
        };
    }, []);

    const resolveDraggableDoc = useCallback((docId: string): DocItem | null => {
        const fromDocs = docs.find(d => d.id === docId);
        if (fromDocs) return fromDocs;
        const fromTabs = openTabs.find(tab => tab.id === docId);
        if (fromTabs) return fromTabs;
        if (docId.startsWith('terminal-')) {
            const sessionId = docId.slice('terminal-'.length);
            const session = terminalSessions.find(item => item.id === sessionId);
            if (!session) return null;
            return {
                id: docId,
                name: session.name || `Terminal ${sessionId.slice(-4)}`,
                type: 'terminal',
                sessionId,
                updatedAt: new Date(),
                ownerId: user?.uid || 'system'
            };
        }
        // Resolve special panel IDs dragged from the navbar
        const wsId = currentWorkspace?.id;
        const uid = user?.uid || 'system';
        if (wsId) {
            const specialPanels: Array<{ prefix: string; name: string; type: string }> = [
                { prefix: 'board-', name: 'Tablero', type: 'board' },
                { prefix: 'st-runner-', name: 'ST Logic', type: 'st-runner' },
                { prefix: 'semantic-browser-', name: 'Mesa Semántica', type: 'semantic-browser' },
                { prefix: 'formalizer-', name: 'Formalizador', type: 'formalizer' },
                { prefix: 'agora-ai-', name: 'Agora AI', type: 'agora-ai' },
                { prefix: 'snippets-gallery-', name: 'Galería de Snippets', type: 'snippets-gallery' },
                { prefix: 'files-', name: 'Archivos', type: 'files' }
            ];
            for (const panel of specialPanels) {
                if (docId === `${panel.prefix}${wsId}`) {
                    return {
                        id: docId,
                        name: panel.name,
                        type: panel.type as DocItem['type'],
                        workspaceId: wsId,
                        ownerId: uid,
                        updatedAt: new Date()
                    };
                }
            }
        }
        return null;
    }, [docs, openTabs, terminalSessions, user?.uid, currentWorkspace?.id]);

    const openDocumentInTile = useCallback(async (doc: DocItem, requestedTargetTileId?: string | null) => {
        if (doc.type === 'folder') return;
        setActiveFolderSafe(normalizeFolderPath(doc.folder));

        const targetTileId = requestedTargetTileId && openTabs.some(tab => tab.id === requestedTargetTileId)
            ? requestedTargetTileId
            : null;

        const existingTab = openTabs.find(tab => tab.id === doc.id);
        if (existingTab && !targetTileId) {
            setShowMobileSidebar(false);
            setSelectedDocId(doc.id);
            return;
        }

        const selectedTab = targetTileId
            ? openTabs.find(tab => tab.id === targetTileId)
            : selectedDocId
                ? openTabs.find(tab => tab.id === selectedDocId)
                : undefined;
        const replaceTargetId = selectedTab && selectedTab.type !== 'files' ? selectedTab.id : null;

        if (replaceTargetId && replaceTargetId !== doc.id) {
            if (selectedTab?.type === 'terminal' && selectedTab.sessionId) {
                clearActiveSession();
            }

            if (existingTab) {
                setOpenTabs(prev => prev.filter(tab => tab.id !== replaceTargetId));
                setMosaicNode(current => {
                    if (!current) return doc.id;
                    const withoutExisting = removeLeafId(current, doc.id);
                    if (!withoutExisting) return doc.id;
                    return replaceLeafId(withoutExisting, replaceTargetId, doc.id);
                });
                setShowMobileSidebar(false);
                setSelectedDocId(doc.id);
                return;
            }

            setOpenTabs(prev => {
                const next = prev.filter(tab => tab.id !== replaceTargetId && tab.id !== doc.id);
                return [...next, doc];
            });

            setMosaicNode(current => {
                if (!current) return doc.id;
                return replaceLeafId(current, replaceTargetId, doc.id);
            });
            setShowMobileSidebar(false);
            setSelectedDocId(doc.id);
            return;
        }

        setOpenTabs(prev => {
            return [...prev, doc];
        });

        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(doc.id)) return current;
            return createBalancedTreeFromLeaves([...leaves, doc.id]);
        });
        setShowMobileSidebar(false);
        setSelectedDocId(doc.id);
    }, [clearActiveSession, openTabs, removeLeafId, replaceLeafId, selectedDocId, setShowMobileSidebar, setActiveFolderSafe]); // eslint-disable-line react-hooks/exhaustive-deps

    const openDocument = useCallback(async (doc: DocItem) => {
        await openDocumentInTile(doc, null);
    }, [openDocumentInTile]);

    const handleDropDocOnTile = useCallback(async (droppedDocId: string, targetTileId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'replace') => {
        if (droppedDocId === targetTileId) return;
        const droppedDoc = resolveDraggableDoc(droppedDocId);
        if (!droppedDoc || droppedDoc.type === 'folder') return;

        const targetTab = openTabs.find(t => t.id === targetTileId);
        const isAlreadyOpen = openTabs.some(t => t.id === droppedDocId);

        if (!isAlreadyOpen) {
            setOpenTabs(prev => [...prev.filter(t => t.id !== droppedDocId), droppedDoc]);
        }

        if (position === 'replace') {
            if (targetTab?.type === 'terminal' && targetTab.sessionId) {
                clearActiveSession();
            }
            if (isAlreadyOpen) {
                setMosaicNode(current => {
                    if (!current) return droppedDocId;
                    const temp = `__swap_temp_${Date.now()}`;
                    let swapped = replaceLeafId(current, droppedDocId, temp);
                    swapped = replaceLeafId(swapped, targetTileId, droppedDocId);
                    swapped = replaceLeafId(swapped, temp, targetTileId);
                    return swapped;
                });
            } else {
                setOpenTabs(prev => prev.filter(t => t.id !== targetTileId));
                setMosaicNode(current => {
                    if (!current) return droppedDocId;
                    return replaceLeafId(current, targetTileId, droppedDocId);
                });
            }
        } else {
            if (isAlreadyOpen) {
                setMosaicNode(current => {
                    if (!current) return droppedDocId;
                    const removeLeaf = (node: MosaicNode<string>, leafId: string): MosaicNode<string> | null => {
                        if (typeof node === 'string') {
                            return node === leafId ? null : node;
                        }
                        const first = removeLeaf(node.first, leafId);
                        const second = removeLeaf(node.second, leafId);
                        if (!first && !second) return null;
                        if (!first) return second;
                        if (!second) return first;
                        return { ...node, first, second };
                    };
                    const cleaned = removeLeaf(current, droppedDocId);
                    if (!cleaned) return droppedDocId;
                    return splitLeafInTree(cleaned, targetTileId, droppedDocId, position);
                });
            } else {
                setMosaicNode(current => {
                    if (!current) return droppedDocId;
                    return splitLeafInTree(current, targetTileId, droppedDocId, position);
                });
            }
        }

        setSelectedDocId(droppedDocId);
    }, [openTabs, clearActiveSession, replaceLeafId, resolveDraggableDoc, splitLeafInTree]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDropDocOnEmpty = useCallback(async (droppedDocId: string) => {
        const droppedDoc = resolveDraggableDoc(droppedDocId);
        if (!droppedDoc || droppedDoc.type === 'folder') return;
        const isAlreadyOpen = openTabs.some(t => t.id === droppedDocId);
        if (!isAlreadyOpen) {
            setOpenTabs(prev => [...prev, droppedDoc]);
        }
        setMosaicNode(droppedDocId);
        setSelectedDocId(droppedDocId);
        setShowMobileSidebar(false);
    }, [openTabs, resolveDraggableDoc, setShowMobileSidebar]); // eslint-disable-line react-hooks/exhaustive-deps

    const openFilesTab = useCallback(async () => {
        if (!currentWorkspace || !user) return;
        const filesTabId = `files-${currentWorkspace.id}`;
        const newFilesItem: DocItem = {
            id: filesTabId,
            name: 'Archivos',
            type: 'files',
            updatedAt: new Date(),
            ownerId: user.uid
        };

        setClosedFilesTabByWorkspace(prev => ({ ...prev, [currentWorkspace.id]: false }));

        setOpenTabs(prev => prev.some(tab => tab.id === filesTabId) ? prev : [...prev, newFilesItem]);

        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(filesTabId)) return current;
            return createBalancedTreeFromLeaves([...leaves, filesTabId]);
        });

        setSelectedDocId(filesTabId);
        setShowMobileSidebar(false);
    }, [currentWorkspace, setShowMobileSidebar, user]); // eslint-disable-line react-hooks/exhaustive-deps

    const openAgoraAI = useCallback(async () => {
        if (!currentWorkspace || !user) return;
        const aiId = `agora-ai-${currentWorkspace.id}`;
        if (openTabs.find(tab => tab.id === aiId)) {
            setSelectedDocId(aiId);
            setShowMobileSidebar(false);
            return;
        }
        const newAIItem: DocItem = {
            id: aiId,
            name: 'Agora AI',
            type: 'agora-ai',
            workspaceId: currentWorkspace.id,
            ownerId: user.uid,
            updatedAt: new Date()
        };
        setOpenTabs(prev => [...prev, newAIItem]);
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(aiId)) return current;
            return createBalancedTreeFromLeaves([...leaves, aiId]);
        });
        setShowMobileSidebar(false);
        setSelectedDocId(aiId);
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]); // eslint-disable-line react-hooks/exhaustive-deps

    const openSnippetsGallery = useCallback(async () => {
        if (!currentWorkspace || !user) return;
        const snipId = `snippets-gallery-${currentWorkspace.id}`;
        if (openTabs.find(tab => tab.id === snipId)) {
            setSelectedDocId(snipId);
            setShowMobileSidebar(false);
            return;
        }
        const newSnipItem: DocItem = {
            id: snipId,
            name: 'Galería de Snippets',
            type: 'snippets-gallery' as DocItem['type'],
            workspaceId: currentWorkspace.id,
            ownerId: user.uid,
            updatedAt: new Date()
        };
        setOpenTabs(prev => [...prev, newSnipItem]);
        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(snipId)) return current;
            return createBalancedTreeFromLeaves([...leaves, snipId]);
        });
        setShowMobileSidebar(false);
        setSelectedDocId(snipId);
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        openBoard,
        openStRunner,
        openSemanticBrowser,
        openFormalizer,
        openAgoraAI,
        openFilesTab,
        openSnippetsGallery,
        closeTabById,
        openDocument,
        openDocumentInTile,
        handleDropDocOnTile,
        handleDropDocOnEmpty
    };
}
