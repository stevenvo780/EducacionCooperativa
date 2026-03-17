'use client';

import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTerminal, type TerminalSession } from '@/context/TerminalContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, FileText, Folder, Image as ImageIcon, File as FileIcon, KanbanSquare, Key, Loader2, Minimize2, PanelLeftOpen, Shield, Terminal as TerminalIcon, Trash2, Users, X } from 'lucide-react';
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
    fetchCurrentUserApi,
    deleteDocumentApi,
    deleteWorkspaceApi,
    downloadDocumentBlobApi,
    fetchDocumentRawApi,
    inviteMemberApi,
    removeMemberApi,
    updateDocumentApi,
    uploadFileApi,
    fetchUserProfilesApi
} from '@/services/dashboardApi';
import { areDocsEquivalent, areFoldersEquivalent, getUpdatedAtValue } from '@/services/dashboardUtils';
import { getDocBadge, isMarkdownDocItem } from '@/services/dashboardDocUtils';
import { clearDashboardState, loadFavoriteDocIds, MAX_FAVORITE_DOCS, saveFavoriteDocIds } from '@/services/dashboardPersistence';
import { useDashboardUploads } from '@/hooks/dashboard/useDashboardUploads';
import { useDashboardPersistence } from '@/hooks/dashboard/useDashboardPersistence';
import QuickSearchModal from '@/components/dashboard/QuickSearchModal';
import StatusToasts from '@/components/dashboard/StatusToasts';
import DialogModal from '@/components/dashboard/DialogModal';
import DragOverlay from '@/components/dashboard/DragOverlay';
import HeaderBar from '@/components/dashboard/HeaderBar';
import Sidebar from '@/components/dashboard/Sidebar';
import WorkspaceExplorer from '@/components/dashboard/WorkspaceExplorer';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { fetchSubscriptionStatus, verifyPayment } from '@/services/subscriptionApi';
import { type PlanId, PLANS, canAccessTerminals } from '@/types/subscription';
import PricingModal from '@/components/dashboard/PricingModal';
import { useDashboardWorkspaces } from '@/hooks/dashboard/useDashboardWorkspaces';
import { useDashboardDocsSync } from '@/hooks/dashboard/useDashboardDocsSync';
import { semanticSearchApi } from '@/services/searchApi';
import type { SearchResultFilter, SearchResultItem } from '@/lib/search/types';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });
const MosaicLayout = dynamic(() => import('@/components/MosaicLayout'), { ssr: false });
const FileExplorer = dynamic(() => import('@/components/FileExplorer'), { ssr: false });

