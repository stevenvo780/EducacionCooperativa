'use client';

import { useEffect, useState, useRef, useCallback, useMemo, useDeferredValue, useTransition } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import { useRouter } from 'next/navigation';
import { Check, FileText, Folder, Image as ImageIcon, File as FileIcon, Key, Loader2, Shield, Terminal as TerminalIcon, Users, X } from 'lucide-react';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion, type Transition } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { MosaicNode } from 'react-mosaic-component';
import type { DocItem, FolderItem, ViewMode, Workspace, DialogConfig, DialogResult, DeleteStatus } from '@/components/dashboard/types';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath, normalizePath } from '@/lib/folder-utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    setShowWorkspaceMenu as setShowWorkspaceMenuAction,
    setShowNewWorkspaceModal as setShowNewWorkspaceModalAction,
    setShowMembersModal as setShowMembersModalAction,
    setShowPasswordModal as setShowPasswordModalAction,
    setPasswordForm as setPasswordFormAction,
    setPasswordError as setPasswordErrorAction,
    setPasswordSuccess as setPasswordSuccessAction,
    setIsChangingPassword as setIsChangingPasswordAction,
    setShowQuickSearch as setShowQuickSearchAction,
    setQuickSearchQuery as setQuickSearchQueryAction,
    setQuickSearchIndex as setQuickSearchIndexAction,
    setSidebarSearchQuery as setSidebarSearchQueryAction,
    setShowMobileSidebar as setShowMobileSidebarAction,
    setDeletingWorkspaceId as setDeletingWorkspaceIdAction,
    setWorkspaces as setWorkspacesAction,
    setInvites as setInvitesAction,
    setCurrentWorkspace as setCurrentWorkspaceAction
} from '@/store/dashboardSlice';
import {
    acceptInviteApi,
    createDocumentApi,
    createWorkspaceApi,
    deleteDocumentApi,
    deleteWorkspaceApi,
    fetchDocsApi,
    fetchDocumentRawApi,
    fetchWorkspacesApi,
    inviteMemberApi,
    updateDocumentApi,
    uploadFileApi
} from '@/services/dashboardApi';
import { areDocsEquivalent, areFoldersEquivalent, normalizeWorkspace } from '@/services/dashboardUtils';
import { getDocBadge, isMarkdownDocItem } from '@/services/dashboardDocUtils';
import { saveDashboardState, loadDashboardState, restoreOpenTabs, validateMosaicNode } from '@/services/dashboardPersistence';
import { useDashboardUploads } from '@/hooks/dashboard/useDashboardUploads';
import QuickSearchModal from '@/components/dashboard/QuickSearchModal';
import StatusToasts from '@/components/dashboard/StatusToasts';
import DialogModal from '@/components/dashboard/DialogModal';
import DragOverlay from '@/components/dashboard/DragOverlay';
import HeaderBar from '@/components/dashboard/HeaderBar';
import Sidebar from '@/components/dashboard/Sidebar';
import TabsBar from '@/components/dashboard/TabsBar';
import WorkspaceExplorer from '@/components/dashboard/WorkspaceExplorer';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });
const MosaicLayout = dynamic(() => import('@/components/MosaicLayout'), { ssr: false });
const FileExplorer = dynamic(() => import('@/components/FileExplorer'), { ssr: false });

const PERSONAL_WORKSPACE_ID = 'personal';
const ROOT_FOLDER_PATH = '';
const DOCS_POLL_INTERVAL_MS = 30000;

