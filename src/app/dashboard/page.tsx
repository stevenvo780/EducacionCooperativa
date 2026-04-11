'use client';

import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, FileText, Folder, Image as ImageIcon, File as FileIcon, KanbanSquare, Loader2, Minimize2, PanelLeftOpen, Terminal as TerminalIcon } from 'lucide-react';
import { LazyMotion, domAnimation, useReducedMotion, type Transition } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { MosaicNode } from 'react-mosaic-component';
import { DialogKind, type DocItem, type FolderItem, type ViewMode, type Workspace, type DialogConfig, type DialogResult } from '@/components/dashboard/types';
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
    fetchCurrentUserApi,
    fetchUserProfilesApi
} from '@/services/dashboardApi';
import { areDocsEquivalent, areFoldersEquivalent, getUpdatedAtValue } from '@/services/dashboardUtils';
import { getDocBadge, isMarkdownDocItem } from '@/services/dashboardDocUtils';
import { loadFavoriteDocIds, MAX_FAVORITE_DOCS, saveFavoriteDocIds } from '@/services/dashboardPersistence';
import { useDashboardUploads } from '@/hooks/dashboard/useDashboardUploads';
import { useDashboardPersistence } from '@/hooks/dashboard/useDashboardPersistence';
import QuickSearchModal from '@/components/dashboard/QuickSearchModal';
import StatusToasts from '@/components/dashboard/StatusToasts';
import DialogModal from '@/components/dashboard/DialogModal';
import NewFileModal, { type FileKind } from '@/components/dashboard/NewFileModal';
import DragOverlay from '@/components/dashboard/DragOverlay';
import HeaderBar from '@/components/dashboard/HeaderBar';
import Sidebar from '@/components/dashboard/Sidebar';
import WorkspaceExplorer from '@/components/dashboard/WorkspaceExplorer';
import MembersModal from '@/components/dashboard/MembersModal';
import ChangePasswordModal from '@/components/dashboard/ChangePasswordModal';
import NewWorkspaceModal from '@/components/dashboard/NewWorkspaceModal';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { PLANS } from '@/types/subscription';
import PricingModal from '@/components/dashboard/PricingModal';
import { useDashboardWorkspaces } from '@/hooks/dashboard/useDashboardWorkspaces';
import { useDashboardDocsSync } from '@/hooks/dashboard/useDashboardDocsSync';
import { useSubscription } from '@/hooks/dashboard/useSubscription';
import { useQuickSearch } from '@/hooks/dashboard/useQuickSearch';
import { useDeleteDocument } from '@/hooks/dashboard/useDeleteDocument';
import { useTerminalTabs } from '@/hooks/dashboard/useTerminalTabs';
import { useMosaicTabs } from '@/hooks/dashboard/useMosaicTabs';
import { useDocumentActions } from '@/hooks/dashboard/useDocumentActions';
import { useWorkspaceActions } from '@/hooks/dashboard/useWorkspaceActions';
import { ALL_SEARCH_RESULT_FILTER } from '@/lib/search/types';
import { PERSONAL_WORKSPACE_ID, WorkspaceType } from '@/types/workspace';
import { semanticBrowserBus } from '@/lib/semantic-browser-bus';

const MosaicLayout = dynamic(() => import('@/components/MosaicLayout'), { ssr: false });

const ROOT_FOLDER_PATH = '';