const PERSONAL_WORKSPACE_ID = 'personal';
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
    const [currentPlan, setCurrentPlan] = useState<PlanId>('free');
    const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
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
            } catch (error) {
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

    // Load subscription status
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        fetchSubscriptionStatus()
            .then((sub) => {
                if (!cancelled && sub?.planId) {
                    setCurrentPlan(sub.status === 'active' ? sub.planId : 'free');
                    setSubscriptionEndDate(sub.status === 'active' && sub.endDate ? sub.endDate : null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCurrentPlan('free');
                    setSubscriptionEndDate(null);
                }
            });
        return () => { cancelled = true; };
    }, [user]);

    // Handle payment callback from MercadoPago
    useEffect(() => {
        const paymentStatus = searchParams?.get('payment');
        if (paymentStatus === 'success' || paymentStatus === 'pending') {
            // First try to verify/activate the payment
            verifyPayment()
                .then((result) => {
                    if (result.status === 'active' && result.planId) {
                        setCurrentPlan(result.planId as PlanId);
                    } else {
                        // Fallback: fetch subscription status
                        return fetchSubscriptionStatus();
                    }
                })
                .then((sub) => {
                    if (sub && 'planId' in sub) {
                        setCurrentPlan(sub.status === 'active' ? sub.planId : 'free');
                        setSubscriptionEndDate(sub.status === 'active' && sub.endDate ? sub.endDate : null);
                    }
                })
                .catch(() => {
                    // Last resort: just fetch status
                    fetchSubscriptionStatus()
                        .then((sub) => {
                            if (sub?.planId) {
                                setCurrentPlan(sub.status === 'active' ? sub.planId : 'free');
                                setSubscriptionEndDate(sub.status === 'active' && sub.endDate ? sub.endDate : null);
                            }
                        })
                        .catch(() => {});
                });
        }
    }, [searchParams]);

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
        const wsId = currentWorkspace.id === PERSONAL_WORKSPACE_ID ? 'personal' : currentWorkspace.id;
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
    const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);
    const [dialogInputValue, setDialogInputValue] = useState('');
    const [activeFolder, setActiveFolder] = useState<string>(ROOT_FOLDER_PATH);
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const zenRestoreRef = useRef({ sidebar: false, header: false });
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
    const [dropPosition, setDropPosition] = useState<number | null>(null);
    const [mosaicNode, setMosaicNode] = useState<MosaicNode<string> | null>(null);
    const [semanticSearchResults, setSemanticSearchResults] = useState<SearchResultItem[]>([]);
    const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);
    const [semanticSearchError, setSemanticSearchError] = useState<string | null>(null);
    const [quickSearchFilter, setQuickSearchFilter] = useState<SearchResultFilter>('all');

    const quickSearchInputRef = useRef<HTMLInputElement>(null);
    const deferredQuickSearchQuery = useDeferredValue(quickSearchQuery);
    const deferredDocs = useDeferredValue(docs);
    const deferredSidebarQuery = useDeferredValue(sidebarSearchQuery);

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
    const foldersRef = useRef<FolderItem[]>([]);
    const currentWorkspaceRef = useRef<Workspace | null>(null);
    const dialogResolverRef = useRef<((result: DialogResult) => void) | null>(null);
    const folderInputProps = { webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>;

    useEffect(() => {
        docsRef.current = docs;
    }, [docs]);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    useEffect(() => {
        currentWorkspaceRef.current = currentWorkspace;
    }, [currentWorkspace]);

    useEffect(() => {
        return () => {
            if (deleteStatusTimer.current) {
                clearTimeout(deleteStatusTimer.current);
                deleteStatusTimer.current = null;
            }
        };
    }, []);

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
                type: 'error',
                title: 'Error',
                message: 'No se pudo obtener el email del usuario. Por favor, inicia sesión de nuevo.'
            });
            return;
        }
        try {
            await acceptInviteApi({ workspaceId: ws.id, userId: user.uid, email: userEmail });
            await fetchWorkspaces();
            await showDialog({
                type: 'info',
                title: 'Invitación aceptada',
                message: '¡Te has unido al espacio!'
            });
        } catch (e) {
            await showDialog({
                type: 'error',
                title: 'Error al unirse',
                message: e instanceof Error ? e.message : 'Error desconocido'
            });
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
            if (changed && process.env.NODE_ENV !== 'production') {
                console.debug('[Sync] docs updated:', prev.length, '->', normalizedFileDocs.length);
            }
            return changed ? normalizedFileDocs : prev;
        });
        setFolders(prev => {
            const changed = !areFoldersEquivalent(prev, folderList);
            if (changed && process.env.NODE_ENV !== 'production') {
                console.debug('[Sync] folders updated:', prev.length, '->', folderList.length);
            }
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
                setQuickSearchFilter('all');
                setSemanticSearchError(null);
                setSemanticSearchResults([]);
                setTimeout(() => quickSearchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape' && showQuickSearch) {
                setShowQuickSearch(false);
                setQuickSearchQuery('');
                setQuickSearchIndex(0);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showQuickSearch, setQuickSearchIndex, setQuickSearchQuery, setShowQuickSearch]);

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

    const buildLocalQuickSearchFallback = useCallback((query: string): SearchResultItem[] => {
        const normalizedQuery = query.trim().toLowerCase();
        const fallbackDocs = docs
            .filter(doc => doc.type !== 'folder')
            .filter(doc => {
                if (!normalizedQuery) return true;
                const name = doc.name.toLowerCase();
                const folder = (doc.folder || '').toLowerCase();
                return name.includes(normalizedQuery) || folder.includes(normalizedQuery);
            })
            .slice(0, normalizedQuery ? 12 : 8);

        return fallbackDocs.map((doc, index) => ({
            id: `fallback-document:${doc.id}:${index}`,
            kind: 'document',
            title: doc.name,
            subtitle: doc.folder || 'Raiz del espacio',
            preview: doc.mimeType || 'Documento',
            badge: 'DOC',
            score: fallbackDocs.length - index,
            matchedTerms: normalizedQuery ? [normalizedQuery] : [],
            sourceDoc: {
                id: doc.id,
                name: doc.name,
                type: doc.type,
                folder: doc.folder,
                workspaceId: doc.workspaceId,
                mimeType: doc.mimeType,
                url: doc.url,
                storagePath: doc.storagePath,
                ownerId: doc.ownerId,
                updatedAt: doc.updatedAt,
                size: doc.size
            }
        }));
    }, [docs]);

    useEffect(() => {
        if (!showQuickSearch || !currentWorkspace) {
            setSemanticSearchLoading(false);
            return;
        }

        const controller = new AbortController();
        const query = deferredQuickSearchQuery.trim();
        const timeout = setTimeout(() => {
            setSemanticSearchLoading(true);
            setSemanticSearchError(null);

            semanticSearchApi(
                {
                    query,
                    workspaceId: currentWorkspace.id,
                    limit: 18
                },
                { signal: controller.signal }
            )
                .then(data => {
                    if (controller.signal.aborted) return;
                    setSemanticSearchResults(data.results);
                })
                .catch(error => {
                    if (controller.signal.aborted) return;
                    const aborted = error instanceof DOMException && error.name === 'AbortError';
                    if (aborted) return;
                    setSemanticSearchError('Se mostró una búsqueda local de respaldo porque el índice semántico no respondió.');
                    setSemanticSearchResults(buildLocalQuickSearchFallback(query));
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setSemanticSearchLoading(false);
                    }
                });
        }, query ? 140 : 0);

        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [buildLocalQuickSearchFallback, currentWorkspace, deferredQuickSearchQuery, showQuickSearch]);

    const quickSearchResults = useMemo(() => {
        if (quickSearchFilter === 'all') return semanticSearchResults;
        return semanticSearchResults.filter(result => result.kind === quickSearchFilter);
    }, [quickSearchFilter, semanticSearchResults]);

    const closeQuickSearch = useCallback(() => {
        setShowQuickSearch(false);
        setQuickSearchQuery('');
        setQuickSearchIndex(0);
    }, [setQuickSearchIndex, setQuickSearchQuery, setShowQuickSearch]);

    const handleQuickSearchSelect = useCallback(async (result: SearchResultItem) => {
        const docFromState = docs.find(item => item.id === result.sourceDoc.id);
        const sourceDoc = docFromState ?? result.sourceDoc as DocItem;
        await openDocumentRef.current(sourceDoc);
        closeQuickSearch();
    }, [closeQuickSearch, docs]);

    const handleQuickSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' && quickSearchResults.length > 0) {
            e.preventDefault();
            setQuickSearchIndex(Math.min(quickSearchIndex + 1, quickSearchResults.length - 1));
        } else if (e.key === 'ArrowUp' && quickSearchResults.length > 0) {
            e.preventDefault();
            setQuickSearchIndex(Math.max(quickSearchIndex - 1, 0));
        } else if (e.key === 'Enter' && quickSearchResults[quickSearchIndex]) {
            e.preventDefault();
            void handleQuickSearchSelect(quickSearchResults[quickSearchIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeQuickSearch();
        }
    };

    useEffect(() => {
        if (!showQuickSearch) return;
        if (quickSearchResults.length === 0 && quickSearchIndex !== 0) {
            setQuickSearchIndex(0);
            return;
        }
        if (quickSearchIndex >= quickSearchResults.length && quickSearchResults.length > 0) {
            setQuickSearchIndex(quickSearchResults.length - 1);
        }
    }, [quickSearchIndex, quickSearchResults, setQuickSearchIndex, showQuickSearch]);

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

    const openTerminal = async (session?: { id: string; name?: string }) => {
        // Verificar si el plan actual permite terminales
        if (!canAccessTerminals(currentPlan)) {
            setShowPricingModal(true);
            return;
        }

        const terminalId = session ? `terminal-${session.id}` : 'terminal-main';
        const terminalName = session?.name || 'Mi Asistente';

        if (session?.id) {
            // Check if any existing tab already has this sessionId (prevent duplicates by session)
            const existingTab = openTabs.find(t => t.type === 'terminal' && t.sessionId === session.id);
            if (existingTab) {
                selectSession(session.id);
                setSelectedDocId(existingTab.id);
                setShowMobileSidebar(false);
                return;
            }

            // If terminal-main exists (lobby tab), replace it with the session-specific tab
            const mainTab = openTabs.find(t => t.id === 'terminal-main');
            if (mainTab) {
                selectSession(session.id);
                setOpenTabs(prev => prev.map(t =>
                    t.id === 'terminal-main'
                        ? { ...t, id: terminalId, name: terminalName, sessionId: session.id }
                        : t
                ));
                // Update mosaic node IDs
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
            // Opening without a session — if there's already a terminal tab open, focus it instead
            const anyTerminal = openTabs.find(t => t.type === 'terminal');
            if (anyTerminal) {
                setSelectedDocId(anyTerminal.id);
                setShowMobileSidebar(false);
                return;
            }
        }

        // Tab already open with this exact ID
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

        // Don't do anything if a tab for this session already exists
        if (openTabs.find(t => t.id === terminalId)) return;

        const mainTab = openTabs.find(t => t.id === 'terminal-main' && t.type === 'terminal');
        if (mainTab) {
            // terminal-main is open → replace it with the session-specific tab
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
            // No terminal-main → session was created from an existing terminal → open as new tab
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
    }, [activeSessionId, terminalSessions, openTabs, selectSession, user?.uid]);

    const handleRequestNewTerminal = useCallback(() => {
        if (!currentWorkspace || !user) return;
        const workerToken = currentWorkspace.type === 'personal' || currentWorkspace.id === 'personal'
            ? `personal:${user.uid}`
            : currentWorkspace.id;
        const workspaceSessions = getSessionsForWorkspace(workerToken);
        createSession(workerToken, currentWorkspace.type, `Terminal ${workspaceSessions.length + 1}`);
    }, [currentWorkspace, user, createSession, getSessionsForWorkspace]);

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
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]);

    openBoardRef.current = openBoard;

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
    }, [currentWorkspace, user, openTabs, setShowMobileSidebar]);

    const closeTabById = useCallback(async (docId: string) => {
        if (currentWorkspace && docId === `files-${currentWorkspace.id}`) {
            setClosedFilesTabByWorkspace(prev => ({ ...prev, [currentWorkspace.id]: true }));
        }

        setOpenTabs(prev => {
            const tabToClose = prev.find(t => t.id === docId);
            // If closing a terminal tab, clear activeSessionId so the
            // auto-open useEffect does not re-create it immediately.
            // The session stays alive in the backend — user can reopen
            // it from the topbar session list at any time.
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
    }, [selectedDocId, currentWorkspace, clearActiveSession]);

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

        return {
            ...node,
            first,
            second
        };
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

        return null;
    }, [docs, openTabs, terminalSessions, user?.uid]);

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
    }, [clearActiveSession, openTabs, removeLeafId, replaceLeafId, selectedDocId, setShowMobileSidebar, setActiveFolderSafe]);

    const openDocument = useCallback(async (doc: DocItem) => {
        await openDocumentInTile(doc, null);
    }, [openDocumentInTile]);

    openDocumentRef.current = openDocument;
    openDocumentInTileRef.current = openDocumentInTile;

    const handleDropDocOnTile = useCallback(async (droppedDocId: string, targetTileId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'replace') => {
        if (droppedDocId === targetTileId) return;
        const droppedDoc = resolveDraggableDoc(droppedDocId);
        if (!droppedDoc || droppedDoc.type === 'folder') return;

        const targetTab = openTabs.find(t => t.id === targetTileId);
        const isAlreadyOpen = openTabs.some(t => t.id === droppedDocId);

        // Ensure the doc is in openTabs
        if (!isAlreadyOpen) {
            setOpenTabs(prev => [...prev.filter(t => t.id !== droppedDocId), droppedDoc]);
        }

        if (position === 'replace') {
            // Replace target tile
            if (targetTab?.type === 'terminal' && targetTab.sessionId) {
                clearActiveSession();
            }
            if (isAlreadyOpen) {
                // Swap the two tiles
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
            // Split: create a new split alongside the target
            if (isAlreadyOpen) {
                // Remove from old position first, then split the target
                setMosaicNode(current => {
                    if (!current) return droppedDocId;
                    // Remove the dropped doc from its current position by replacing it
                    // with a marker, then clean the tree
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
    }, [openTabs, clearActiveSession, replaceLeafId, resolveDraggableDoc, splitLeafInTree]);

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
    }, [openTabs, resolveDraggableDoc, setShowMobileSidebar]);

    const showDialog = useCallback((config: DialogConfig) => {
        return new Promise<DialogResult>((resolve) => {
            setDialogConfig(config);
            setDialogInputValue(config.defaultValue ?? '');
            dialogResolverRef.current = resolve;
        });
    }, []);

    const toggleFavoriteDoc = useCallback(async (doc: DocItem) => {
        setFavoriteDocIds(prev => {
            if (prev.includes(doc.id)) {
                return prev.filter(docId => docId !== doc.id);
            }

            if (prev.length >= MAX_FAVORITE_DOCS) {
                void showDialog({
                    type: 'info',
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
            await requestDocsRefresh();
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
            await requestDocsRefresh();
        } catch (error) {
            console.error('Error moving document', error);
            await requestDocsRefresh({ force: true });
        }
    };

    const renameDocument = async (doc: DocItem, nextName: string) => {
        const trimmed = (nextName || '').trim();
        if (!trimmed || trimmed === doc.name) return;

        const parentPath = normalizeFolderPath(doc.folder);

        const duplicate = docsRef.current.some(item => (
            item.id !== doc.id
            && normalizeFolderPath(item.folder) === parentPath
            && (item.name || '').toLowerCase() === trimmed.toLowerCase()
            && item.type === doc.type
        ));

        if (duplicate) {
            await showDialog({
                type: 'info',
                title: 'Nombre en uso',
                message: `Ya existe un elemento llamado "${trimmed}" en esta ubicación.`
            });
            return;
        }

        let oldFullPath = '';
        let newFullPath = '';
        let childrenToUpdate: DocItem[] = [];

        if (doc.type === 'folder') {
            oldFullPath = parentPath === DEFAULT_FOLDER_NAME ? doc.name : `${parentPath}/${doc.name}`;
            newFullPath = parentPath === DEFAULT_FOLDER_NAME ? trimmed : `${parentPath}/${trimmed}`;

            childrenToUpdate = docsRef.current.filter(d => {
                const f = normalizeFolderPath(d.folder);
                return f === oldFullPath || f.startsWith(`${oldFullPath}/`);
            });
        }

        setDocs(prev => prev.map(item => {
            if (item.id === doc.id) {
                return { ...item, name: trimmed };
            }
            if (doc.type === 'folder' && childrenToUpdate.some(c => c.id === item.id)) {
                const oldFolder = normalizeFolderPath(item.folder);
                let newFolder = oldFolder;
                if (oldFolder === oldFullPath) {
                    newFolder = newFullPath;
                } else if (oldFolder.startsWith(`${oldFullPath}/`)) {
                    newFolder = newFullPath + oldFolder.substring(oldFullPath.length);
                }
                return { ...item, folder: newFolder };
            }
            return item;
        }));

        setOpenTabs(prev => prev.map(item => item.id === doc.id ? { ...item, name: trimmed } : item));

        try {
            await updateDocumentApi(doc.id, { name: trimmed });

            if (doc.type === 'folder' && childrenToUpdate.length > 0) {
                 await Promise.all(childrenToUpdate.map(child => {
                    const oldFolder = normalizeFolderPath(child.folder);
                    let newFolder = oldFolder;
                    if (oldFolder === oldFullPath) {
                        newFolder = newFullPath;
                    } else if (oldFolder.startsWith(`${oldFullPath}/`)) {
                        newFolder = newFullPath + oldFolder.substring(oldFullPath.length);
                    }
                    return updateDocumentApi(child.id, { folder: newFolder });
                }));
            }

            await requestDocsRefresh();
        } catch (error) {
            await requestDocsRefresh({ force: true });
            await showDialog({
                type: 'error',
                title: 'No se pudo renombrar',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    const promptRenameDocument = async (doc: DocItem) => {
        const result = await showDialog({
            type: 'input',
            title: 'Renombrar archivo',
            message: 'Ingresa el nuevo nombre para el archivo',
            defaultValue: doc.name,
            placeholder: 'Nuevo nombre'
        });

        if (!result.confirmed) return;
        const nextName = (result.value ?? '').trim();
        if (!nextName) return;
        await renameDocument(doc, nextName);
    };

    const promptRenameTerminalSession = useCallback(async (session: TerminalSession) => {
        const result = await showDialog({
            type: 'input',
            title: 'Renombrar sesion',
            message: 'Ingresa el nuevo nombre para la sesion',
            defaultValue: session.name ?? '',
            placeholder: 'Nombre de sesion'
        });

        if (!result.confirmed) return;
        const nextName = (result.value ?? '').trim();
        if (!nextName || nextName === (session.name ?? '').trim()) return;

        renameSession(session.id, nextName);
        setOpenTabs(prev => prev.map(tab => (
            tab.type === 'terminal' && tab.sessionId === session.id ? { ...tab, name: nextName } : tab
        )));
    }, [renameSession, showDialog]);

    const reorderDocsInFolder = useCallback(async (payload: { folderPath: string; orderedIds: string[] }) => {
        if (!payload.orderedIds.length) return;
        const orderUpdates = payload.orderedIds.map((id, index) => ({ id, order: (index + 1) * 1000 }));
        const updates = orderUpdates.filter(update => {
            const existing = docsRef.current.find(doc => doc.id === update.id);
            return existing?.order !== update.order;
        });
        if (updates.length === 0) return;

        const orderMap = new Map(updates.map(update => [update.id, update.order]));
        setDocs(prev => prev.map(doc => {
            const nextOrder = orderMap.get(doc.id);
            return typeof nextOrder === 'number' ? { ...doc, order: nextOrder } : doc;
        }));

        try {
            await Promise.all(updates.map(update => updateDocumentApi(update.id, { order: update.order })));
            await requestDocsRefresh();
        } catch (error) {
            console.error('Error reordering docs', error);
            await requestDocsRefresh({ force: true });
        }
    }, [requestDocsRefresh]);

    const reorderFoldersInParent = useCallback(async (payload: { parentPath: string; orderedPaths: string[] }) => {
        if (!payload.orderedPaths.length) return;
        const folderMap = new Map(foldersRef.current.map(folder => [folder.path, folder]));
        const orderUpdates = payload.orderedPaths.map((path, index) => {
            const folder = folderMap.get(path);
            if (!folder?.docId) return null;
            return { path, docId: folder.docId, order: (index + 1) * 1000, currentOrder: folder.order };
        }).filter(Boolean) as Array<{ path: string; docId: string; order: number; currentOrder?: number }>;

        const updates = orderUpdates.filter(update => update.currentOrder !== update.order);
        if (updates.length === 0) return;

        const orderMap = new Map(orderUpdates.map(update => [update.path, update.order]));
        setFolders(prev => prev.map(folder => {
            const nextOrder = orderMap.get(folder.path);
            return typeof nextOrder === 'number' ? { ...folder, order: nextOrder } : folder;
        }));

        try {
            await Promise.all(updates.map(update => updateDocumentApi(update.docId, { order: update.order })));
            await requestDocsRefresh();
        } catch (error) {
            console.error('Error reordering folders', error);
            await requestDocsRefresh({ force: true });
        }
    }, [requestDocsRefresh]);

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
            await requestDocsRefresh();
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
            selectWorkspace({
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
        const isOwner = !workspace.ownerId || workspace.ownerId === user.uid;
        if (!isOwner && !isAdmin) {
            await showDialog({ type: 'error', title: 'Sin permisos', message: 'Solo el administrador o el propietario pueden eliminar este espacio.' });
            return;
        }

        setShowWorkspaceMenu(false);
        const confirmResult = await showDialog({
            type: 'input',
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
            await showDialog({ type: 'error', title: 'Nombre incorrecto', message: 'El nombre no coincide.' });
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
                    type: 'personal'
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
                name,
                content: `# ${name}`,
                type: 'text',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: targetFolder
            });
            const docRef = { id: String(data.id) };

            setNewDocName('');
            await requestDocsRefresh();
            openDocument({
                id: docRef.id,
                name,
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
        const isReorderDrag = types.includes('application/x-doc-reorder') || types.includes('application/x-folder-reorder');
        if (isReorderDrag) return;
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId || types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(prev => (prev === position ? prev : position));
    };

    const handleDropZoneDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
    };

    const handleDropZoneDrop = (e: React.DragEvent, position: number) => {
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

    const handleFolderDragOver = (e: React.DragEvent, folderName: string) => {
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

    const handleFolderDrop = async (e: React.DragEvent, folderName: string) => {
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
            await requestDocsRefresh({ force: true });

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

        if (allDocIds.length === 0 && filteredFolderPaths.length === 0) return;

        if (allDocIds.length === 0) {
            // Carpeta vacía (virtual o sin documentos) – confirmar y refrescar
            const confirmResult = await showDialog({
                type: 'confirm',
                title: 'Confirmar eliminación',
                message: '¿Eliminar la carpeta vacía? Esta acción no se puede deshacer.',
                confirmLabel: 'Eliminar',
                cancelLabel: 'Cancelar',
                danger: true
            });
            if (!confirmResult.confirmed) return;
            // Refrescar documentos para que las carpetas virtuales se recalculen
            await requestDocsRefresh({ force: true });
            setDeleteStatus({ phase: 'done', name: 'Carpeta eliminada' });
            scheduleDeleteStatusClear();
            return;
        }

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

    const handleDownloadDoc = async (doc: DocItem) => {
        if (!doc) return;
        try {
            const { blob } = await downloadDocumentBlobApi(doc.id);
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = doc.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download error:', err);
            showDialog({ type: 'error', title: 'Error al descargar', message: 'No se pudo descargar el archivo.' });
        }
    };

    const handleDownloadFolder = async (folderPath: string) => {
        const folderName = folderPath.split('/').pop() || folderPath || 'carpeta';
        // Collect all docs in this folder and subfolders
        const folderDocs = docs.filter(d => {
            const docFolder = normalizeFolderPath(d.folder);
            return docFolder === folderPath || docFolder.startsWith(`${folderPath}/`);
        });
        if (folderDocs.length === 0) {
            showDialog({ type: 'info', title: 'Carpeta vacía', message: 'No hay archivos para descargar en esta carpeta.' });
            return;
        }
        try {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            for (const doc of folderDocs) {
                try {
                    const { blob } = await downloadDocumentBlobApi(doc.id);
                    // Build relative path inside zip
                    const docFolder = normalizeFolderPath(doc.folder);
                    const relativePath = docFolder.startsWith(`${folderPath}/`)
                        ? docFolder.slice(folderPath.length + 1)
                        : '';
                    const fullPath = relativePath ? `${relativePath}/${doc.name}` : doc.name;
                    zip.file(fullPath, blob);
                } catch (err) {
                    console.warn(`Skipping ${doc.name}:`, err);
                }
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${folderName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Folder download error:', err);
            showDialog({ type: 'error', title: 'Error al descargar', message: 'No se pudo descargar la carpeta.' });
        }
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
        const emailToInvite = inviteEmail.trim();
        if (!emailToInvite) return;
        try {
            await inviteMemberApi({ workspaceId: currentWorkspace.id, email: emailToInvite });
            setInviteEmail('');
            setShowMembersModal(false);
            await showDialog({
                type: 'info',
                title: '✉️ Invitación enviada',
                message: `Se ha enviado una invitación a "${emailToInvite}". Cuando el usuario acepte, aparecerá como miembro del espacio.`
            });
        } catch (e) {
            console.error('Error inviting', e);
            await showDialog({ type: 'error', title: 'Error al invitar', message: 'No se pudo enviar la invitación. Intenta de nuevo.' });
        }
    };

    const removeMember = async (userId: string) => {
        if (!currentWorkspace || currentWorkspace.type === 'personal') return;

        try {
            const confirmResult = await showDialog({
                type: 'confirm',
                title: 'Eliminar miembro',
                message: '¿Estás seguro de que quieres eliminar a este miembro del espacio de trabajo?',
                confirmLabel: 'Eliminar',
                cancelLabel: 'Cancelar',
                danger: true
            });
            if (!confirmResult.confirmed) return;

            await removeMemberApi({ workspaceId: currentWorkspace.id, userId });

            // Update local state
            const updatedMembers = currentWorkspace.members.filter(m => m !== userId);
            const updatedWorkspace = { ...currentWorkspace, members: updatedMembers };
            selectWorkspace(updatedWorkspace);

            await showDialog({ type: 'info', title: 'Miembro eliminado', message: 'El usuario ha sido eliminado del espacio de trabajo.' });
        } catch (e) {
            console.error('Error removing member', e);
            await showDialog({ type: 'error', title: 'Error', message: 'No se pudo eliminar al miembro.' });
        }
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
                        openTerminal={openTerminal}
                        openTabs={openTabs}
                        closeTabById={closeTabById}
                        createDoc={createDoc}
                        createFolder={createFolder}
                        activeFolder={activeFolder}
                        setUploadTargetFolder={setUploadTargetFolder}
                        fileInputRef={fileInputRef}
                        folderInputRef={folderInputRef}
                        handleFileUpload={handleFileUpload}
                        handleFolderUpload={handleFolderUpload}
                        folderInputProps={folderInputProps}
                        defaultFolderName={DEFAULT_FOLDER_NAME}
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
                            title="Mostrar panel de archivos"
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
                            title="Salir de modo Zen"
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
                        onRenameDocument={promptRenameDocument}
                        onDownloadDoc={handleDownloadDoc}
                        getIcon={getIcon}
                        folderDragOver={folderDragOver}
                        onFolderDragOver={handleFolderDragOver}
                        onFolderDrop={handleFolderDrop}
                        onFolderDragLeave={handleFolderDragLeave}
                    />

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
                                onRenameDocument={promptRenameDocument}
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

                <AnimatePresence>
                    {showNewWorkspaceModal && (
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={modalFade}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                            style={{ willChange: 'opacity' }}
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
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                            style={{ willChange: 'opacity' }}
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
                                        {currentWorkspace.members.map((uid) => {
                                            const profile = memberProfiles[uid];
                                            const email = profile?.email || (uid === user?.uid ? user?.email : null);
                                            const label = email || profile?.displayName || `UID: ${uid.substring(0, 8)}...`;
                                            return (
                                                <div key={uid} className="flex items-center justify-between p-2 bg-surface-700 rounded-lg text-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-8 h-8 bg-mandy-500/15 text-mandy-400 rounded-full flex items-center justify-center text-xs font-bold">
                                                            U
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-surface-200 text-sm truncate" title={email || uid}>{label}</span>
                                                            {!email && profile?.displayName && (
                                                                <span className="text-[10px] text-surface-500 font-mono truncate">{uid.substring(0, 8)}...</span>
                                                            )}
                                                        </div>
                                                        {uid === currentWorkspace.ownerId && <span className="bg-accent-purple/20 text-accent-purple-light text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Shield className={`w-3 h-3 ${uid === currentWorkspace.ownerId ? 'text-mandy-400' : 'text-surface-600'}`} />
                                                        {user && currentWorkspace.ownerId === user.uid && uid !== user.uid && (
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

                    {showPasswordModal && (
                        <m.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={modalFade}
                            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                            style={{ willChange: 'opacity' }}
                            onClick={() => setShowPasswordModal(false)}
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

                <PricingModal
                    isOpen={showPricingModal}
                    onClose={() => setShowPricingModal(false)}
                    currentPlan={currentPlan}
                    userEmail={userEmail}
                    endDate={subscriptionEndDate}
                />
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