export default function DashboardPage() {
    const { user, loading, logout, changePassword } = useAuth();
    const {
        activeSessionId,
        selectSession,
        createSession,
        destroySession,
        status: connectionStatus,
        initialize,
        isCreatingSession,
        getSessionsForWorkspace,
        getWorkerStatusForWorkspace,
        subscribeToWorkspace,
        clearActiveSession
    } = useTerminal();
    const dispatch = useAppDispatch();
    const [docs, setDocs] = useState<DocItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const router = useRouter();
    const reduceMotion = useReducedMotion();
    const [, startTransition] = useTransition();
    const modalFade = useMemo<Transition>(() => ({
        duration: reduceMotion ? 0.01 : 0.12,
        ease: 'easeOut'
    }), [reduceMotion]);
    const modalPop = useMemo<Transition>(() => ({
        duration: reduceMotion ? 0.01 : 0.14,
        ease: 'easeOut'
    }), [reduceMotion]);

    useEffect(() => {
        if (!user) return;
        // Production: use HTTPS domain, Development: use localhost
        const nexusUrl = process.env.NEXT_PUBLIC_NEXUS_URL ||
            (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                ? 'http://localhost:3010'
                : 'https://hub.humanizar-dev.cloud');
        initialize(nexusUrl);
    }, [initialize, user]);

    const workspaces = useAppSelector(state => state.dashboard.workspaces);
    const invites = useAppSelector(state => state.dashboard.invites);
    const currentWorkspace = useAppSelector(state => state.dashboard.currentWorkspace);
    const showWorkspaceMenu = useAppSelector(state => state.dashboard.showWorkspaceMenu);
    const showNewWorkspaceModal = useAppSelector(state => state.dashboard.showNewWorkspaceModal);
    const showMembersModal = useAppSelector(state => state.dashboard.showMembersModal);
    const showPasswordModal = useAppSelector(state => state.dashboard.showPasswordModal);
    const passwordForm = useAppSelector(state => state.dashboard.passwordForm);
    const passwordError = useAppSelector(state => state.dashboard.passwordError);
    const passwordSuccess = useAppSelector(state => state.dashboard.passwordSuccess);
    const isChangingPassword = useAppSelector(state => state.dashboard.isChangingPassword);
    const showQuickSearch = useAppSelector(state => state.dashboard.showQuickSearch);
    const quickSearchQuery = useAppSelector(state => state.dashboard.quickSearchQuery);
    const quickSearchIndex = useAppSelector(state => state.dashboard.quickSearchIndex);
    const sidebarSearchQuery = useAppSelector(state => state.dashboard.sidebarSearchQuery);
    const showMobileSidebar = useAppSelector(state => state.dashboard.showMobileSidebar);
    const deletingWorkspaceId = useAppSelector(state => state.dashboard.deletingWorkspaceId);

    const setWorkspaces = useCallback((value: Workspace[]) => {
        dispatch(setWorkspacesAction(value));
    }, [dispatch]);
    const setInvites = useCallback((value: Workspace[]) => {
        dispatch(setInvitesAction(value));
    }, [dispatch]);
    const setCurrentWorkspace = useCallback((value: Workspace | null) => {
        dispatch(setCurrentWorkspaceAction(value));
    }, [dispatch]);
    const setShowWorkspaceMenu = useCallback((value: boolean) => {
        dispatch(setShowWorkspaceMenuAction(value));
    }, [dispatch]);
    const setShowNewWorkspaceModal = useCallback((value: boolean) => {
        dispatch(setShowNewWorkspaceModalAction(value));
    }, [dispatch]);
    const setShowMembersModal = useCallback((value: boolean) => {
        dispatch(setShowMembersModalAction(value));
    }, [dispatch]);
    const setShowPasswordModal = useCallback((value: boolean) => {
        dispatch(setShowPasswordModalAction(value));
    }, [dispatch]);
    const setPasswordForm = useCallback((value: { current: string; new: string; confirm: string }) => {
        dispatch(setPasswordFormAction(value));
    }, [dispatch]);
    const setPasswordError = useCallback((value: string) => {
        dispatch(setPasswordErrorAction(value));
    }, [dispatch]);
    const setPasswordSuccess = useCallback((value: boolean) => {
        dispatch(setPasswordSuccessAction(value));
    }, [dispatch]);
    const setIsChangingPassword = useCallback((value: boolean) => {
        dispatch(setIsChangingPasswordAction(value));
    }, [dispatch]);
    const setShowQuickSearch = useCallback((value: boolean) => {
        dispatch(setShowQuickSearchAction(value));
    }, [dispatch]);
    const setQuickSearchQuery = useCallback((value: string) => {
        dispatch(setQuickSearchQueryAction(value));
    }, [dispatch]);
    const setQuickSearchIndex = useCallback((value: number) => {
        dispatch(setQuickSearchIndexAction(value));
    }, [dispatch]);
    const setSidebarSearchQuery = useCallback((value: string) => {
        dispatch(setSidebarSearchQueryAction(value));
    }, [dispatch]);
    const setShowMobileSidebar = useCallback((value: boolean) => {
        dispatch(setShowMobileSidebarAction(value));
    }, [dispatch]);
    const setDeletingWorkspaceId = useCallback((value: string | null) => {
        dispatch(setDeletingWorkspaceIdAction(value));
    }, [dispatch]);
    const currentWorkspaceId = currentWorkspace?.id;

    useEffect(() => {
        if (!user || !currentWorkspace) return;
        const workerToken = currentWorkspace.type === 'personal' || currentWorkspace.id === 'personal'
            ? `personal:${user.uid}`
            : currentWorkspace.id;
        subscribeToWorkspace(workerToken);
    }, [user, currentWorkspace, subscribeToWorkspace]);

    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [openTabs, setOpenTabs] = useState<DocItem[]>([]);
    const [docModes, setDocModes] = useState<Record<string, ViewMode>>({});
    const [closedFilesTabByWorkspace, setClosedFilesTabByWorkspace] = useState<Record<string, boolean>>({});
    const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);
    const [dialogInputValue, setDialogInputValue] = useState('');
    const [activeFolder, setActiveFolder] = useState<string>(ROOT_FOLDER_PATH);
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [folderDragOver, setFolderDragOver] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<number | null>(null);
    const [mosaicNode, setMosaicNode] = useState<MosaicNode<string> | null>(null);

    const quickSearchInputRef = useRef<HTMLInputElement>(null);
    const deferredQuickSearchQuery = useDeferredValue(quickSearchQuery);
    const deferredDocs = useDeferredValue(docs);

    const [newDocName, setNewDocName] = useState('');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [deleteStatus, setDeleteStatus] = useState<DeleteStatus | null>(null);
    const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const deleteStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const docsRef = useRef<DocItem[]>([]);
    const currentWorkspaceRef = useRef<Workspace | null>(null);
    const fetchInFlightRef = useRef<Promise<void> | null>(null);
    const dialogResolverRef = useRef<((result: DialogResult) => void) | null>(null);
    const folderInputProps = { webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>;

    useEffect(() => {
        docsRef.current = docs;
    }, [docs]);

    useEffect(() => {
        currentWorkspaceRef.current = currentWorkspace;
    }, [currentWorkspace]);

    const fetchWorkspaces = useCallback(async () => {
        if (!user) return;

        const personalSpace: Workspace = {
            id: PERSONAL_WORKSPACE_ID,
            name: 'Espacio Personal',
            ownerId: user.uid,
            members: [user.uid],
            type: 'personal'
        };

        let fetched: Workspace[] = [];
        let fetchedInvites: Workspace[] = [];
        try {
            const data = await fetchWorkspacesApi({ ownerId: user.uid, email: user.email });
            fetched = data.workspaces.map(normalizeWorkspace);
            fetchedInvites = data.invites.map(normalizeWorkspace);
        } catch (e) {
            console.error('Error fetching workspaces', e);
        }

        const allWorkspaces = [personalSpace, ...fetched.filter(ws => ws.id !== PERSONAL_WORKSPACE_ID)];
        setWorkspaces(allWorkspaces);
        setInvites(fetchedInvites);
        const previousWorkspace = currentWorkspaceRef.current;
        const resolvedWorkspace = previousWorkspace
            ? (allWorkspaces.find(ws => ws.id === previousWorkspace.id) ?? personalSpace)
            : personalSpace;
        setCurrentWorkspace(resolvedWorkspace);
    }, [user, setWorkspaces, setInvites, setCurrentWorkspace]);

    const acceptInvite = async (ws: Workspace) => {
        if (!user?.email) return;
        try {
            await acceptInviteApi({ workspaceId: ws.id, userId: user.uid, email: user.email });
            await fetchWorkspaces();
            await showDialog({
                type: 'info',
                title: 'Invitación aceptada',
                message: '¡Te has unido al espacio!'
            });
        } catch (e) {
            console.error('Error accepting', e);
        }
    };

    const applyDocsSnapshot = useCallback((fetched: DocItem[]) => {
        if (!currentWorkspace) return;

        const sanitized = fetched.map(docItem => {
            const { content, ...rest } = docItem;
            return rest;
        });

        const filtered = sanitized.filter(d => {
            if (currentWorkspace.id === PERSONAL_WORKSPACE_ID) {
                return !d.workspaceId || d.workspaceId === PERSONAL_WORKSPACE_ID;
            }
            return d.workspaceId === currentWorkspace.id;
        });

        const folderDocs = filtered.filter(item => item.type === 'folder');
        const fileDocs = filtered.filter(item => item.type !== 'folder');

        const normalizedFileDocs = fileDocs.map(docItem => {
            const folderPath = normalizeFolderPath(docItem.folder);
            return { ...docItem, folder: folderPath };
        });

        const folderMap = new Map<string, FolderItem>();
        const ensureNode = (path: string, kind: FolderItem['kind'], docId?: string) => {
            const normalized = normalizePath(path);
            if (!normalized) return;
            const existing = folderMap.get(normalized);
            const name = normalized.split('/').slice(-1)[0] || normalized;
            const parentPath = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';

            if (!existing) {
                folderMap.set(normalized, {
                    id: `path:${normalized}`,
                    name,
                    path: normalized,
                    parentPath,
                    kind,
                    docId
                });
                return;
            }

            const priority: Record<FolderItem['kind'], number> = { system: 0, record: 1, virtual: 2 };
            const next = { ...existing };
            if (priority[kind] < priority[existing.kind]) {
                next.kind = kind;
            }
            if (docId && !next.docId) {
                next.docId = docId;
            }
            folderMap.set(normalized, next);
        };

        const ensureAncestors = (path: string) => {
            const normalized = normalizePath(path);
            if (!normalized) return;
            const parts = normalized.split('/');
            let current = '';
            parts.forEach(part => {
                current = current ? `${current}/${part}` : part;
                ensureNode(current, current === DEFAULT_FOLDER_NAME ? 'system' : 'virtual');
            });
        };

        ensureNode(DEFAULT_FOLDER_NAME, 'system');

        folderDocs.forEach(folderDoc => {
            const parentPath = normalizePath(folderDoc.folder);
            const name = (folderDoc.name || 'Carpeta').trim() || 'Carpeta';
            const fullPath = parentPath ? `${parentPath}/${name}` : name;
            ensureAncestors(parentPath);
            ensureNode(fullPath, fullPath === DEFAULT_FOLDER_NAME ? 'system' : 'record', folderDoc.id);
        });

        normalizedFileDocs.forEach(docItem => {
            const folderPath = normalizeFolderPath(docItem.folder);
            ensureAncestors(folderPath);
            ensureNode(folderPath, folderPath === DEFAULT_FOLDER_NAME ? 'system' : 'virtual');
        });

        const folderList = Array.from(folderMap.values());

        normalizedFileDocs.sort((a, b) => {
            const dateA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt).getTime();
            const dateB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt).getTime();
            return (dateB || 0) - (dateA || 0);
        });

        startTransition(() => {
            setDocs(prev => (areDocsEquivalent(prev, normalizedFileDocs) ? prev : normalizedFileDocs));
            setFolders(prev => (areFoldersEquivalent(prev, folderList) ? prev : folderList));
        });
    }, [currentWorkspace, startTransition]);

    const fetchDocs = useCallback(async (options?: { showLoading?: boolean }) => {
        if (!user || !currentWorkspace) return;
        if (fetchInFlightRef.current) return fetchInFlightRef.current;
        const showLoading = options?.showLoading ?? docsRef.current.length === 0;
        if (showLoading) setLoadingDocs(true);
        const fetchPromise = (async () => {
            try {
                const wsId = currentWorkspace.id === PERSONAL_WORKSPACE_ID ? 'personal' : currentWorkspace.id;
                const fetched = await fetchDocsApi({
                    workspaceId: wsId,
                    ownerId: currentWorkspace.id === PERSONAL_WORKSPACE_ID ? user.uid : undefined,
                    view: 'metadata'
                });

                applyDocsSnapshot(fetched);
            } catch (error) {
                console.error('Error fetching docs', error);
            }
        })();

        fetchInFlightRef.current = fetchPromise;
        try {
            await fetchPromise;
        } finally {
            fetchInFlightRef.current = null;
            if (showLoading) setLoadingDocs(false);
        }
    }, [user, currentWorkspace, applyDocsSnapshot]);

    useEffect(() => {
        if (!loading && !user) router.push('/login');
        if (user) {
            fetchWorkspaces();
        }
    }, [user, loading, router, fetchWorkspaces]);

    useEffect(() => {
        if (currentWorkspace && user) {
            fetchDocs({ showLoading: true });
        }
    }, [currentWorkspace, user, fetchDocs]);

    useEffect(() => {
        if (!currentWorkspace || !user) return;
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            fetchDocs();
        }, DOCS_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [currentWorkspace, user, fetchDocs]);

    const [stateRestoredForWorkspace, setStateRestoredForWorkspace] = useState<string | null>(null);

    useEffect(() => {
        if (!currentWorkspaceId) return;
        const persisted = loadDashboardState(currentWorkspaceId);
        if (persisted) {
            if (persisted.sidebarWidth) setSidebarWidth(persisted.sidebarWidth);
            if (persisted.activeFolder) setActiveFolder(persisted.activeFolder);
            if (persisted.docModes) setDocModes(persisted.docModes);
        } else {
            setDocModes({});
        }
        setOpenTabs([]);
        setMosaicNode(null);
        setSelectedDocId(null);
        setClosedFilesTabByWorkspace(prev => ({ ...prev, [currentWorkspaceId]: false }));
        setStateRestoredForWorkspace(null);
        clearActiveSession();
    }, [currentWorkspaceId, clearActiveSession]);

    useEffect(() => {
        if (!currentWorkspace || !user) return;
        const filesTabId = `files-${currentWorkspace.id}`;
        const hasFilesTab = openTabs.some(tab => tab.id === filesTabId);
        const isClosedForWorkspace = closedFilesTabByWorkspace[currentWorkspace.id];
        if (hasFilesTab || isClosedForWorkspace) return;

        (async () => {
            const newFilesItem: DocItem = {
                id: filesTabId,
                name: 'Archivos',
                type: 'files',
                updatedAt: new Date(),
                ownerId: user.uid
            };

            setOpenTabs(prev => [...prev, newFilesItem]);
            const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
            setMosaicNode(current => {
                const leaves = getLeaves(current);
                if (leaves.includes(filesTabId)) return current;
                return createBalancedTreeFromLeaves([...leaves, filesTabId]);
            });
            setSelectedDocId(filesTabId);
        })();
    }, [currentWorkspace, user, openTabs, closedFilesTabByWorkspace]);

    useEffect(() => {
        if (!currentWorkspaceId || !docs.length || loadingDocs) return;
        if (stateRestoredForWorkspace === currentWorkspaceId) return;

        const persisted = loadDashboardState(currentWorkspaceId);
        if (persisted?.openTabs && persisted.openTabs.length > 0) {
            const restoredTabs = restoreOpenTabs(persisted.openTabs, docs);
            if (restoredTabs.length > 0) {
                setOpenTabs(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const newTabs = restoredTabs.filter(t => !existingIds.has(t.id));
                    return [...prev, ...newTabs];
                });

                if (persisted.mosaicNode) {
                    (async () => {
                        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
                        setMosaicNode(() => {
                            const tabIds = new Set([
                                ...restoredTabs.map(t => t.id),
                                ...openTabs.map(t => t.id)
                            ]);
                            const validated = validateMosaicNode(persisted.mosaicNode!, tabIds);
                            if (validated) return validated;
                            const allIds = [...tabIds];
                            return allIds.length > 0 ? createBalancedTreeFromLeaves(allIds) : null;
                        });
                    })();
                }

                if (persisted.selectedDocId) {
                    const selectedExists = restoredTabs.some(t => t.id === persisted.selectedDocId) ||
                        openTabs.some(t => t.id === persisted.selectedDocId);
                    if (selectedExists) {
                        setSelectedDocId(persisted.selectedDocId);
                    }
                }
            }
        }
        setStateRestoredForWorkspace(currentWorkspaceId);
    }, [currentWorkspaceId, docs, loadingDocs, stateRestoredForWorkspace, openTabs]);

    useEffect(() => {
        if (!currentWorkspaceId || loadingDocs) return;
        const timeoutId = setTimeout(() => {
            saveDashboardState(currentWorkspaceId, {
                openTabs,
                selectedDocId,
                mosaicNode,
                docModes,
                sidebarWidth,
                activeFolder
            });
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [currentWorkspaceId, openTabs, selectedDocId, mosaicNode, docModes, sidebarWidth, activeFolder, loadingDocs]);

    useEffect(() => {
        if (currentWorkspaceId) {
            const persisted = loadDashboardState(currentWorkspaceId);
            if (!persisted?.activeFolder) {
                setActiveFolder(ROOT_FOLDER_PATH);
            }
        }
    }, [currentWorkspaceId]);

    useEffect(() => {
        return () => {
            if (deleteStatusTimer.current) {
                clearTimeout(deleteStatusTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                setShowQuickSearch(true);
                setQuickSearchQuery('');
                setQuickSearchIndex(0);
                setTimeout(() => quickSearchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape' && showQuickSearch) {
                setShowQuickSearch(false);
                setQuickSearchQuery('');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showQuickSearch, setQuickSearchIndex, setQuickSearchQuery, setShowQuickSearch]);

    const quickSearchResults = useMemo(() => {
        const query = deferredQuickSearchQuery.trim().toLowerCase();
        if (!query) return deferredDocs.slice(0, 10);
        return deferredDocs
            .filter(d => d.type !== 'folder' && d.name.toLowerCase().includes(query))
            .slice(0, 15);
    }, [deferredDocs, deferredQuickSearchQuery]);

    const handleQuickSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setQuickSearchIndex(Math.min(quickSearchIndex + 1, quickSearchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setQuickSearchIndex(Math.max(quickSearchIndex - 1, 0));
        } else if (e.key === 'Enter' && quickSearchResults[quickSearchIndex]) {
            e.preventDefault();
            openDocument(quickSearchResults[quickSearchIndex]);
            setShowQuickSearch(false);
            setQuickSearchQuery('');
        }
    };

    const sidebarFilteredDocs = useMemo(() => {
        if (!sidebarSearchQuery.trim()) return docs;
        const query = sidebarSearchQuery.toLowerCase();
        return docs.filter(d => d.name.toLowerCase().includes(query));
    }, [docs, sidebarSearchQuery]);

    const openTerminal = async (session?: { id: string; name?: string }) => {
        const terminalId = session ? `terminal-${session.id}` : 'terminal-main';
        const terminalName = session?.name || 'Mi Asistente';

        if (openTabs.find(t => t.id === terminalId)) {
            if (session?.id) {
                selectSession(session.id);
            }
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

    const closeTabById = useCallback(async (docId: string) => {
        if (currentWorkspace && docId === `files-${currentWorkspace.id}`) {
            setClosedFilesTabByWorkspace(prev => ({ ...prev, [currentWorkspace.id]: true }));
        }

        setOpenTabs(prev => {
            const tabToClose = prev.find(t => t.id === docId);
            if (tabToClose?.type === 'terminal' && tabToClose.sessionId) {
                destroySession(tabToClose.sessionId);
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
    }, [selectedDocId, currentWorkspace, destroySession]);

    const openDocument = async (doc: DocItem) => {
        if (doc.type === 'folder') return;
        setActiveFolder(normalizeFolderPath(doc.folder));
        setOpenTabs(prev => {
            if (prev.find(t => t.id === doc.id)) {
                return prev;
            }
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
    };

    const closeTab = (docId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        closeTabById(docId);
    };

    const showDialog = useCallback((config: DialogConfig) => {
        return new Promise<DialogResult>((resolve) => {
            setDialogConfig(config);
            setDialogInputValue(config.defaultValue ?? '');
            dialogResolverRef.current = resolve;
        });
    }, []);

    const {
        uploadStatus,
        isDragActive,
        setUploadTargetFolder,
        handleFileUpload,
        handleFolderUpload,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        uploadDroppedFilesToFolder
    } = useDashboardUploads({
        user,
        currentWorkspace,
        activeFolder,
        rootFolderPath: ROOT_FOLDER_PATH,
        fileInputRef,
        folderInputRef,
        fetchDocs,
        openDocument,
        showDialog
    });

    const resolveDialog = (result: DialogResult) => {
        dialogResolverRef.current?.(result);
        dialogResolverRef.current = null;
        setDialogConfig(null);
    };

    const confirmDialog = () => {
        if (!dialogConfig) {
            setDialogConfig(null);
            return;
        }
        const value = dialogConfig.type === 'input' ? dialogInputValue.trim() : undefined;
        resolveDialog({ confirmed: true, value });
    };

    const cancelDialog = () => {
        resolveDialog({ confirmed: false, value: null });
    };

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

        setOpenTabs(prev => {
            if (prev.some(tab => tab.id === filesTabId)) return prev;
            return [...prev, newFilesItem];
        });

        const { getLeaves, createBalancedTreeFromLeaves } = await import('react-mosaic-component');
        setMosaicNode(current => {
            const leaves = getLeaves(current);
            if (leaves.includes(filesTabId)) return current;
            return createBalancedTreeFromLeaves([...leaves, filesTabId]);
        });

        setSelectedDocId(filesTabId);
        setShowMobileSidebar(false);
    }, [currentWorkspace, setShowMobileSidebar, user]);

    useEffect(() => {
        setDocModes(prev => {
            const next: Record<string, ViewMode> = {};
            openTabs.forEach(tab => {
                next[tab.id] = prev[tab.id] ?? 'preview';
            });
            return next;
        });
    }, [openTabs]);

    const setDocMode = useCallback((docId: string, mode: ViewMode) => {
        setDocModes(prev => {
            if (prev[docId] === mode) return prev;
            return { ...prev, [docId]: mode };
        });
    }, []);

    const activeFolderLabel = activeFolder || 'Raiz';

    const createFolderRecord = async (folderName: string, parentOverride?: string) => {
        if (!user) return false;
        const trimmed = folderName.trim();
        if (!trimmed) return false;
        const parentPath = normalizePath(parentOverride ?? activeFolder);
        const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
        const exists = folders.some(folder => folder.path.toLowerCase() === fullPath.toLowerCase());
        if (exists) return false;

        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? 'personal' : workspaceId;
        try {
            await createDocumentApi({
                name: trimmed,
                type: 'folder',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: parentPath
            });
            await fetchDocs();
            return true;
        } catch (error) {
            console.error('Failed to create folder', error);
            return false;
        }
    };

    const createFolder = async () => {
        const result = await showDialog({
            type: 'input',
            title: 'Nueva carpeta',
            message: 'Ingresa el nombre de la carpeta',
            placeholder: 'Nombre de carpeta'
        });
        if (!result.confirmed) return;
        const trimmed = (result.value ?? '').trim();
        if (!trimmed) return;
        const parentPath = normalizePath(activeFolder);
        const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
        const exists = folders.some(folder => folder.path.toLowerCase() === fullPath.toLowerCase());
        if (exists) {
            await showDialog({ type: 'info', title: 'La carpeta ya existe', message: fullPath });
            return;
        }
        const created = await createFolderRecord(trimmed, parentPath);
        if (!created) {
            await showDialog({ type: 'error', title: 'No se pudo crear la carpeta' });
        }
    };

    const moveDocumentToFolder = async (docId: string, folderPath: string) => {
        const targetPath = normalizeFolderPath(folderPath);

        if (targetPath !== DEFAULT_FOLDER_NAME) {
            const segments = targetPath.split('/');
            const leafName = segments[segments.length - 1];
            const parentPath = segments.slice(0, -1).join('/');
            const exists = folders.some(folder => folder.path.toLowerCase() === targetPath.toLowerCase());
            if (!exists) {
                await createFolderRecord(leafName, parentPath);
            }
        }

        setDocs(prev => prev.map(item => item.id === docId ? { ...item, folder: targetPath } : item));
        setOpenTabs(prev => prev.map(item => item.id === docId ? { ...item, folder: targetPath } : item));

        try {
            await updateDocumentApi(docId, { folder: targetPath });
            await fetchDocs();
        } catch (error) {
            console.error('Error moving document', error);
            await fetchDocs();
        }
    };

    const copyDocument = async (docItem: DocItem) => {
        if (!user) return;
        if (docItem.type === 'folder') return;
        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? 'personal' : workspaceId;
        const newName = `${docItem.name} (copia)`;
        let resolvedContent = '';
        if (docItem.type !== 'file') {
            if (typeof docItem.content === 'string') {
                resolvedContent = docItem.content;
            } else {
                try {
                    resolvedContent = await fetchDocumentRawApi(docItem.id);
                } catch (error) {
                    console.error('Error loading content for copy', error);
                    await showDialog({ type: 'error', title: 'No se pudo cargar el contenido para copiar.' });
                    return;
                }
            }
        }
        const payload: Record<string, unknown> = {
            name: newName,
            type: docItem.type || 'text',
            ownerId: user.uid,
            workspaceId: docWorkspaceId,
            folder: normalizeFolderPath(docItem.folder),
            mimeType: docItem.mimeType || null
        };

        if (docItem.type === 'file') {
            payload.url = docItem.url || null;
            payload.storagePath = docItem.storagePath || null;
        } else {
            payload.content = resolvedContent;
        }

        try {
            const data = await createDocumentApi(payload);
            await fetchDocs();
            openDocument({
                id: String(data.id),
                name: newName,
                type: docItem.type || 'text',
                ownerId: user.uid,
                updatedAt: { seconds: Date.now() / 1000 },
                folder: normalizeFolderPath(docItem.folder),
                mimeType: docItem.mimeType,
                url: docItem.url,
                storagePath: docItem.storagePath
            });
        } catch (error) {
            console.error('Error copying document', error);
            await showDialog({ type: 'error', title: 'Error al copiar' });
        }
    };

    const promptMoveDocument = async (docItem: DocItem) => {
        const current = normalizeFolderPath(docItem.folder);
        const result = await showDialog({
            type: 'input',
            title: 'Mover a carpeta',
            message: 'Ingresa la ruta de destino',
            defaultValue: current,
            placeholder: 'carpeta/subcarpeta'
        });
        if (!result.confirmed) return;
        const target = (result.value ?? '').trim();
        if (!target) return;
        await moveDocumentToFolder(docItem.id, target);
    };

    const createWorkspace = async () => {
        if (!newWorkspaceName.trim() || !user) return;
        try {
            const data = await createWorkspaceApi({ name: newWorkspaceName, ownerId: user.uid });
            setNewWorkspaceName('');
            setShowNewWorkspaceModal(false);
            await fetchWorkspaces();
            setCurrentWorkspace({
                id: String(data.id),
                name: data.name ?? newWorkspaceName,
                ownerId: data.ownerId ?? user.uid,
                members: Array.isArray(data.members) ? data.members : [user.uid],
                type: 'shared'
            });
        } catch (e) {
            console.error('Error creating workspace', e);
        }
    };

    const deleteWorkspace = async (workspace: Workspace) => {
        if (!user) return;
        if (workspace.id === PERSONAL_WORKSPACE_ID || workspace.type === 'personal') {
            await showDialog({ type: 'info', title: 'No se puede eliminar', message: 'El espacio personal no se puede borrar.' });
            return;
        }
        if (workspace.ownerId && workspace.ownerId !== user.uid) {
            await showDialog({ type: 'error', title: 'Sin permisos', message: 'Solo el administrador puede eliminar este espacio.' });
            return;
        }

        setShowWorkspaceMenu(false);
        const confirmResult = await showDialog({
            type: 'input',
            title: 'Eliminar espacio de trabajo',
            message: `Escribe "${workspace.name}" para confirmar. Esta acción eliminará documentos y archivos asociados.`,
            placeholder: workspace.name,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        const typedName = (confirmResult.value ?? '').trim();
        if (typedName !== workspace.name.trim()) {
            await showDialog({ type: 'error', title: 'Nombre incorrecto', message: 'El nombre no coincide.' });
            return;
        }

        try {
            setDeletingWorkspaceId(workspace.id);
            await deleteWorkspaceApi({ workspaceId: workspace.id, ownerId: user.uid });
            await fetchWorkspaces();
            setShowMembersModal(false);
            await showDialog({ type: 'info', title: 'Espacio eliminado', message: workspace.name });
        } catch (e) {
            console.error('Error deleting workspace', e);
            await showDialog({ type: 'error', title: 'Error al eliminar', message: workspace.name });
        } finally {
            setDeletingWorkspaceId(null);
        }
    };

    const createDoc = async (e?: React.FormEvent, folderName?: string) => {
        if (e) e.preventDefault();
        const name = newDocName.trim() || 'Sin título';
        if (!user) return;
        const targetFolder = normalizeFolderPath(folderName ?? activeFolder);
        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? 'personal' : workspaceId;
        setIsCreating(true);
        try {
            const data = await createDocumentApi({
                name: name,
                content: '# ' + name,
                type: 'text',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: targetFolder
            });
            const docRef = { id: String(data.id) };

            setNewDocName('');
            await fetchDocs();
            openDocument({
                id: docRef.id,
                name: name,
                type: 'text',
                ownerId: user.uid,
                updatedAt: { seconds: Date.now() / 1000 },
                folder: targetFolder
            });
        } catch (e) {
            console.error('Error creating doc', e);
        } finally {
            setIsCreating(false);
        }
    };

    const docsByFolder = useMemo(() => {
        const grouped: Record<string, DocItem[]> = {};
        docs.forEach(docItem => {
            const folderName = normalizeFolderPath(docItem.folder);
            if (!grouped[folderName]) grouped[folderName] = [];
            grouped[folderName].push(docItem);
        });
        return grouped;
    }, [docs]);

    const activeFolderDocs = useMemo(() => {
        return docsByFolder[activeFolder] ?? [];
    }, [docsByFolder, activeFolder]);

    const folderChildrenMap = useMemo(() => {
        const map: Record<string, FolderItem[]> = {};
        folders.forEach(folder => {
            const parent = folder.parentPath || '';
            if (!map[parent]) map[parent] = [];
            map[parent].push(folder);
        });
        Object.values(map).forEach(list => {
            list.sort((a, b) => {
                const kindWeight: Record<FolderItem['kind'], number> = { system: 0, record: 1, virtual: 2 };
                const weightDiff = kindWeight[a.kind] - kindWeight[b.kind];
                if (weightDiff !== 0) return weightDiff;
                return a.name.localeCompare(b.name);
            });
        });
        return map;
    }, [folders]);

    const activeChildFolders = useMemo(() => {
        return folderChildrenMap[activeFolder] ?? [];
    }, [folderChildrenMap, activeFolder]);

    const renderFolderTree = (parentPath: string, depth = 0): ReactNode[] => {
        const children = folderChildrenMap[parentPath] ?? [];
        return children.map(folder => {
            const count = docsByFolder[folder.path]?.length ?? 0;
            const isActive = activeFolder === folder.path;
            const isDropActive = folderDragOver === folder.path;
            const paddingLeft = 12 + depth * 12;

            return (
                <div key={folder.path}>
                    <button
                        onClick={() => setActiveFolder(folder.path)}
                        onDragOver={(e) => handleFolderDragOver(e, folder.path)}
                        onDrop={(e) => handleFolderDrop(e, folder.path)}
                        onDragLeave={() => handleFolderDragLeave(folder.path)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition border ${isDropActive ? 'border-mandy-500/70 bg-mandy-500/10 text-mandy-300' : isActive ? 'border-mandy-500/40 bg-mandy-500/10 text-mandy-300' : 'border-transparent text-surface-300 hover:bg-surface-700/40'}`}
                        style={{ paddingLeft }}
                    >
                        <Folder className={`w-4 h-4 ${isActive ? 'text-mandy-400' : 'text-surface-500'}`} />
                        <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
                        <span className="text-[10px] text-surface-500">{count}</span>
                    </button>
                    {renderFolderTree(folder.path, depth + 1)}
                </div>
            );
        });
    };

    useEffect(() => {
        if (activeFolder === ROOT_FOLDER_PATH) return;
        if (folders.length === 0) {
            setActiveFolder(ROOT_FOLDER_PATH);
            return;
        }
        const exists = folders.some(folder => folder.path === activeFolder);
        if (!exists) {
            const rootFolders = folderChildrenMap[ROOT_FOLDER_PATH] ?? [];
            const fallback = rootFolders[0]?.path || ROOT_FOLDER_PATH;
            setActiveFolder(fallback);
        }
    }, [folders, activeFolder, folderChildrenMap]);

    const scheduleDeleteStatusClear = () => {
        if (deleteStatusTimer.current) {
            clearTimeout(deleteStatusTimer.current);
        }
        deleteStatusTimer.current = setTimeout(() => setDeleteStatus(null), 2000);
    };

    const handleDocDragStart = (e: React.DragEvent, docItem: DocItem) => {
        e.dataTransfer.setData('application/x-doc-id', docItem.id);
        e.dataTransfer.setData('text/plain', docItem.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDocDragEnd = () => {
        setFolderDragOver(null);
        setDropPosition(null);
    };

    const handleDropZoneDragOver = (e: React.DragEvent, position: number) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId || types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(position);
    };

    const handleDropZoneDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
    };

    const handleDropZoneDrop = (e: React.DragEvent, position: number) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId || types.includes('Files')) return;
        const docId = e.dataTransfer.getData('application/x-doc-id') || e.dataTransfer.getData('text/plain');
        if (!docId) return;
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
        const docToOpen = docs.find(d => d.id === docId) || openTabs.find(d => d.id === docId);
        if (docToOpen) {
            setOpenTabs(prev => {
                const filtered = prev.filter(t => t.id !== docToOpen.id);
                const newTabs = [...filtered];
                newTabs.splice(position, 0, docToOpen);
                return newTabs;
            });
            setSelectedDocId(docToOpen.id);
        }
    };

    const handleFolderDragOver = (e: React.DragEvent, folderName: string) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const hasFiles = types.includes('Files');
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (hasFiles) {
            e.preventDefault();
            setFolderDragOver(folderName);
            return;
        }
        if (!hasDocId) return;
        e.preventDefault();
        setFolderDragOver(folderName);
    };

    const handleFolderDragLeave = (folderName: string) => {
        if (folderDragOver === folderName) {
            setFolderDragOver(null);
        }
    };

    const handleFolderDrop = async (e: React.DragEvent, folderName: string) => {
        const didUpload = await uploadDroppedFilesToFolder(e, folderName);
        if (didUpload) {
            setFolderDragOver(null);
            return;
        }
        const types = Array.from(e.dataTransfer.types ?? []);
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId) return;
        const docId = e.dataTransfer.getData('application/x-doc-id') || e.dataTransfer.getData('text/plain');
        if (!docId) return;
        e.preventDefault();
        setFolderDragOver(null);
        await moveDocumentToFolder(docId, folderName);
    };

    const isWithinFolder = (candidate: string, folderPath: string) => {
        if (!candidate) return false;
        return candidate === folderPath || candidate.startsWith(`${folderPath}/`);
    };

    const deleteDocRecords = async (uniqueIds: string[], label: string) => {
        setDeletingIds(prev => {
            const next = { ...prev };
            uniqueIds.forEach(id => {
                next[id] = true;
            });
            return next;
        });

        try {
            if (deleteStatusTimer.current) {
                clearTimeout(deleteStatusTimer.current);
            }
            setDeleteStatus({ phase: 'deleting', name: label });

            const results = await Promise.all(
                uniqueIds.map(async id => {
                    try {
                        const ok = await deleteDocumentApi(id);
                        return { id, ok };
                    } catch {
                        return { id, ok: false };
                    }
                })
            );

            const failed = results.filter(result => !result.ok).map(result => result.id);
            const succeeded = results.filter(result => result.ok).map(result => result.id);

            if (succeeded.length > 0) {
                setDocs(prev => prev.filter(item => !succeeded.includes(item.id)));
                succeeded.forEach(id => closeTabById(id));
            }
            await fetchDocs();

            if (failed.length > 0) {
                console.error('Error deleting', failed);
                setDeleteStatus({ phase: 'error', name: label, error: 'Error al eliminar' });
                await showDialog({ type: 'error', title: 'Error al eliminar' });
            } else {
                setDeleteStatus({ phase: 'done', name: label });
            }
            scheduleDeleteStatusClear();
        } finally {
            setDeletingIds(prev => {
                const next = { ...prev };
                uniqueIds.forEach(id => {
                    delete next[id];
                });
                return next;
            });
        }
    };

    const deleteItems = async ({ docIds, folderPaths }: { docIds: string[]; folderPaths: string[] }) => {
        const filteredFolderPaths = folderPaths
            .map(path => normalizePath(path))
            .filter(path => path && path !== DEFAULT_FOLDER_NAME);

        if (filteredFolderPaths.length !== folderPaths.length) {
            await showDialog({ type: 'info', title: 'No se puede eliminar la carpeta raíz.' });
        }

        const folderDocIds = new Set<string>();
        const docIdsFromFolders = new Set<string>();

        filteredFolderPaths.forEach(folderPath => {
            folders.forEach(folder => {
                if (folder.docId && isWithinFolder(folder.path, folderPath)) {
                    folderDocIds.add(folder.docId);
                }
            });
            docs.forEach(doc => {
                const docFolder = normalizeFolderPath(doc.folder);
                if (isWithinFolder(docFolder, folderPath)) {
                    docIdsFromFolders.add(doc.id);
                }
            });
        });

        const allDocIds = Array.from(new Set([...docIds, ...folderDocIds, ...docIdsFromFolders]));
        if (allDocIds.length === 0) return;

        const label = allDocIds.length === 1 ? 'Elemento' : `${allDocIds.length} elementos`;
        const confirmResult = await showDialog({
            type: 'confirm',
            title: 'Confirmar eliminación',
            message: `¿Eliminar ${label}? Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        await deleteDocRecords(allDocIds, label);
    };

    const deleteFolder = async (folder: FolderItem) => {
        if (folder.path === DEFAULT_FOLDER_NAME || folder.kind === 'system') {
            await showDialog({ type: 'info', title: 'No se puede eliminar la carpeta raíz.' });
            return;
        }
        await deleteItems({ docIds: [], folderPaths: [folder.path] });
    };

    const deleteDocument = async (docItem: DocItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (deletingIds[docItem.id]) return;
        const confirmResult = await showDialog({
            type: 'confirm',
            title: 'Eliminar elemento',
            message: 'Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        await deleteDocRecords([docItem.id], docItem.name);
    };

    const inviteMember = async () => {
        if (!inviteEmail || !currentWorkspace || currentWorkspace.type === 'personal') return;
        try {
            await inviteMemberApi({ workspaceId: currentWorkspace.id, email: inviteEmail });
            await showDialog({ type: 'info', title: 'Invitación enviada', message: inviteEmail });
            setInviteEmail('');
        } catch (e) {
            console.error('Error inviting', e);
            await showDialog({ type: 'error', title: 'Error al invitar' });
        }
    };

    const getIcon = (doc: DocItem) => {
        if (doc.type === 'terminal') return <TerminalIcon className="w-5 h-5" />;
        if (doc.type === 'file') {
            if (doc.mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
            if (isMarkdownDocItem(doc)) return <FileText className="w-5 h-5" />;
            return <FileIcon className="w-5 h-5" />;
        }
        return <FileText className="w-5 h-5" />;
    };

    if (loading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-surface-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mandy-500" />
            </div>
        );
    }

    return (
        <LazyMotion features={domAnimation}>
            <div
                className="h-screen bg-surface-900 flex flex-col text-white overflow-hidden relative"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <QuickSearchModal
                    open={showQuickSearch}
                    query={quickSearchQuery}
                    onQueryChange={setQuickSearchQuery}
                    results={quickSearchResults}
                    selectedIndex={quickSearchIndex}
                    onSelectIndex={setQuickSearchIndex}
                    onClose={() => setShowQuickSearch(false)}
                    onSelect={(doc) => {
                        openDocument(doc);
                        setShowQuickSearch(false);
                        setQuickSearchQuery('');
                    }}
                    onKeyDown={handleQuickSearchKeyDown}
                    inputRef={quickSearchInputRef}
                    getIcon={getIcon}
                    modalFade={modalFade}
                    modalPop={modalPop}
                />

                <DragOverlay isDragActive={isDragActive} workspaceName={currentWorkspace?.name} />
                <StatusToasts uploadStatus={uploadStatus} deleteStatus={deleteStatus} />
                <DialogModal
                    dialogConfig={dialogConfig}
                    dialogInputValue={dialogInputValue}
                    onDialogInputChange={setDialogInputValue}
                    onConfirm={confirmDialog}
                    onCancel={cancelDialog}
                    modalFade={modalFade}
                    modalPop={modalPop}
                />

                <HeaderBar
                    onToggleMobileSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
                    onClearSelectedDoc={() => setSelectedDocId(null)}
                    showWorkspaceMenu={showWorkspaceMenu}
                    setShowWorkspaceMenu={setShowWorkspaceMenu}
                    currentWorkspace={currentWorkspace}
                    invites={invites}
                    workspaces={workspaces}
                    user={user}
                    deletingWorkspaceId={deletingWorkspaceId}
                    personalWorkspaceId={PERSONAL_WORKSPACE_ID}
                    onAcceptInvite={acceptInvite}
                    onSelectWorkspace={setCurrentWorkspace}
                    onDeleteWorkspace={deleteWorkspace}
                    onNewWorkspace={() => setShowNewWorkspaceModal(true)}
                    onShowMembers={() => setShowMembersModal(true)}
                    onOpenPassword={() => {
                        setPasswordForm({ current: '', new: '', confirm: '' });
                        setPasswordError('');
                        setPasswordSuccess(false);
                        setShowPasswordModal(true);
                    }}
                    onLogout={() => logout()}
                />

                <div className="flex flex-1 overflow-hidden relative">
                    <Sidebar
                        sidebarWidth={sidebarWidth}
                        showMobileSidebar={showMobileSidebar}
                        onCloseMobileSidebar={() => setShowMobileSidebar(false)}
                        openFilesTab={openFilesTab}
                        createDoc={createDoc}
                        createFolder={createFolder}
                        setUploadTargetFolder={setUploadTargetFolder}
                        fileInputRef={fileInputRef}
                        folderInputRef={folderInputRef}
                        handleFileUpload={handleFileUpload}
                        handleFolderUpload={handleFolderUpload}
                        folderInputProps={folderInputProps}
                        currentWorkspace={currentWorkspace}
                        activeFolder={activeFolder}
                        setActiveFolder={setActiveFolder}
                        folders={folders}
                        connectionStatus={connectionStatus}
                        isCreatingSession={isCreatingSession}
                        activeSessionId={activeSessionId}
                        getWorkerStatusForWorkspace={getWorkerStatusForWorkspace}
                        getSessionsForWorkspace={getSessionsForWorkspace}
                        createSession={createSession}
                        selectSession={selectSession}
                        destroySession={destroySession}
                        openTerminal={openTerminal}
                        openTabs={openTabs}
                        closeTabById={closeTabById}
                        user={user}
                        loadingDocs={loadingDocs}
                        docs={docs}
                        sidebarSearchQuery={sidebarSearchQuery}
                        setSidebarSearchQuery={setSidebarSearchQuery}
                        sidebarFilteredDocs={sidebarFilteredDocs}
                        selectedDocId={selectedDocId}
                        openDocument={openDocument}
                        handleDocDragStart={handleDocDragStart}
                        handleDocDragEnd={handleDocDragEnd}
                        deleteDocument={deleteDocument}
                        setShowQuickSearch={setShowQuickSearch}
                        quickSearchInputRef={quickSearchInputRef}
                        getIcon={getIcon}
                    />

                    <div className="flex-1 flex flex-col bg-surface-900 overflow-hidden relative">

                        <TabsBar
                            openTabs={openTabs}
                            selectedDocId={selectedDocId}
                            onSelectTab={(tab) => {
                                setSelectedDocId(tab.id);
                                if (tab.type === 'terminal' && tab.sessionId) {
                                    selectSession(tab.sessionId);
                                }
                            }}
                            onCloseTab={closeTab}
                            getIcon={getIcon}
                        />

                        {mosaicNode ? (
                            <div className="flex-1 min-h-0 relative">
                                <MosaicLayout
                                    value={mosaicNode}
                                    onChange={setMosaicNode}
                                    openTabs={openTabs}
                                    docs={docs}
                                    folders={folders}
                                    docModes={docModes}
                                    onSetDocMode={setDocMode}
                                    onCloseTab={closeTabById}
                                    onSelectDoc={openDocument}
                                    onCreateFile={() => createDoc(undefined, activeFolder)}
                                    onCreateFolder={() => createFolder()}
                                    onUploadFile={() => {
                                        setUploadTargetFolder(activeFolder);
                                        fileInputRef.current?.click();
                                    }}
                                    onUploadFolder={() => {
                                        setUploadTargetFolder(activeFolder);
                                        folderInputRef.current?.click();
                                    }}
                                    onDeleteDoc={(docId) => {
                                        const doc = docs.find(d => d.id === docId);
                                        if (doc) deleteDocument(doc, { stopPropagation: () => { } } as React.MouseEvent);
                                    }}
                                    onDeleteFolder={deleteFolder}
                                    onDeleteItems={deleteItems}
                                    onDuplicateDoc={copyDocument}
                                    onMoveDoc={moveDocumentToFolder}
                                    activeFolder={activeFolder}
                                    onActiveFolderChange={setActiveFolder}
                                    currentWorkspaceName={currentWorkspace?.name}
                                    currentWorkspaceId={currentWorkspace?.id}
                                    currentWorkspaceType={currentWorkspace?.type}
                                    nexusUrl={process.env.NEXT_PUBLIC_NEXUS_URL || 'http://localhost:3002'}
                                />
                            </div>
                        ) : (
                            <WorkspaceExplorer
                                currentWorkspace={currentWorkspace}
                                activeFolder={activeFolder}
                                activeFolderLabel={activeFolderLabel}
                                activeChildFolders={activeChildFolders}
                                activeFolderDocs={activeFolderDocs}
                                docsByFolder={docsByFolder}
                                folderTree={renderFolderTree(ROOT_FOLDER_PATH)}
                                folderDragOver={folderDragOver}
                                onFolderDragOver={handleFolderDragOver}
                                onFolderDrop={handleFolderDrop}
                                onFolderDragLeave={handleFolderDragLeave}
                                onDocDragStart={handleDocDragStart}
                                onDocDragEnd={handleDocDragEnd}
                                onActiveFolderChange={setActiveFolder}
                                onOpenDocument={openDocument}
                                onCreateDoc={() => createDoc(undefined, activeFolder)}
                                onCreateFolder={() => createFolder()}
                                onUploadFile={() => {
                                    setUploadTargetFolder(activeFolder);
                                    fileInputRef.current?.click();
                                }}
                                onUploadFolder={() => {
                                    setUploadTargetFolder(activeFolder);
                                    folderInputRef.current?.click();
                                }}
                                onCopyWorkspaceId={(id) => {
                                    navigator.clipboard.writeText(id);
                                    showDialog({ type: 'info', title: 'ID copiado', message: id });
                                }}
                                onCopyDocument={copyDocument}
                                onMoveDocument={promptMoveDocument}
                                onDeleteDocument={deleteDocument}
                                getIcon={getIcon}
                                getDocBadge={getDocBadge}
                                personalWorkspaceId={PERSONAL_WORKSPACE_ID}
                                rootFolderPath={ROOT_FOLDER_PATH}
                                defaultFolderName={DEFAULT_FOLDER_NAME}
                            />
                        )}

                    </div>
                </div>

                <AnimatePresence>
                    {showNewWorkspaceModal && (
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={modalFade}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] motion-reduce:backdrop-blur-none p-4"
                        >
                            <div className="bg-surface-800 rounded-2xl shadow-xl shadow-black/40 p-6 w-full max-w-sm border border-surface-600/50">
                                <h2 className="text-lg font-bold mb-4 text-white">Nuevo Espacio de Trabajo</h2>
                                <input
                                    type="text"
                                    placeholder="Nombre, ej: Grupo Física"
                                    value={newWorkspaceName}
                                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                                    className="w-full px-4 py-2 bg-surface-700 border border-surface-600 rounded-lg mb-4 text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                                    autoFocus
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setShowNewWorkspaceModal(false)} className="px-4 py-2 text-sm text-surface-400 hover:bg-surface-700 rounded-lg">Cancelar</button>
                                    <button onClick={createWorkspace} disabled={!newWorkspaceName.trim()} className="px-4 py-2 text-sm bg-gradient-mandy text-white rounded-lg hover:opacity-90 disabled:opacity-50">Crear</button>
                                </div>
                            </div>
                        </m.div>
                    )}

                    {showMembersModal && currentWorkspace && (
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={modalFade}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] motion-reduce:backdrop-blur-none p-4"
                        >
                            <div className="bg-surface-800 rounded-2xl shadow-xl shadow-black/40 p-6 w-full max-w-md border border-surface-600/50">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                                        <Users className="w-5 h-5 text-mandy-400" />
                                        Miembros de {currentWorkspace.name}
                                    </h2>
                                    <button onClick={() => setShowMembersModal(false)} className="p-1 hover:bg-surface-700 rounded-full text-surface-400"><X className="w-4 h-4" /></button>
                                </div>

                                <div className="mb-6">
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Invitar por Email</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            placeholder="usuario@ejemplo.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="flex-1 px-4 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                                        />
                                        <button onClick={inviteMember} className="bg-gradient-mandy text-white px-4 py-2 rounded-lg text-sm hover:opacity-90">Enviar</button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Miembros ({currentWorkspace.members.length})</label>
                                    <div className="max-h-48 overflow-y-auto scrollbar-hide pr-2 space-y-2">
                                        {currentWorkspace.members.map((uid) => (
                                            <div key={uid} className="flex items-center justify-between p-2 bg-surface-700 rounded-lg text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-mandy-500/15 text-mandy-400 rounded-full flex items-center justify-center text-xs font-bold">
                                                        U
                                                    </div>
                                                    <span className="text-surface-300 font-mono text-xs">{uid.substring(0, 8)}...</span>
                                                    {uid === currentWorkspace.ownerId && <span className="bg-accent-purple/20 text-accent-purple-light text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                                                </div>
                                                <Shield className={`w-3 h-3 ${uid === currentWorkspace.ownerId ? 'text-mandy-400' : 'text-surface-600'}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </m.div>
                    )}

                    {showPasswordModal && (
                        <m.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={modalFade}
                            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                            onClick={() => setShowPasswordModal(false)}
                        >
                            <m.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={modalPop}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-surface-800 rounded-2xl border border-surface-600/50 p-6 w-full max-w-md shadow-xl"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Key className="w-5 h-5 text-mandy-400" />
                                        Cambiar Contraseña
                                    </h2>
                                    <button onClick={() => setShowPasswordModal(false)} className="p-1 hover:bg-surface-700 rounded-full text-surface-400">
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
                                            onClick={() => setShowPasswordModal(false)}
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
                                            } catch (err: any) {
                                                setPasswordError(err.message || 'Error al cambiar la contraseña');
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
                                                onClick={() => setShowPasswordModal(false)}
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
            </div>
        </LazyMotion>
    );
}