function DashboardContent() {
    const { user, userEmail, loading, logout, changePassword } = useAuth();
    const {
        activeSessionId,
        sessions: terminalSessions,
        selectSession,
        createSession,
        destroySession,
        renameSession,
        status: connectionStatus,
        initialize,
        isCreatingSession,
        getSessionsForWorkspace,
        getWorkerStatusForWorkspace,
        subscribeToWorkspace,
        clearActiveSession,
        onDocChangeCallback
    } = useTerminal();
    const dispatch = useAppDispatch();
    const [docs, setDocs] = useState<DocItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [memberProfiles, setMemberProfiles] = useState<Record<string, { email?: string | null; displayName?: string | null }>>({});
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentPlan, subscriptionEndDate, showPricingModal, setShowPricingModal } = useSubscription(user, searchParams);
    const reduceMotion = useReducedMotion();
    const modalFade = useMemo<Transition>(() => ({
        duration: reduceMotion ? 0.01 : 0.08,
        ease: 'easeOut'
    }), [reduceMotion]);
    const modalPop = useMemo<Transition>(() => ({
        duration: reduceMotion ? 0.01 : 0.1,
        ease: 'easeOut'
    }), [reduceMotion]);
    const isPageVisible = usePageVisibility();
    const { isOnline, syncNow, pendingCount } = useOfflineSync();

    useEffect(() => {
        if (!user) return;
        const nexusUrl = process.env.NEXT_PUBLIC_NEXUS_URL ||
            (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                ? 'http://localhost:3010'
                : 'https://hub.humanizar-dev.cloud');
        initialize(nexusUrl);
    }, [initialize, user]);

    useEffect(() => {
        let cancelled = false;

        const loadRole = async () => {
            if (!user) {
                setIsAdmin(false);
                return;
            }
            try {
                const data = await fetchCurrentUserApi();
                if (cancelled) return;
                const role = typeof data.role === 'string' ? data.role.toLowerCase().trim() : '';
                setIsAdmin(role === 'admin' || role === 'superadmin');
            } catch (_error) {
                if (!cancelled) {
                    setIsAdmin(false);
                }
            }
        };

        loadRole();
        return () => {
            cancelled = true;
        };
    }, [user]);

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

    useEffect(() => {
        let cancelled = false;
        if (!showMembersModal || !currentWorkspace) return;
        const memberIds = Array.isArray(currentWorkspace.members) ? currentWorkspace.members : [];
        if (memberIds.length === 0) {
            setMemberProfiles({});
            return;
        }
        const wsId = currentWorkspace.id === PERSONAL_WORKSPACE_ID ? PERSONAL_WORKSPACE_ID : currentWorkspace.id;
        fetchUserProfilesApi({ workspaceId: wsId, userIds: memberIds })
            .then((data) => {
                if (cancelled) return;
                const next: Record<string, { email?: string | null; displayName?: string | null }> = {};
                data.users.forEach((profile) => {
                    next[profile.uid] = {
                        email: profile.email ?? null,
                        displayName: profile.displayName ?? null
                    };
                });
                setMemberProfiles(next);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Error fetching member profiles', err);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [showMembersModal, currentWorkspace]);

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
    const requestedWorkspaceId = (searchParams?.get('workspaceId') || searchParams?.get('workspace') || '').trim() || null;

    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [favoriteDocIds, setFavoriteDocIds] = useState<string[]>([]);
    const [openTabs, setOpenTabs] = useState<DocItem[]>([]);
    const [docModes, setDocModes] = useState<Record<string, ViewMode>>({});
    const [closedFilesTabByWorkspace, setClosedFilesTabByWorkspace] = useState<Record<string, boolean>>({});
    const boardTabId = currentWorkspaceId ? `board-${currentWorkspaceId}` : null;
    const isBoardOpen = boardTabId ? openTabs.some(tab => tab.id === boardTabId) : false;
    const stRunnerTabId = currentWorkspaceId ? `st-runner-${currentWorkspaceId}` : null;
    const isStRunnerOpen = stRunnerTabId ? openTabs.some(tab => tab.id === stRunnerTabId) : false;
    const semanticBrowserTabId = currentWorkspaceId ? `semantic-browser-${currentWorkspaceId}` : null;
    const isSemanticBrowserOpen = semanticBrowserTabId ? openTabs.some(tab => tab.id === semanticBrowserTabId) : false;
    const formalizerTabId = currentWorkspaceId ? `formalizer-${currentWorkspaceId}` : null;
    const isFormalizerOpen = formalizerTabId ? openTabs.some(tab => tab.id === formalizerTabId) : false;
    const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);
    const [dialogInputValue, setDialogInputValue] = useState('');
    const [showNewFileModal, setShowNewFileModal] = useState(false);
    const [newFileTargetFolder, setNewFileTargetFolder] = useState<string>(ROOT_FOLDER_PATH);
    const [activeFolder, setActiveFolder] = useState<string>(ROOT_FOLDER_PATH);
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const startResizingSidebar = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingSidebar(true);
    }, []);

    const stopResizingSidebar = useCallback(() => {
        setIsResizingSidebar(false);
    }, []);

    const resizeSidebar = useCallback((e: MouseEvent) => {
        if (isResizingSidebar) {
            const newWidth = e.clientX;
            if (newWidth >= 160 && newWidth <= 600) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizingSidebar]);

    useEffect(() => {
        if (isResizingSidebar) {
            window.addEventListener('mousemove', resizeSidebar);
            window.addEventListener('mouseup', stopResizingSidebar);
        } else {
            window.removeEventListener('mousemove', resizeSidebar);
            window.removeEventListener('mouseup', stopResizingSidebar);
        }
        return () => {
            window.removeEventListener('mousemove', resizeSidebar);
            window.removeEventListener('mouseup', stopResizingSidebar);
        };
    }, [isResizingSidebar, resizeSidebar, stopResizingSidebar]);

    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const zenRestoreRef = useRef({ sidebar: false, header: false });
    const shortcutChordDeadlineRef = useRef(0);
    const openBoardRef = useRef<() => Promise<void> | void>(() => {});
    const openDocumentRef = useRef<(doc: DocItem) => Promise<void> | void>(() => {});
    const openDocumentInTileRef = useRef<(doc: DocItem, targetTileId?: string | null) => Promise<void> | void>(() => {});
    const resolveActiveFolder = useCallback((path?: string) => {
        if (path === ROOT_FOLDER_PATH) return ROOT_FOLDER_PATH;
        return normalizeFolderPath(path);
    }, []);

    const setActiveFolderSafe = useCallback((path: string) => {
        setActiveFolder(resolveActiveFolder(path));
    }, [resolveActiveFolder]);
    const handleToggleSidebarCollapse = useCallback(() => {
        if (showMobileSidebar) {
            setShowMobileSidebar(false);
        }
        setIsSidebarCollapsed(prev => !prev);
    }, [showMobileSidebar, setShowMobileSidebar]);
    const handleToggleHeaderCollapse = useCallback(() => {
        setShowWorkspaceMenu(false);
        setIsHeaderCollapsed(prev => !prev);
    }, [setShowWorkspaceMenu]);
    const enterZenMode = useCallback(() => {
        zenRestoreRef.current = { sidebar: isSidebarCollapsed, header: isHeaderCollapsed };
        setShowWorkspaceMenu(false);
        setShowMobileSidebar(false);
        setIsSidebarCollapsed(true);
        setIsHeaderCollapsed(true);
        setIsZenMode(true);
    }, [isHeaderCollapsed, isSidebarCollapsed, setShowMobileSidebar, setShowWorkspaceMenu]);
    const exitZenMode = useCallback(() => {
        setIsSidebarCollapsed(zenRestoreRef.current.sidebar);
        setIsHeaderCollapsed(zenRestoreRef.current.header);
        setIsZenMode(false);
    }, []);
    const handleToggleZenMode = useCallback(() => {
        if (isZenMode) {
            exitZenMode();
        } else {
            enterZenMode();
        }
    }, [enterZenMode, exitZenMode, isZenMode]);
    const [folderDragOver, setFolderDragOver] = useState<string | null>(null);
    const [_dropPosition, setDropPosition] = useState<number | null>(null);
    const [mosaicNode, setMosaicNode] = useState<MosaicNode<string> | null>(null);

    const {
        quickSearchInputRef,
        semanticSearchResults,
        semanticSearchLoading,
        semanticSearchError,
        quickSearchFilter,
        setQuickSearchFilter,
        quickSearchResults: _quickSearchResults,
        closeQuickSearch,
        handleQuickSearchSelect,
        handleQuickSearchKeyDown
    } = useQuickSearch({
        showQuickSearch,
        quickSearchQuery,
        quickSearchIndex,
        currentWorkspaceId: currentWorkspace?.id,
        docs,
        setShowQuickSearch,
        setQuickSearchQuery,
        setQuickSearchIndex,
        onSelectDoc: async (doc) => { await openDocumentRef.current(doc); }
    });

    const openQuickSearch = useCallback(() => {
        setShowQuickSearch(true);
        setQuickSearchQuery('');
        setQuickSearchIndex(0);
        setQuickSearchFilter(ALL_SEARCH_RESULT_FILTER);
        setTimeout(() => quickSearchInputRef.current?.focus(), 50);
    }, [quickSearchInputRef, setQuickSearchFilter, setQuickSearchIndex, setQuickSearchQuery, setShowQuickSearch]);

    const deferredDocs = useDeferredValue(docs);
    const deferredSidebarQuery = useDeferredValue(sidebarSearchQuery);

    const [newDocName, setNewDocName] = useState('');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [_isCreating, setIsCreating] = useState(false);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const docsRef = useRef<DocItem[]>([]);
    const foldersRef = useRef<FolderItem[]>([]);
    const currentWorkspaceRef = useRef<Workspace | null>(null);
    const dialogResolverRef = useRef<((result: DialogResult) => void) | null>(null);
    const folderInputProps = { webkitdirectory: 'true', directory: 'true' } as InputHTMLAttributes<HTMLInputElement>;

    useEffect(() => {
        docsRef.current = docs;
    }, [docs]);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    useEffect(() => {
        currentWorkspaceRef.current = currentWorkspace;
    }, [currentWorkspace]);

    const { fetchWorkspaces, selectWorkspace } = useDashboardWorkspaces({
        user,
        userEmail,
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        requestedWorkspaceId,
        router,
        searchParams,
        personalWorkspaceId: PERSONAL_WORKSPACE_ID,
        setWorkspaces,
        setInvites,
        setCurrentWorkspace,
        subscribeToWorkspace
    });

    const acceptInvite = async (ws: Workspace) => {
        if (!user || !userEmail) {
            await showDialog({
                type: DialogKind.Error,
                title: 'Error',
                message: 'No se pudo obtener el email del usuario. Por favor, inicia sesión de nuevo.'
            });
            return;
        }
        try {
            await acceptInviteApi({ workspaceId: ws.id, userId: user.uid, email: userEmail });
            await fetchWorkspaces();
            await showDialog({
                type: DialogKind.Info,
                title: 'Invitación aceptada',
                message: '¡Te has unido al espacio!'
            });
        } catch (e) {
            await showDialog({
                type: DialogKind.Error,
                title: 'Error al unirse',
                message: e instanceof Error ? e.message : 'Error desconocido'
            });
        }
    };

    const applyDocsSnapshot = useCallback((fetched: DocItem[]) => {
        if (!currentWorkspace) return;

        const sanitized = fetched.map(docItem => {
            const { content: _content, ...rest } = docItem;
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
        const ensureNode = (path: string, kind: FolderItem['kind'], docId?: string, order?: number) => {
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
                    docId,
                    order: typeof order === 'number' ? order : undefined
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
            if (typeof order === 'number' && typeof next.order !== 'number') {
                next.order = order;
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
            ensureNode(fullPath, fullPath === DEFAULT_FOLDER_NAME ? 'system' : 'record', folderDoc.id, typeof folderDoc.order === 'number' ? folderDoc.order : undefined);
        });

        normalizedFileDocs.forEach(docItem => {
            const folderPath = normalizeFolderPath(docItem.folder);
            ensureAncestors(folderPath);
            ensureNode(folderPath, folderPath === DEFAULT_FOLDER_NAME ? 'system' : 'virtual');
        });

        const folderList = Array.from(folderMap.values());

        folderList.sort((a, b) => {
            if (a.parentPath !== b.parentPath) {
                return a.parentPath.localeCompare(b.parentPath);
            }
            const orderA = typeof a.order === 'number' ? a.order : null;
            const orderB = typeof b.order === 'number' ? b.order : null;
            if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
            if (orderA !== null && orderB === null) return -1;
            if (orderA === null && orderB !== null) return 1;
            const kindWeight: Record<FolderItem['kind'], number> = { system: 0, record: 1, virtual: 2 };
            const weightDiff = kindWeight[a.kind] - kindWeight[b.kind];
            if (weightDiff !== 0) return weightDiff;
            return a.name.localeCompare(b.name);
        });

        normalizedFileDocs.sort((a, b) => {
            const dateA = getUpdatedAtValue(a.updatedAt);
            const dateB = getUpdatedAtValue(b.updatedAt);
            if (dateA !== dateB) return dateB - dateA;
            return (a.name || '').localeCompare(b.name || '');
        });

        setDocs(prev => {
            const changed = !areDocsEquivalent(prev, normalizedFileDocs);
            return changed ? normalizedFileDocs : prev;
        });
        setFolders(prev => {
            const changed = !areFoldersEquivalent(prev, folderList);
            return changed ? folderList : prev;
        });
    }, [currentWorkspace]);

    const { fetchDocs, requestDocsRefresh } = useDashboardDocsSync({
        user,
        currentWorkspace,
        docsLength: docs.length,
        isOnline,
        pendingCount,
        isPageVisible,
        syncNow,
        personalWorkspaceId: PERSONAL_WORKSPACE_ID,
        applyDocsSnapshot,
        setLoadingDocs,
        onDocChangeCallback
    });

    useEffect(() => {
        if (!loading && !user) router.push('/login');
        if (user) {
            fetchWorkspaces();
        }
    }, [user, loading, router, fetchWorkspaces]);

    useDashboardPersistence({
        currentWorkspace,
        currentWorkspaceId,
        userUid: user?.uid,
        docs,
        loadingDocs,
        openTabs,
        selectedDocId,
        mosaicNode,
        docModes,
        sidebarWidth,
        activeFolder,
        isSidebarCollapsed,
        isHeaderCollapsed,
        closedFilesTabByWorkspace,
        rootFolderPath: ROOT_FOLDER_PATH,
        zenRestoreRef,
        setSidebarWidth,
        setActiveFolderSafe,
        setDocModes,
        setIsSidebarCollapsed,
        setIsHeaderCollapsed,
        setIsZenMode,
        setOpenTabs,
        setMosaicNode,
        setSelectedDocId,
        setClosedFilesTabByWorkspace,
        clearActiveSession
    });

    useEffect(() => {
        setDocs([]);
        setFolders([]);
        setLoadingDocs(true);
        setSidebarSearchQuery('');
        setShowQuickSearch(false);
        setQuickSearchQuery('');
        setQuickSearchIndex(0);
    }, [currentWorkspaceId, setQuickSearchIndex, setQuickSearchQuery, setShowQuickSearch, setSidebarSearchQuery]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            const data = event.data as { type?: string; docId?: string; sourceDocId?: string; workspaceId?: string } | null;
            if (!data || typeof data.type !== 'string') return;

            if (data.type === 'agora-open-doc' && typeof data.docId === 'string') {
                const doc = docs.find(item => item.id === data.docId);
                if (!doc) return;
                void openDocumentInTileRef.current(doc, data.sourceDocId ?? null);
            } else if (data.type === 'agora-open-board') {
                void openBoardRef.current();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [docs]);

    const sidebarFilteredDocs = useMemo(() => {
        const query = deferredSidebarQuery.trim().toLowerCase();
        if (!query) return deferredDocs;
        return deferredDocs.filter(d => d.name.toLowerCase().includes(query));
    }, [deferredDocs, deferredSidebarQuery]);

    const favoriteDocs = useMemo(() => {
        if (favoriteDocIds.length === 0) return [];

        const docsById = new Map(docs.map(doc => [doc.id, doc]));
        return favoriteDocIds
            .map(docId => docsById.get(docId))
            .filter((doc): doc is DocItem => Boolean(doc));
    }, [docs, favoriteDocIds]);

    useEffect(() => {
        if (!currentWorkspaceId || !user?.uid) {
            setFavoriteDocIds([]);
            return;
        }

        setFavoriteDocIds(loadFavoriteDocIds(currentWorkspaceId, user.uid));
    }, [currentWorkspaceId, user?.uid]);

    useEffect(() => {
        if (!currentWorkspaceId || !user?.uid || loadingDocs) return;

        const availableDocIds = new Set(docs.map(doc => doc.id));
        const sanitized = favoriteDocIds
            .filter(docId => availableDocIds.has(docId))
            .slice(0, MAX_FAVORITE_DOCS);

        if (
            sanitized.length !== favoriteDocIds.length
            || sanitized.some((docId, index) => docId !== favoriteDocIds[index])
        ) {
            setFavoriteDocIds(sanitized);
            return;
        }

        saveFavoriteDocIds(currentWorkspaceId, user.uid, sanitized);
    }, [currentWorkspaceId, docs, favoriteDocIds, loadingDocs, user?.uid]);

    const { openTerminal, handleRequestNewTerminal } = useTerminalTabs({
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
    });

    const {
        openBoard,
        openStRunner,
        openSemanticBrowser,
        openFormalizer,
        openFilesTab,
        openSnippetsGallery,
        closeTabById,
        openDocument,
        openDocumentInTile,
        handleDropDocOnTile,
        handleDropDocOnEmpty
    } = useMosaicTabs({
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
    });

    openBoardRef.current = openBoard;
    openDocumentRef.current = openDocument;
    openDocumentInTileRef.current = openDocumentInTile;

    /* Subscribe to semantic-browser-bus so editors can open the global tab */
    useEffect(() => {
        return semanticBrowserBus.subscribe(() => {
            void openSemanticBrowser();
        });
    }, [openSemanticBrowser]);

    const showDialog = useCallback((config: DialogConfig) => {
        return new Promise<DialogResult>((resolve) => {
            setDialogConfig(config);
            setDialogInputValue(config.defaultValue ?? '');
            dialogResolverRef.current = resolve;
        });
    }, []);

    const { deleteStatus, deletingIds, deleteDocRecords, deleteItems, deleteFolder } = useDeleteDocument({
        docs,
        folders,
        requestDocsRefresh,
        closeTabById,
        showDialog,
        setDocs
    });

    const {
        createFolderRecord: _createFolderRecord,
        createFolder,
        moveDocumentToFolder,
        renameDocument,
        promptRenameDocument,
        promptRenameTerminalSession,
        reorderDocsInFolder,
        reorderFoldersInParent,
        copyDocument,
        promptMoveDocument,
        createDoc,
        createStDoc,
        createStGuide,
        handleDownloadDoc,
        handleDownloadFolder
    } = useDocumentActions({
        user,
        currentWorkspace,
        docs,
        setDocs,
        folders,
        setFolders,
        setOpenTabs,
        activeFolder,
        requestDocsRefresh,
        showDialog,
        openDocument,
        docsRef,
        foldersRef,
        newDocName,
        setNewDocName,
        setIsCreating,
        renameSession
    });

    const { createWorkspace, deleteWorkspace, inviteMember, removeMember } = useWorkspaceActions({
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
    });

    const toggleFavoriteDoc = useCallback(async (doc: DocItem) => {
        setFavoriteDocIds(prev => {
            if (prev.includes(doc.id)) {
                return prev.filter(docId => docId !== doc.id);
            }

            if (prev.length >= MAX_FAVORITE_DOCS) {
                void showDialog({
                    type: DialogKind.Info,
                    title: 'Límite de favoritos alcanzado',
                    message: `Puedes fijar hasta ${MAX_FAVORITE_DOCS} documentos. Quita uno para agregar otro.`
                });
                return prev;
            }

            return [doc.id, ...prev];
        });
    }, [showDialog]);

    const moveFavoriteDoc = useCallback((docId: string, direction: 'up' | 'down') => {
        setFavoriteDocIds(prev => {
            const currentIndex = prev.indexOf(docId);
            if (currentIndex === -1) return prev;

            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= prev.length) return prev;

            const next = prev.slice();
            const [moved] = next.splice(currentIndex, 1);
            next.splice(targetIndex, 0, moved);
            return next;
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

    const openNewFileModalAt = useCallback((folderPath?: string) => {
        const targetFolder = resolveActiveFolder(folderPath ?? activeFolder);
        setNewFileTargetFolder(targetFolder);
        setActiveFolderSafe(targetFolder);
        setShowNewFileModal(true);
    }, [activeFolder, resolveActiveFolder, setActiveFolderSafe]);

    const createFolderAtPath = useCallback(async (folderPath?: string) => {
        const targetFolder = resolveActiveFolder(folderPath ?? activeFolder);
        setActiveFolderSafe(targetFolder);
        await createFolder(targetFolder);
    }, [activeFolder, createFolder, resolveActiveFolder, setActiveFolderSafe]);

    const openUploadFilePickerAt = useCallback((folderPath?: string) => {
        const targetFolder = resolveActiveFolder(folderPath ?? activeFolder);
        setActiveFolderSafe(targetFolder);
        setUploadTargetFolder(targetFolder);
        fileInputRef.current?.click();
    }, [activeFolder, resolveActiveFolder, setActiveFolderSafe, setUploadTargetFolder]);

    const openUploadFolderPickerAt = useCallback((folderPath?: string) => {
        const targetFolder = resolveActiveFolder(folderPath ?? activeFolder);
        setActiveFolderSafe(targetFolder);
        setUploadTargetFolder(targetFolder);
        folderInputRef.current?.click();
    }, [activeFolder, resolveActiveFolder, setActiveFolderSafe, setUploadTargetFolder]);

    const handleAddStInstructions = useCallback(async () => {
        setActiveFolderSafe(DEFAULT_FOLDER_NAME);
        await createStGuide();
    }, [createStGuide, setActiveFolderSafe]);

    useEffect(() => {
        const clearShortcutChord = () => {
            shortcutChordDeadlineRef.current = 0;
        };

        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            const hasPrimaryModifier = e.ctrlKey || e.metaKey;
            const chordActive = shortcutChordDeadlineRef.current > Date.now();
            const normalizedKey = e.key.toLowerCase();
            const matchesShortcut = (code: string, key: string) => e.code === code || normalizedKey === key;
            const hasBlockingOverlay = Boolean(
                dialogConfig
                || showNewFileModal
                || showNewWorkspaceModal
                || showMembersModal
                || showPasswordModal
                || showPricingModal
            );

            if (e.key === 'Escape' && showQuickSearch) {
                e.preventDefault();
                clearShortcutChord();
                closeQuickSearch();
                return;
            }

            if (chordActive) {
                if (matchesShortcut('KeyZ', 'z') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    handleToggleZenMode();
                    return;
                }
                if (!matchesShortcut('KeyK', 'k')) {
                    clearShortcutChord();
                }
            }

            if (hasBlockingOverlay || showQuickSearch || !hasPrimaryModifier) {
                return;
            }

            if (matchesShortcut('KeyK', 'k') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                shortcutChordDeadlineRef.current = Date.now() + 1500;
                return;
            }

            if (matchesShortcut('KeyP', 'p') && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openQuickSearch();
                return;
            }

            if (matchesShortcut('KeyN', 'n') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openNewFileModalAt();
                return;
            }

            if (matchesShortcut('KeyB', 'b') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                handleToggleSidebarCollapse();
                return;
            }

            if ((e.code === 'Backquote' || normalizedKey === '`' || normalizedKey === 'dead') && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                if (e.shiftKey) {
                    handleRequestNewTerminal();
                } else {
                    void openTerminal();
                }
            }
        };

        const handleWindowBlur = () => {
            clearShortcutChord();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [
        closeQuickSearch,
        dialogConfig,
        handleRequestNewTerminal,
        handleToggleSidebarCollapse,
        handleToggleZenMode,
        openNewFileModalAt,
        openQuickSearch,
        openTerminal,
        showMembersModal,
        showNewFileModal,
        showNewWorkspaceModal,
        showPasswordModal,
        showPricingModal,
        showQuickSearch
    ]);

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

    const docsByFolder = useMemo(() => {
        const grouped: Record<string, DocItem[]> = {};
        docs.forEach(docItem => {
            const folderName = normalizeFolderPath(docItem.folder);
            if (!grouped[folderName]) grouped[folderName] = [];
            grouped[folderName].push(docItem);
        });
        Object.values(grouped).forEach(list => {
            list.sort((a, b) => {
                const orderA = typeof a.order === 'number' ? a.order : null;
                const orderB = typeof b.order === 'number' ? b.order : null;
                if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
                if (orderA !== null && orderB === null) return -1;
                if (orderA === null && orderB !== null) return 1;
                const dateA = getUpdatedAtValue(a.updatedAt);
                const dateB = getUpdatedAtValue(b.updatedAt);
                if (dateA !== dateB) return dateB - dateA;
                return (a.name || '').localeCompare(b.name || '');
            });
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
                const orderA = typeof a.order === 'number' ? a.order : null;
                const orderB = typeof b.order === 'number' ? b.order : null;
                if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
                if (orderA !== null && orderB === null) return -1;
                if (orderA === null && orderB !== null) return 1;
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

    const formatPropertyDate = useCallback((value: unknown) => {
        const timestamp = getUpdatedAtValue(value);
        if (!timestamp) return 'No disponible';
        return new Intl.DateTimeFormat('es-ES', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(new Date(timestamp));
    }, []);

    const formatPropertySize = useCallback((size?: number) => {
        if (typeof size !== 'number' || Number.isNaN(size)) return 'No disponible';
        return `${new Intl.NumberFormat('es-ES').format(size)} bytes`;
    }, []);

    const showDocumentProperties = useCallback(async (doc: DocItem) => {
        await showDialog({
            type: DialogKind.Info,
            title: `Propiedades: ${doc.name}`,
            message: [
                `Tipo: ${getDocBadge(doc)}`,
                `Carpeta: ${normalizeFolderPath(doc.folder)}`,
                `Tamaño: ${formatPropertySize(doc.size)}`,
                `Actualizado: ${formatPropertyDate(doc.updatedAt)}`
            ].join(' | ')
        });
    }, [formatPropertyDate, formatPropertySize, showDialog]);

    const showFolderProperties = useCallback(async (folder: FolderItem) => {
        const directDocCount = docsByFolder[folder.path]?.length ?? 0;
        const directSubfolderCount = folderChildrenMap[folder.path]?.length ?? 0;
        const totalDocCount = docs.filter(doc => {
            const folderPath = normalizeFolderPath(doc.folder);
            return folderPath === folder.path || folderPath.startsWith(`${folder.path}/`);
        }).length;
        const totalSubfolderCount = folders.filter(candidate => (
            candidate.path !== folder.path && candidate.path.startsWith(`${folder.path}/`)
        )).length;
        const kindLabel = folder.kind === 'record' ? 'Carpeta' : folder.kind === 'system' ? 'Sistema' : 'Virtual';

        await showDialog({
            type: DialogKind.Info,
            title: `Propiedades: ${folder.name}`,
            message: [
                `Ruta: ${folder.path}`,
                `Tipo: ${kindLabel}`,
                `Subcarpetas directas: ${directSubfolderCount}`,
                `Archivos directos: ${directDocCount}`,
                `Archivos totales: ${totalDocCount}`,
                `Subcarpetas totales: ${totalSubfolderCount}`
            ].join(' | ')
        });
    }, [docs, docsByFolder, folderChildrenMap, folders, showDialog]);

    const showWorkspaceProperties = useCallback(async () => {
        await showDialog({
            type: DialogKind.Info,
            title: `Propiedades del espacio: ${currentWorkspace?.name || 'Espacio personal'}`,
            message: [
                `Tipo: ${currentWorkspace?.type === WorkspaceType.Personal ? 'Personal' : 'Colaborativo'}`,
                `ID: ${currentWorkspace?.id || PERSONAL_WORKSPACE_ID}`,
                `Carpetas: ${folders.length}`,
                `Archivos: ${docs.length}`
            ].join(' | ')
        });
    }, [currentWorkspace?.id, currentWorkspace?.name, currentWorkspace?.type, docs.length, folders.length, showDialog]);

    const showCurrentLocationProperties = useCallback(async () => {
        if (activeFolder === ROOT_FOLDER_PATH) {
            await showWorkspaceProperties();
            return;
        }

        const folder = folders.find(candidate => candidate.path === activeFolder);
        if (folder) {
            await showFolderProperties(folder);
            return;
        }

        await showDialog({
            type: DialogKind.Info,
            title: `Propiedades: ${activeFolder}`,
            message: `Ruta: ${activeFolder} | Archivos: ${docsByFolder[activeFolder]?.length ?? 0}`
        });
    }, [activeFolder, docsByFolder, folders, showDialog, showFolderProperties, showWorkspaceProperties]);

    const promptRenameFolder = useCallback(async (folder: FolderItem) => {
        if (folder.kind === 'system') {
            await showDialog({
                type: DialogKind.Info,
                title: 'No se puede renombrar',
                message: 'La carpeta del sistema no se puede renombrar.'
            });
            return;
        }

        if (!folder.docId) {
            await showDialog({
                type: DialogKind.Info,
                title: 'No se puede renombrar',
                message: 'Esta carpeta es virtual. Mueve sus archivos o crea una carpeta real para cambiar su estructura.'
            });
            return;
        }

        await promptRenameDocument({
            id: folder.docId,
            name: folder.name,
            type: 'folder',
            folder: folder.parentPath || DEFAULT_FOLDER_NAME,
            order: folder.order
        });
    }, [promptRenameDocument, showDialog]);

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
                        onClick={() => setActiveFolderSafe(folder.path)}
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
            setActiveFolderSafe(ROOT_FOLDER_PATH);
            return;
        }
        const exists = folders.some(folder => folder.path === activeFolder);
        if (!exists) {
            const rootFolders = folderChildrenMap[ROOT_FOLDER_PATH] ?? [];
            const fallback = rootFolders[0]?.path || ROOT_FOLDER_PATH;
            setActiveFolderSafe(fallback);
        }
    }, [folders, activeFolder, folderChildrenMap, setActiveFolderSafe]);

    const handleDocDragStart = (e: ReactDragEvent, docItem: DocItem) => {
        e.dataTransfer.setData('application/x-dashboard-internal-drag', 'doc');
        e.dataTransfer.setData('application/x-doc-id', docItem.id);
        e.dataTransfer.setData('text/plain', docItem.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDocDragEnd = () => {
        setFolderDragOver(null);
        setDropPosition(null);
    };

    const _handleDropZoneDragOver = (e: ReactDragEvent, position: number) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = types.includes('application/x-doc-reorder') || types.includes('application/x-folder-reorder');
        if (isReorderDrag) return;
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId || types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(prev => (prev === position ? prev : position));
    };

    const _handleDropZoneDragLeave = (e: ReactDragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
    };

    const _handleDropZoneDrop = (e: ReactDragEvent, position: number) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = types.includes('application/x-doc-reorder') || types.includes('application/x-folder-reorder');
        if (isReorderDrag) return;
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

    const handleFolderDragOver = (e: ReactDragEvent, folderName: string) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = types.includes('application/x-doc-reorder') || types.includes('application/x-folder-reorder');
        if (isReorderDrag) return;
        const hasFiles = types.includes('Files');
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (hasFiles) {
            e.preventDefault();
            setFolderDragOver(prev => (prev === folderName ? prev : folderName));
            return;
        }
        if (!hasDocId) return;
        e.preventDefault();
        setFolderDragOver(prev => (prev === folderName ? prev : folderName));
    };

    const handleFolderDragLeave = (folderName: string) => {
        if (folderDragOver === folderName) {
            setFolderDragOver(null);
        }
    };

    const handleFolderDrop = async (e: ReactDragEvent, folderName: string) => {
        const didUpload = await uploadDroppedFilesToFolder(e, folderName);
        if (didUpload) {
            setFolderDragOver(null);
            return;
        }
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = types.includes('application/x-doc-reorder') || types.includes('application/x-folder-reorder');
        if (isReorderDrag) return;
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId) return;
        const docId = e.dataTransfer.getData('application/x-doc-id') || e.dataTransfer.getData('text/plain');
        if (!docId) return;
        e.preventDefault();
        setFolderDragOver(null);
        await moveDocumentToFolder(docId, folderName);
    };

    const deleteDocument = async (docItem: DocItem, e: ReactMouseEvent) => {
        e.stopPropagation();
        if (deletingIds[docItem.id]) return;
        const confirmResult = await showDialog({
            type: DialogKind.Confirm,
            title: 'Eliminar elemento',
            message: 'Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        await deleteDocRecords([docItem.id], docItem.name);
    };

    const deleteDocuments = async (docItems: DocItem[]) => {
        const validDocs = docItems.filter(d => !deletingIds[d.id]);
        if (validDocs.length === 0) return;
        if (validDocs.length === 1) {
            return deleteDocument(validDocs[0] as DocItem, { stopPropagation: () => {} } as ReactMouseEvent);
        }

        const confirmResult = await showDialog({
            type: DialogKind.Confirm,
            title: 'Eliminar múltiples elementos',
            message: `¿Estás seguro de que deseas eliminar ${validDocs.length} elementos? Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        await deleteDocRecords(validDocs.map(d => d.id), `${validDocs.length} elementos`);
    };

    const getIcon = (doc: DocItem) => {
        if (doc.type === 'terminal') return <TerminalIcon className="w-5 h-5" />;
        if (doc.type === 'board') return <KanbanSquare className="w-5 h-5" />;
        if (doc.type === 'file') {
            if (doc.mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
            if (isMarkdownDocItem(doc)) return <FileText className="w-5 h-5" />;
            return <FileIcon className="w-5 h-5" />;
        }
        return <FileText className="w-5 h-5" />;
    };

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('sidebar-resizing-active', isResizingSidebar);
        if (isResizingSidebar) {
            document.body.style.cursor = 'col-resize';
        } else {
            document.body.style.cursor = '';
        }
        return () => {
            document.body.classList.remove('sidebar-resizing-active');
            document.body.style.cursor = '';
        };
    }, [isResizingSidebar]);

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
                {/* Global overlay during sidebar resizing to prevent iframe interference */}
                {isResizingSidebar && (
                    <div
                        className="fixed inset-0 z-[100] cursor-col-resize"
                        onMouseUp={stopResizingSidebar}
                    />
                )}
                <QuickSearchModal
                    open={showQuickSearch}
                    query={quickSearchQuery}
                    onQueryChange={setQuickSearchQuery}
                    results={semanticSearchResults}
                    loading={semanticSearchLoading}
                    errorMessage={semanticSearchError}
                    activeFilter={quickSearchFilter}
                    onFilterChange={setQuickSearchFilter}
                    selectedIndex={quickSearchIndex}
                    onSelectIndex={setQuickSearchIndex}
                    onClose={closeQuickSearch}
                    onSelect={(result) => {
                        void handleQuickSearchSelect(result);
                    }}
                    onKeyDown={handleQuickSearchKeyDown}
                    inputRef={quickSearchInputRef}
                    getDocumentIcon={(doc) => getIcon(doc as DocItem)}
                    modalFade={modalFade}
                    modalPop={modalPop}
                />

                <DragOverlay isDragActive={isDragActive} workspaceName={currentWorkspace?.name} activeFolder={activeFolder} />
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
                <NewFileModal
                    open={showNewFileModal}
                    onClose={() => setShowNewFileModal(false)}
                    onSelect={(kind: FileKind) => {
                        setShowNewFileModal(false);
                        if (kind === 'st') {
                            void createStDoc(newFileTargetFolder);
                        } else {
                            void createDoc(undefined, newFileTargetFolder);
                        }
                    }}
                    modalFade={modalFade}
                    modalPop={modalPop}
                />

                {!isHeaderCollapsed && (
                    <HeaderBar
                        onToggleMobileSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
                        onClearSelectedDoc={() => setSelectedDocId(null)}
                        isZenMode={isZenMode}
                        onToggleHeaderCollapse={handleToggleHeaderCollapse}
                        onToggleZenMode={handleToggleZenMode}
                        showWorkspaceMenu={showWorkspaceMenu}
                        setShowWorkspaceMenu={setShowWorkspaceMenu}
                        currentWorkspace={currentWorkspace}
                        invites={invites}
                        workspaces={workspaces}
                        user={user}
                        isOnline={isOnline}
                        deletingWorkspaceId={deletingWorkspaceId}
                        personalWorkspaceId={PERSONAL_WORKSPACE_ID}
                        isAdmin={isAdmin}
                        isBoardOpen={isBoardOpen}
                        onOpenBoard={openBoard}
                        isStRunnerOpen={isStRunnerOpen}
                        onOpenStRunner={openStRunner}
                        isSemanticBrowserOpen={isSemanticBrowserOpen}
                        onOpenSemanticBrowser={openSemanticBrowser}
                        isFormalizerOpen={isFormalizerOpen}
                        onOpenFormalizer={openFormalizer}
                        formalizerTileId={formalizerTabId}
                        onOpenSnippetsGallery={openSnippetsGallery}
                        onOpenQuickSearch={openQuickSearch}
                        onAcceptInvite={acceptInvite}
                        onSelectWorkspace={selectWorkspace}
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
                        connectionStatus={connectionStatus}
                        isCreatingSession={isCreatingSession}
                        activeSessionId={activeSessionId}
                        getWorkerStatusForWorkspace={getWorkerStatusForWorkspace}
                        getSessionsForWorkspace={getSessionsForWorkspace}
                        createSession={createSession}
                        selectSession={selectSession}
                        destroySession={destroySession}
                        onRenameSession={promptRenameTerminalSession}
                        onAddStInstructions={() => { void handleAddStInstructions(); }}
                        openTerminal={openTerminal}
                        openTabs={openTabs}
                        closeTabById={closeTabById}
                        fileInputRef={fileInputRef}
                        folderInputRef={folderInputRef}
                        handleFileUpload={handleFileUpload}
                        handleFolderUpload={handleFolderUpload}
                        folderInputProps={folderInputProps}
                        openFilesTab={openFilesTab}
                        onOpenPricing={() => setShowPricingModal(true)}
                        currentPlanName={PLANS[currentPlan]?.name}
                    />
                )}

                {isHeaderCollapsed && !isZenMode && (
                    <div className="absolute top-2 left-2 z-50">
                        <button
                            onClick={handleToggleHeaderCollapse}
                            className="flex items-center gap-2 px-3 py-1.5 bg-surface-800/90 border border-surface-600/60 rounded-full text-xs text-surface-200 hover:text-white hover:border-mandy-500/40 hover:bg-surface-700/80 transition shadow-xl shadow-black/30 backdrop-blur"
                            title="Mostrar barra superior"
                        >
                            <ChevronDown className="w-4 h-4" />
                            <span className="hidden sm:inline">Mostrar barra superior</span>
                        </button>
                    </div>
                )}

                {isSidebarCollapsed && !isZenMode && (
                    <div className="absolute bottom-3 left-2 z-50">
                        <button
                            onClick={handleToggleSidebarCollapse}
                            className="flex items-center justify-center w-8 h-8 bg-surface-800/90 border border-surface-600/60 rounded-full text-surface-300 hover:text-white hover:border-mandy-500/40 hover:bg-surface-700/80 transition shadow-xl shadow-black/30 backdrop-blur"
                            title="Mostrar panel de archivos (Ctrl+B)"
                            aria-label="Mostrar panel de archivos"
                        >
                            <PanelLeftOpen className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {isZenMode && (
                    <div className="absolute bottom-3 right-3 z-50">
                        <button
                            onClick={handleToggleZenMode}
                            className="flex items-center justify-center w-10 h-10 bg-surface-800/90 border border-mandy-500/40 rounded-full text-mandy-200 hover:text-white hover:border-mandy-500/70 transition shadow-xl shadow-black/30 backdrop-blur"
                            title="Salir de modo Zen (Ctrl+K Z)"
                            aria-label="Salir de modo Zen"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="flex flex-1 overflow-hidden relative">
                    <Sidebar
                        sidebarWidth={sidebarWidth}
                        isCollapsed={isSidebarCollapsed}
                        showMobileSidebar={showMobileSidebar}
                        onCloseMobileSidebar={() => setShowMobileSidebar(false)}
                        onToggleSidebarCollapse={handleToggleSidebarCollapse}
                        currentWorkspace={currentWorkspace}
                        activeFolder={activeFolder}
                        setActiveFolder={setActiveFolderSafe}
                        folders={folders}
                        loadingDocs={loadingDocs}
                        docs={docs}
                        sidebarSearchQuery={sidebarSearchQuery}
                        setSidebarSearchQuery={setSidebarSearchQuery}
                        sidebarFilteredDocs={sidebarFilteredDocs}
                        selectedDocId={selectedDocId}
                        favoriteDocs={favoriteDocs}
                        favoriteDocIds={favoriteDocIds}
                        openDocument={openDocument}
                        onToggleFavorite={toggleFavoriteDoc}
                        onMoveFavorite={moveFavoriteDoc}
                        handleDocDragStart={handleDocDragStart}
                        handleDocDragEnd={handleDocDragEnd}
                        deleteDocument={deleteDocument}
                        onDeleteDocuments={deleteDocuments}
                        onRenameDocument={promptRenameDocument}
                        onDownloadDoc={handleDownloadDoc}
                        getIcon={getIcon}
                        folderDragOver={folderDragOver}
                        onFolderDragOver={handleFolderDragOver}
                        onFolderDrop={handleFolderDrop}
                        onFolderDragLeave={handleFolderDragLeave}
                        onCreateDoc={() => openNewFileModalAt()}
                        onCreateFolder={() => { void createFolderAtPath(); }}
                        onCreateDocInFolder={openNewFileModalAt}
                        onCreateFolderInFolder={(folderPath) => { void createFolderAtPath(folderPath); }}
                        onUploadFile={() => openUploadFilePickerAt()}
                        onUploadFolder={() => openUploadFolderPickerAt()}
                        onUploadFileToFolder={openUploadFilePickerAt}
                        onUploadFolderToFolder={openUploadFolderPickerAt}
                        onShowDocProperties={(doc) => { void showDocumentProperties(doc); }}
                        onShowFolderProperties={(folder) => { void showFolderProperties(folder); }}
                        onShowCurrentLocationProperties={() => { void showCurrentLocationProperties(); }}
                        onRenameFolder={(folder) => { void promptRenameFolder(folder); }}
                        onDeleteFolder={(folder) => { void deleteFolder(folder); }}
                    />

                    {/* Resize Handle */}
                    {!isSidebarCollapsed && (
                        <div
                            onMouseDown={startResizingSidebar}
                            className={`hidden md:block w-1.5 h-full cursor-col-resize absolute z-50 hover:bg-mandy-500/40 transition-colors ${isResizingSidebar ? 'bg-mandy-500' : 'bg-transparent'}`}
                            style={{ left: sidebarWidth - 3 }}
                        />
                    )}

                    <div
                        className="flex-1 flex flex-col bg-surface-900 overflow-hidden relative"
                        onDragOver={(e) => {
                            if (!mosaicNode) {
                                const types = Array.from(e.dataTransfer.types ?? []);
                                if (types.includes('application/x-doc-id')) {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                }
                            }
                        }}
                        onDrop={(e) => {
                            if (!mosaicNode) {
                                const types = Array.from(e.dataTransfer.types ?? []);
                                if (types.includes('application/x-doc-id')) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const docId = e.dataTransfer.getData('application/x-doc-id');
                                    if (docId) handleDropDocOnEmpty(docId);
                                }
                            }
                        }}
                    >
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
                                    onActivateTab={setSelectedDocId}
                                    onDropDocOnTile={handleDropDocOnTile}
                                    onDropDocOnEmpty={handleDropDocOnEmpty}
                                    onCreateFile={() => openNewFileModalAt()}
                                    onCreateStFile={() => openNewFileModalAt()}
                                    onCreateFolder={() => { void createFolderAtPath(); }}
                                    onUploadFile={() => {
                                        openUploadFilePickerAt(activeFolder);
                                    }}
                                    onUploadFolder={() => {
                                        openUploadFolderPickerAt(activeFolder);
                                    }}
                                    onDeleteDoc={(docId) => {
                                        const doc = docs.find(d => d.id === docId);
                                        if (doc) deleteDocument(doc, { stopPropagation: () => { } } as ReactMouseEvent);
                                    }}
                                    onDeleteFolder={deleteFolder}
                                    onDeleteItems={deleteItems}
                                    onDuplicateDoc={copyDocument}
                                    onMoveDoc={moveDocumentToFolder}
                                    onRenameDoc={promptRenameDocument}
                                    onRenameDocInline={renameDocument}
                                    onDownloadDoc={handleDownloadDoc}
                                    favoriteDocIds={favoriteDocIds}
                                    onToggleFavorite={toggleFavoriteDoc}
                                    onDownloadFolder={handleDownloadFolder}
                                    onReorderDocs={reorderDocsInFolder}
                                    onReorderFolders={reorderFoldersInParent}
                                    activeFolder={activeFolder}
                                    onActiveFolderChange={setActiveFolderSafe}
                                    currentWorkspaceName={currentWorkspace?.name}
                                    currentWorkspaceId={currentWorkspace?.id}
                                    currentWorkspaceType={currentWorkspace?.type}
                                    currentUserId={user?.uid}
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
                                onActiveFolderChange={setActiveFolderSafe}
                                onOpenDocument={openDocument}
                                onCreateDoc={() => openNewFileModalAt()}
                                onCreateStDoc={() => openNewFileModalAt()}
                                onCreateFolder={() => { void createFolderAtPath(); }}
                                onCreateDocInFolder={openNewFileModalAt}
                                onCreateFolderInFolder={(folderPath) => { void createFolderAtPath(folderPath); }}
                                onUploadFile={() => openUploadFilePickerAt(activeFolder)}
                                onUploadFolder={() => openUploadFolderPickerAt(activeFolder)}
                                onUploadFileToFolder={openUploadFilePickerAt}
                                onUploadFolderToFolder={openUploadFolderPickerAt}
                                onCopyWorkspaceId={(id) => {
                                    navigator.clipboard.writeText(id);
                                    showDialog({ type: DialogKind.Info, title: 'ID copiado', message: id });
                                }}
                                onCopyDocument={copyDocument}
                                onMoveDocument={promptMoveDocument}
                                onDeleteDocument={deleteDocument}
                                onRenameDocument={promptRenameDocument}
                                onShowDocProperties={(doc) => { void showDocumentProperties(doc); }}
                                onShowFolderProperties={(folder) => { void showFolderProperties(folder); }}
                                onShowCurrentLocationProperties={() => { void showCurrentLocationProperties(); }}
                                onRenameFolder={(folder) => { void promptRenameFolder(folder); }}
                                onDeleteFolder={(folder) => { void deleteFolder(folder); }}
                                onReorderDocs={reorderDocsInFolder}
                                onReorderFolders={reorderFoldersInParent}
                                getIcon={getIcon}
                                getDocBadge={getDocBadge}
                                personalWorkspaceId={PERSONAL_WORKSPACE_ID}
                                rootFolderPath={ROOT_FOLDER_PATH}
                                defaultFolderName={DEFAULT_FOLDER_NAME}
                            />
                        )}
                    </div>
                </div>

                <NewWorkspaceModal
                    isOpen={showNewWorkspaceModal}
                    onClose={() => setShowNewWorkspaceModal(false)}
                    workspaceName={newWorkspaceName}
                    setWorkspaceName={setNewWorkspaceName}
                    onCreate={createWorkspace}
                    modalFade={modalFade}
                />

                {currentWorkspace && (
                    <MembersModal
                        isOpen={showMembersModal}
                        onClose={() => setShowMembersModal(false)}
                        currentWorkspace={currentWorkspace}
                        user={user}
                        memberProfiles={memberProfiles}
                        inviteEmail={inviteEmail}
                        setInviteEmail={setInviteEmail}
                        inviteMember={inviteMember}
                        removeMember={removeMember}
                        modalFade={modalFade}
                    />
                )}

                <ChangePasswordModal
                    isOpen={showPasswordModal}
                    onClose={() => setShowPasswordModal(false)}
                    passwordForm={passwordForm}
                    setPasswordForm={setPasswordForm}
                    passwordError={passwordError}
                    setPasswordError={setPasswordError}
                    passwordSuccess={passwordSuccess}
                    setPasswordSuccess={setPasswordSuccess}
                    isChangingPassword={isChangingPassword}
                    setIsChangingPassword={setIsChangingPassword}
                    changePassword={changePassword}
                    modalFade={modalFade}
                    modalPop={modalPop}
                />

                <PricingModal
                    isOpen={showPricingModal}
                    onClose={() => setShowPricingModal(false)}
                    currentPlan={currentPlan}
                    userEmail={userEmail}
                    endDate={subscriptionEndDate}
                />
                <style jsx global>{`
                    body.sidebar-resizing-active,
                    body.sidebar-resizing-active * {
                        user-select: none !important;
                        cursor: col-resize !important;
                    }
                `}</style>
            </div>
        </LazyMotion>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}>
            <DashboardContent />
        </Suspense>
    );
}
