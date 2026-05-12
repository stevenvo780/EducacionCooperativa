'use client';

import { markInternalDragStart, markInternalDragEnd } from '@/lib/internal-drag-flag';
import { initTouchDragPolyfill } from '@/lib/touch-drag-polyfill';
import { fold } from '@/lib/text-fold';

import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Image as ImageIcon, File as FileIcon, KanbanSquare, Loader2, Minimize2, Terminal as TerminalIcon } from 'lucide-react';
import { LazyMotion, domAnimation, useReducedMotion, type Transition } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { MosaicNode } from 'react-mosaic-component';
import { DialogKind, type DocItem, type FolderItem, type ViewMode, type Workspace, type DialogConfig, type DialogResult } from '@/components/dashboard/types';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath, normalizePath } from '@/lib/folder-utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { AGORA_EVENTS, dispatchAgoraEvent, subscribeAgoraEvent } from '@/lib/agora-events';
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
import { buildWorkspaceTreeModel } from '@/lib/workspace-tree-model';
import { getDocBadge, isMarkdownDocItem } from '@/services/dashboardDocUtils';
import { loadFavoriteDocIds, MAX_FAVORITE_DOCS, saveFavoriteDocIds } from '@/services/dashboardPersistence';
import { useDashboardUploads } from '@/hooks/dashboard/useDashboardUploads';
import { useDashboardPersistence } from '@/hooks/dashboard/useDashboardPersistence';
import StatusToasts from '@/components/dashboard/StatusToasts';
import type { FileKind } from '@/components/dashboard/NewFileModal';
import DragOverlay from '@/components/dashboard/DragOverlay';
import Sidebar from '@/components/dashboard/Sidebar';
import ActivityBar, { type ActivityView } from '@/components/dashboard/ActivityBar';
import WorkspaceTopBar from '@/components/dashboard/WorkspaceTopBar';
import usePresence from '@/hooks/usePresence';
import { OPEN_SETTINGS_EVENT, isSettingsSectionId, type SettingsSectionId } from '@/lib/settings-events';
import { SIDEBAR_VIEWS } from '@/components/dashboard/sidebar-views';
import type { Command as PaletteCommand } from '@/components/dashboard/CommandPalette';
import UserMenu from '@/components/dashboard/UserMenu';
import MobileTopBar from '@/components/dashboard/MobileTopBar';
import StatusBar from '@/components/dashboard/StatusBar';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useIsCompact } from '@/hooks/useMediaQuery';
import WelcomeView from '@/components/dashboard/WelcomeView';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { PLANS } from '@/types/subscription';
import { RightPanelSkeleton, LeftPanelSkeleton, BottomDockSkeleton } from '@/components/dashboard/PanelSkeletons';
import { useDashboardWorkspaces } from '@/hooks/dashboard/useDashboardWorkspaces';
import { useDashboardDocsSync } from '@/hooks/dashboard/useDashboardDocsSync';
import { useSubscription } from '@/hooks/dashboard/useSubscription';
import { useQuickSearch } from '@/hooks/dashboard/useQuickSearch';
import { useDeleteDocument } from '@/hooks/dashboard/useDeleteDocument';
import { useTerminalTabs } from '@/hooks/dashboard/useTerminalTabs';
import { useMosaicTabs } from '@/hooks/dashboard/useMosaicTabs';
import { useDocumentActions } from '@/hooks/dashboard/useDocumentActions';
import { useSidebarLayout, readPersistedSidebarWidth } from '@/hooks/dashboard/useSidebarLayout';
import { useWorkspaceActions } from '@/hooks/dashboard/useWorkspaceActions';
import { ALL_SEARCH_RESULT_FILTER } from '@/lib/search/types';
import type { AgentDocumentTarget, AgentUiCommandEventDetail } from '@/lib/agora-ai/types';
import { PERSONAL_WORKSPACE_ID, WorkspaceType } from '@/types/workspace';
import { semanticBrowserBus } from '@/lib/semantic-browser-bus';

const MosaicLayout = dynamic(() => import('@/components/MosaicLayout'), { ssr: false });

const RightPanel = dynamic(() => import('@/components/dashboard/RightPanel'), {
  ssr: false,
  loading: () => <RightPanelSkeleton />
});
const LeftPanel = dynamic(() => import('@/components/dashboard/LeftPanel'), {
  ssr: false,
  loading: () => <LeftPanelSkeleton />
});
const BottomDock = dynamic(() => import('@/components/dashboard/BottomDock'), {
  ssr: false,
  loading: () => <BottomDockSkeleton />
});
const SettingsModal = dynamic(() => import('@/components/dashboard/SettingsModal'), { ssr: false });
const WorkspaceManagerModal = dynamic(() => import('@/components/dashboard/WorkspaceManagerModal'), { ssr: false });
const MembersModal = dynamic(() => import('@/components/dashboard/MembersModal'), { ssr: false });
const ChangePasswordModal = dynamic(() => import('@/components/dashboard/ChangePasswordModal'), { ssr: false });
const NewWorkspaceModal = dynamic(() => import('@/components/dashboard/NewWorkspaceModal'), { ssr: false });
const PricingModal = dynamic(() => import('@/components/dashboard/PricingModal'), { ssr: false });
const CommandPalette = dynamic(() => import('@/components/dashboard/CommandPalette'), { ssr: false });
const QuickSearchModal = dynamic(() => import('@/components/dashboard/QuickSearchModal'), { ssr: false });
const KeyboardShortcuts = dynamic(() => import('@/components/dashboard/KeyboardShortcuts'), { ssr: false });
const NewFileModal = dynamic(() => import('@/components/dashboard/NewFileModal'), { ssr: false });
const DialogModal = dynamic(() => import('@/components/dashboard/DialogModal'), { ssr: false });
const WorkerInstallModal = dynamic(() => import('@/components/dashboard/WorkerInstallModal'), { ssr: false });
const WhatsNewModal = dynamic(() => import('@/components/dashboard/WhatsNewModal'), { ssr: false });

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
        initialize,
        isCreatingSession,
        getSessionsForWorkspace,
        getWorkerStatusForWorkspace,
        subscribeToWorkspace,
        unsubscribeFromWorkspace,
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

    useEffect(() => {
        return subscribeAgoraEvent(AGORA_EVENTS.planRequired, (detail) => {
            const isQuota = detail?.kind === 'quota';
            toast.error(isQuota ? 'Cuota excedida' : 'Plan requerido', {
                description: detail?.message || 'Esta acción requiere un plan superior.',
                action: { label: 'Ver planes', onClick: () => setShowPricingModal(true) }
            });
        });
    }, [setShowPricingModal]);
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

    useEffect(() => { initTouchDragPolyfill(); }, []);
    useEffect(() => { void import('@/lib/diagnostics-bus').then(m => m.installDiagnosticsBus()); }, []);

    // Bridges: lints del editor ST/MD → diagnostics-bus, asociados al
    // doc activo. Skip si la nueva lista es idéntica a la anterior para
    // no spamear publishes (que dispararían re-renders innecesarios y, en
    // el peor caso, ciclos de re-entrada). Comparación por hash simple
    // (count + severity-totals + first message) — barato y suficiente.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        type DiagItem = { severity: 'error' | 'warning' | 'info' | 'hint'; message: string; code?: string; range?: { startLine: number; startColumn?: number; endLine?: number; endColumn?: number } };
        let collection: { set: (uri: string, items: DiagItem[]) => void; clear: (uri: string) => void } | null = null;
        let lastDocId: string | null = null;
        const lastSig = new Map<string, string>();

        void import('@/lib/diagnostics-bus').then((m) => {
            collection = m.createDiagnosticsCollection('st-linter');
        });

        const sig = (items: DiagItem[]): string => {
            if (items.length === 0) return 'empty';
            return `${items.length}:${items[0]?.severity ?? ''}:${items[0]?.message?.slice(0, 40) ?? ''}`;
        };

        const unsubscribe = subscribeAgoraEvent(AGORA_EVENTS.stDiagnostics, (detail) => {
            const docId = selectedDocIdRef.current;
            if (!docId || !collection) return;
            if (lastDocId && lastDocId !== docId) {
                collection.clear(lastDocId);
                lastSig.delete(lastDocId);
            }
            lastDocId = docId;
            const items: DiagItem[] = !detail || !Array.isArray(detail.diagnostics)
                ? []
                : detail.diagnostics.map((d) => ({
                    severity: (d.severity === 'error' ? 'error' : d.severity === 'info' ? 'info' : 'warning') as DiagItem['severity'],
                    message: d.message,
                    code: d.code,
                    range: { startLine: d.line ?? 1, startColumn: d.column, endLine: d.endLine, endColumn: d.endColumn }
                }));
            const newSig = sig(items);
            if (lastSig.get(docId) === newSig) return;
            lastSig.set(docId, newSig);
            if (items.length === 0) collection.clear(docId);
            else collection.set(docId, items);
        });
        return () => {
            unsubscribe();
            if (collection && lastDocId) collection.clear(lastDocId);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        type DiagItem = { severity: 'error' | 'warning' | 'info' | 'hint'; message: string; code?: string; range?: { startLine: number; startColumn?: number } };
        let collection: { set: (uri: string, items: DiagItem[]) => void; clear: (uri: string) => void } | null = null;
        let lastDocId: string | null = null;
        const lastSig = new Map<string, string>();

        void import('@/lib/diagnostics-bus').then((m) => {
            collection = m.createDiagnosticsCollection('markdown-linter');
        });

        const sig = (items: DiagItem[]): string => {
            if (items.length === 0) return 'empty';
            return `${items.length}:${items[0]?.severity ?? ''}:${items[0]?.message?.slice(0, 40) ?? ''}`;
        };

        const unsubscribe = subscribeAgoraEvent(AGORA_EVENTS.mdDiagnostics, (detail) => {
            // Preferir docId del evento (emitido por useMarkdownLinter del editor real)
            // sobre selectedDocIdRef.current, que puede haber cambiado entre lint y emit.
            const docId = detail?.docId ?? selectedDocIdRef.current;
            if (!docId || !collection) return;
            if (lastDocId && lastDocId !== docId) {
                collection.clear(lastDocId);
                lastSig.delete(lastDocId);
            }
            lastDocId = docId;
            const items: DiagItem[] = !detail || !Array.isArray(detail.diagnostics)
                ? []
                : detail.diagnostics.map((d) => ({
                    severity: (d.severity === 'error' ? 'error' : d.severity === 'info' ? 'info' : 'warning') as DiagItem['severity'],
                    message: d.message,
                    code: d.ruleId,
                    range: { startLine: d.line, startColumn: d.column }
                }));
            const newSig = sig(items);
            if (lastSig.get(docId) === newSig) return;
            lastSig.set(docId, newSig);
            if (items.length === 0) collection.clear(docId);
            else collection.set(docId, items);
        });
        return () => {
            unsubscribe();
            if (collection && lastDocId) collection.clear(lastDocId);
        };
    }, []);

    useEffect(() => {
        if (!user) return;
        const nexusUrl = process.env.NEXT_PUBLIC_NEXUS_URL ||
            (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                ? 'http://localhost:3010'
                : 'https://hub.humanizar-dev.cloud');
        initialize(nexusUrl);
    }, [initialize, user]);

    useEffect(() => {
        if (!user || typeof window === 'undefined') return;
        try {
            const dismissed = window.localStorage.getItem('agora-whats-new-v1.0:dismissed') === 'true';
            if (!dismissed) setShowWhatsNew(true);
        } catch {
            /* localStorage no disponible (modo privado, etc.) — no mostrar */
        }
    }, [user]);

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

    const workspaces = useAppSelector(state => state.workspaces.workspaces);
    const invites = useAppSelector(state => state.workspaces.invites);
    const currentWorkspace = useAppSelector(state => state.workspaces.currentWorkspace);
    const deletingWorkspaceId = useAppSelector(state => state.workspaces.deletingWorkspaceId);
    const showNewWorkspaceModal = useAppSelector(state => state.ui.showNewWorkspaceModal);
    const showMembersModal = useAppSelector(state => state.ui.showMembersModal);
    const showPasswordModal = useAppSelector(state => state.ui.showPasswordModal);
    const passwordForm = useAppSelector(state => state.ui.passwordForm);
    const passwordError = useAppSelector(state => state.ui.passwordError);
    const passwordSuccess = useAppSelector(state => state.ui.passwordSuccess);
    const isChangingPassword = useAppSelector(state => state.ui.isChangingPassword);
    const showQuickSearch = useAppSelector(state => state.ui.showQuickSearch);
    const quickSearchQuery = useAppSelector(state => state.ui.quickSearchQuery);
    const quickSearchIndex = useAppSelector(state => state.ui.quickSearchIndex);
    const sidebarSearchQuery = useAppSelector(state => state.ui.sidebarSearchQuery);
    const showMobileSidebar = useAppSelector(state => state.ui.showMobileSidebar);

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
    const selectedDocIdRef = useRef<string | null>(null);
    useEffect(() => { selectedDocIdRef.current = selectedDocId; }, [selectedDocId]);

    // Presencia: publica al usuario en el workspace activo y consume los peers.
    // Personal workspace usa un canal privado por uid; los compartidos usan el id.
    const presenceWorkspaceId = currentWorkspaceId
        ? (currentWorkspaceId === PERSONAL_WORKSPACE_ID
            ? (user?.uid ? `personal_${user.uid}` : null)
            : currentWorkspaceId)
        : null;
    const { peers: presencePeers } = usePresence({
        workspaceId: presenceWorkspaceId,
        userId: user?.uid ?? null,
        displayName: user?.displayName ?? user?.email ?? null,
        photoURL: user?.photoURL ?? undefined,
        currentDocId: selectedDocId,
        enabled: !!user && !!presenceWorkspaceId
    });
    const docById = useMemo(() => {
        const map = new Map<string, DocItem>();
        for (const doc of docs) map.set(doc.id, doc);
        return map;
    }, [docs]);
    const resolvePresenceDocName = useCallback((docId: string) => {
        return docById.get(docId)?.name ?? null;
    }, [docById]);
    const [favoriteDocIds, setFavoriteDocIds] = useState<string[]>([]);
    const [openTabs, setOpenTabsRaw] = useState<DocItem[]>([]);
    // Saneo: si entran duplicados (bug histórico del effect que se disparaba 2x),
    // descartar los repetidos por id manteniendo el primero.
    const setOpenTabs: typeof setOpenTabsRaw = useCallback((value) => {
        setOpenTabsRaw(prev => {
            const next = typeof value === 'function' ? (value as (p: DocItem[]) => DocItem[])(prev) : value;
            const seen = new Set<string>();
            const dedup = next.filter(t => seen.has(t.id) ? false : (seen.add(t.id), true));
            return dedup.length === next.length ? next : dedup;
        });
    }, []);
    const openTabsById = useMemo(() => {
        const map = new Map<string, DocItem>();
        for (const tab of openTabs) map.set(tab.id, tab);
        return map;
    }, [openTabs]);
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
    const [showWorkerInstallModal, setShowWorkerInstallModal] = useState(false);
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const [showWorkspaceManagerModal, setShowWorkspaceManagerModal] = useState(false);
    const [newFileTargetFolder, setNewFileTargetFolder] = useState<string>(ROOT_FOLDER_PATH);
    const [activeFolder, setActiveFolder] = useState<string>(ROOT_FOLDER_PATH);
    const {
        sidebarWidth,
        setSidebarWidth,
        isResizingSidebar,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        startResizingSidebar,
        stopResizingSidebar
    } = useSidebarLayout();

    const [isZenMode, setIsZenMode] = useState(false);
    const zenRestoreRef = useRef({ sidebar: false });
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
    }, [showMobileSidebar, setShowMobileSidebar, setIsSidebarCollapsed]);
    const enterZenMode = useCallback(() => {
        zenRestoreRef.current = { sidebar: isSidebarCollapsed };
        setShowWorkspaceMenu(false);
        setShowMobileSidebar(false);
        setIsSidebarCollapsed(true);
        setIsZenMode(true);
    }, [isSidebarCollapsed, setShowMobileSidebar, setShowWorkspaceMenu, setIsSidebarCollapsed]);
    const exitZenMode = useCallback(() => {
        setIsSidebarCollapsed(zenRestoreRef.current.sidebar);
        setIsZenMode(false);
    }, [setIsSidebarCollapsed]);
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
    const [activityView, setActivityView] = useState<ActivityView>('files');
    const [bottomDockOpen, setBottomDockOpen] = useState(false);
    const [dockInitialTab, setDockInitialTab] = useState<string>('terminal');
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionId>('editor-md');
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
    const openSettings = useCallback((section: SettingsSectionId = 'editor-md') => {
        setSettingsInitialSection(section);
        setSettingsOpen(true);
    }, []);
    const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);
    const isCompact = useIsCompact();
    // En mobile el sidebar se reajusta para que el conjunto activity+sidebar
    // quepa en el viewport sin overflow horizontal.
    const [viewportWidth, setViewportWidth] = useState<number>(1024);
    useEffect(() => {
        let rafId: number | null = null;
        const readWidth = () => {
            rafId = null;
            setViewportWidth(window.innerWidth);
        };
        const scheduleRead = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(readWidth);
        };
        scheduleRead();
        window.addEventListener('resize', scheduleRead);
        return () => {
            window.removeEventListener('resize', scheduleRead);
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, []);
    const effectiveSidebarWidth = useMemo(() => {
        if (!isCompact) return sidebarWidth;
        const ACTIVITY = 48;
        const max = Math.max(220, viewportWidth - ACTIVITY - 16);
        return Math.min(sidebarWidth, max);
    }, [isCompact, sidebarWidth, viewportWidth]);
    const recentDocs = useMemo(() => {
        return docs
            .filter(d => d.type !== 'folder' && d.type !== 'terminal' && d.type !== 'files')
            .slice()
            .sort((a, b) => getUpdatedAtValue(b) - getUpdatedAtValue(a))
            .slice(0, 8);
    }, [docs]);
    const workerStatus: 'online' | 'offline' | 'unknown' = useMemo(() => {
        if (!currentWorkspace || !user) return 'unknown';
        const tok = currentWorkspace.id === PERSONAL_WORKSPACE_ID
            ? `${PERSONAL_WORKSPACE_ID}:${user.uid}`
            : currentWorkspace.id;
        const s = getWorkerStatusForWorkspace(tok);
        return s === 'online' ? 'online' : s === 'offline' ? 'offline' : 'unknown';
    }, [currentWorkspace, user, getWorkerStatusForWorkspace]);
    const createWorkspaceTerminal = useCallback(() => {
        if (!currentWorkspace || !user || workerStatus !== 'online') return;
        const tok = currentWorkspace.id === PERSONAL_WORKSPACE_ID
            ? `${PERSONAL_WORKSPACE_ID}:${user.uid}`
            : currentWorkspace.id;
        createSession(tok, currentWorkspace.type, currentWorkspace.name);
    }, [currentWorkspace, user, workerStatus, createSession]);
    // En mobile/tablet ignoramos el árbol Mosaic con splits — los tiles
    // side-by-side dejaban el editor en ~140px e ilegible. Mostramos solo el
    // doc activo a pantalla completa; el resto sigue accesible vía tabs.
    const effectiveMosaicNode = useMemo<MosaicNode<string> | null>(() => {
        if (!isCompact) return mosaicNode;
        if (selectedDocId) return selectedDocId;
        if (mosaicNode && typeof mosaicNode === 'string') return mosaicNode;
        return mosaicNode;
    }, [isCompact, mosaicNode, selectedDocId]);

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
        showQuickSearch: showQuickSearch || activityView === 'search',
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
        subscribeToWorkspace,
        unsubscribeFromWorkspace
    });

    const openMembersForWorkspace = useCallback((workspace: Workspace) => {
        selectWorkspace(workspace);
        setShowMembersModal(true);
    }, [selectWorkspace, setShowMembersModal]);

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

    const lastFetchedSignatureRef = useRef<{
        wsId: string;
        len: number;
        sumUpdated: number;
        sumIdLen: number;
        sumNameLen: number;
        sumOrderInt: number;
        sumFolderHash: number;
    } | null>(null);

    const applyDocsSnapshot = useCallback((fetched: DocItem[]) => {
        if (!currentWorkspace) return;

        let sumUpdated = 0;
        let sumIdLen = 0;
        let sumNameLen = 0;
        let sumOrderInt = 0;
        let sumFolderHash = 0;
        for (let i = 0; i < fetched.length; i += 1) {
            const item = fetched[i];
            if (!item) continue;
            sumUpdated += getUpdatedAtValue(item.updatedAt);
            const id = item.id || '';
            sumIdLen += id.length;
            const name = item.name || '';
            sumNameLen += name.length;
            sumOrderInt += typeof item.order === 'number' ? Math.trunc(item.order) : 0;
            const folder = item.folder || '';
            let h = 0;
            for (let j = 0; j < folder.length; j += 1) {
                h = ((h << 5) - h + folder.charCodeAt(j)) | 0;
            }
            sumFolderHash = (sumFolderHash + h) | 0;
        }
        const lastSig = lastFetchedSignatureRef.current;
        if (
            lastSig &&
            lastSig.wsId === currentWorkspace.id &&
            lastSig.len === fetched.length &&
            lastSig.sumUpdated === sumUpdated &&
            lastSig.sumIdLen === sumIdLen &&
            lastSig.sumNameLen === sumNameLen &&
            lastSig.sumOrderInt === sumOrderInt &&
            lastSig.sumFolderHash === sumFolderHash
        ) {
            return;
        }
        lastFetchedSignatureRef.current = {
            wsId: currentWorkspace.id,
            len: fetched.length,
            sumUpdated,
            sumIdLen,
            sumNameLen,
            sumOrderInt,
            sumFolderHash
        };

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

    const setActivityViewSafe = useCallback((v: string) => {
        setActivityView(v as ActivityView);
    }, []);
    useDashboardPersistence({
        currentWorkspaceId,
        activityView,
        bottomDockOpen,
        rightPanelOpen,
        setActivityView: setActivityViewSafe,
        setBottomDockOpen,
        setRightPanelOpen,
        docs,
        loadingDocs,
        openTabs,
        selectedDocId,
        mosaicNode,
        docModes,
        sidebarWidth,
        activeFolder,
        isSidebarCollapsed,
        closedFilesTabByWorkspace,
        rootFolderPath: ROOT_FOLDER_PATH,
        zenRestoreRef,
        setSidebarWidth,
        setActiveFolderSafe,
        setDocModes,
        setIsSidebarCollapsed,
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
                const doc = docById.get(data.docId);
                if (!doc) return;
                void openDocumentInTileRef.current(doc, data.sourceDocId ?? null);
            } else if (data.type === 'agora-open-board') {
                void openBoardRef.current();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [docById]);

    useEffect(() => {
        return subscribeAgoraEvent(AGORA_EVENTS.openDocuments, (detail) => {
            if (!detail?.workspaceId || !currentWorkspaceId) return;
            if (detail.workspaceId !== currentWorkspaceId && !(currentWorkspaceId === PERSONAL_WORKSPACE_ID && detail.workspaceId === PERSONAL_WORKSPACE_ID)) {
                return;
            }

            const normalizeDoc = (candidate: AgentDocumentTarget): DocItem => ({
                id: candidate.id,
                name: candidate.name,
                type: candidate.type as DocItem['type'],
                folder: candidate.folder,
                content: candidate.content,
                mimeType: candidate.mimeType ?? undefined,
                workspaceId: candidate.workspaceId || currentWorkspaceId,
                ownerId: candidate.ownerId || user?.uid,
                updatedAt: new Date()
            });

            const openTargets = async () => {
                if (detail.focusFolder) {
                    setActiveFolderSafe(detail.focusFolder);
                }

                for (const candidate of detail.documents) {
                    const resolved = docById.get(candidate.id)
                        ?? openTabsById.get(candidate.id)
                        ?? normalizeDoc(candidate);
                    await openDocumentRef.current(resolved);
                }
            };

            void openTargets();
        });
    }, [currentWorkspaceId, docById, openTabsById, setActiveFolderSafe, user?.uid]);

    const sidebarFilteredDocs = useMemo(() => {
        const query = fold(deferredSidebarQuery.trim());
        if (!query) return deferredDocs;
        return deferredDocs.filter(d => fold(d.name).includes(query));
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
        setShowMobileSidebar,
        selectSession,
        user,
        currentWorkspace,
        createSession,
        getSessionsForWorkspace,
        onOpenDock: () => setBottomDockOpen(true)
    });

    const {
        openBoard,
        openStRunner,
        openSemanticBrowser,
        openFormalizer,
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

    useEffect(() => {
        const offAi = subscribeAgoraEvent(AGORA_EVENTS.openAiConfig, () => openSettings('ai'));
        const offLinter = subscribeAgoraEvent(AGORA_EVENTS.openLinterConfig, () => openSettings('linter'));
        const genericHandler = (event: Event) => {
            const detail = (event as CustomEvent<{ section?: unknown }>).detail;
            openSettings(isSettingsSectionId(detail?.section) ? detail.section : undefined);
        };
        window.addEventListener(OPEN_SETTINGS_EVENT, genericHandler);
        return () => {
            offAi();
            offLinter();
            window.removeEventListener(OPEN_SETTINGS_EVENT, genericHandler);
        };
    }, [openSettings]);

    useEffect(() => {
        return subscribeAgoraEvent(AGORA_EVENTS.openBottomDock, (detail) => {
            const tab = detail?.tab;
            if (tab) setDockInitialTab(tab);
            setBottomDockOpen(true);
        });
    }, []);

    useEffect(() => {
        const workspaceMatches = (workspaceId?: string) => {
            if (!workspaceId || !currentWorkspaceId) return false;
            return workspaceId === currentWorkspaceId
                || (workspaceId === PERSONAL_WORKSPACE_ID && currentWorkspaceId === PERSONAL_WORKSPACE_ID);
        };

        const openSidebarView = (view: ActivityView) => {
            setActivityView(view);
            if (isCompact) setShowMobileSidebar(true);
        };

        const handler = (detail: AgentUiCommandEventDetail) => {
            if (!workspaceMatches(detail?.workspaceId)) return;

            const panel = detail.command.panel;
            const type = detail.command.type;
            if (detail.command.folder) {
                setActiveFolderSafe(detail.command.folder);
            }

            if (type === 'open_terminal' || panel === 'terminal') {
                setDockInitialTab('terminal');
                setBottomDockOpen(true);
                return;
            }
            if (type === 'open_problems' || panel === 'problems') {
                setDockInitialTab('problems');
                setBottomDockOpen(true);
                return;
            }
            if (type === 'open_ai_config' || panel === 'ai-config') {
                openSettings('ai');
                return;
            }
            if (type === 'open_linter_config' || panel === 'linter-config') {
                openSettings('linter');
                return;
            }

            if (type === 'focus-document-section') {
                const cmd = detail.command as unknown as Record<string, unknown>;
                const docId = cmd.documentId as string | undefined;
                const headingTitle = cmd.headingTitle as string | null | undefined;
                const line = cmd.line as number | null | undefined;
                if (docId) {
                    dispatchAgoraEvent(AGORA_EVENTS.focusDocumentSection, {
                        documentId: docId,
                        headingTitle: headingTitle ?? null,
                        line: line ?? null
                    });
                }
                return;
            }
            const dynamicTypes: Record<string, typeof AGORA_EVENTS[keyof typeof AGORA_EVENTS]> = {
                'prompt-user-choice': AGORA_EVENTS.promptUserChoice,
                'show-diff': AGORA_EVENTS.showDiff,
                'agent-status': AGORA_EVENTS.agentStatus,
                'agent-plan': AGORA_EVENTS.agentPlan
            };
            const dynamicEventName = dynamicTypes[type as string];
            if (dynamicEventName) {
                // Estos comandos se renderizan dentro del panel del agente; no
                // requieren acción global del dashboard. Re-emitimos como
                // evento dedicado por si AgoraAIChat lo escucha por separado.
                dispatchAgoraEvent(dynamicEventName, detail.command);
                return;
            }

            switch (panel) {
                case 'files':
                    openSidebarView('files');
                    break;
                case 'search':
                    openSidebarView('search');
                    setShowQuickSearch(true);
                    break;
                case 'git':
                    openSidebarView('git');
                    break;
                case 'snippets':
                    openSidebarView('snippets');
                    break;
                case 'board':
                    void openBoard();
                    break;
                case 'semantic':
                    void openSemanticBrowser();
                    break;
                case 'st':
                    void openStRunner();
                    break;
                case 'formalizer':
                    void openFormalizer();
                    break;
                case 'ai':
                    setRightPanelOpen(true);
                    break;
                case 'settings':
                    openSettings();
                    break;
                default:
                    break;
            }
        };

        return subscribeAgoraEvent(AGORA_EVENTS.agentUiCommand, handler);
    }, [
        currentWorkspaceId,
        isCompact,
        openBoard,
        openFormalizer,
        openSemanticBrowser,
        openSettings,
        openStRunner,
        setActiveFolderSafe,
        setShowMobileSidebar,
        setShowQuickSearch
    ]);

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
        createDoc,
        createStDoc,
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

    const { createWorkspace, renameWorkspace, duplicateWorkspace, mergeWorkspaceIntoCurrent, deleteWorkspace, inviteMember, removeMember } = useWorkspaceActions({
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
            if (moved === undefined) return prev;
            next.splice(targetIndex, 0, moved);
            return next;
        });
    }, []);

    const {
        uploadStatus,
        isDragActive,
        dismissDragOverlay,
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

    const openSidebarViewFromShortcut = useCallback((view: ActivityView) => {
        setActivityView(view);
        if (isCompact) {
            setShowMobileSidebar(true);
        } else if (isSidebarCollapsed) {
            setIsSidebarCollapsed(false);
        }
    }, [isCompact, isSidebarCollapsed, setIsSidebarCollapsed, setShowMobileSidebar]);

    const openSearchSidebarFromShortcut = useCallback(() => {
        openSidebarViewFromShortcut('search');
        requestAnimationFrame(() => quickSearchInputRef.current?.focus());
    }, [openSidebarViewFromShortcut, quickSearchInputRef]);

    const showBottomDockTab = useCallback((tab: string) => {
        setDockInitialTab(tab);
        setBottomDockOpen(true);
    }, []);

    const toggleBottomDockTab = useCallback((tab: string) => {
        setDockInitialTab(tab);
        setBottomDockOpen((current) => dockInitialTab === tab ? !current : true);
    }, [dockInitialTab]);

    const selectOpenTabByOffset = useCallback((direction: 1 | -1) => {
        if (openTabs.length <= 1) return;
        const currentIdx = selectedDocId ? openTabs.findIndex(t => t.id === selectedDocId) : -1;
        const nextIdx = (currentIdx + direction + openTabs.length) % openTabs.length;
        const nextTab = openTabs[nextIdx];
        if (nextTab) setSelectedDocId(nextTab.id);
    }, [openTabs, selectedDocId]);

    const selectOpenTabByIndex = useCallback((index: number) => {
        if (openTabs.length === 0) return;
        const nextTab = openTabs[Math.min(index, openTabs.length - 1)];
        if (nextTab) setSelectedDocId(nextTab.id);
    }, [openTabs]);

    const closeActiveTabFromShortcut = useCallback(() => {
        if (selectedDocId) {
            void closeTabById(selectedDocId);
        }
    }, [closeTabById, selectedDocId]);

    const closeAllTabsFromShortcut = useCallback(() => {
        openTabs.forEach((tab) => {
            void closeTabById(tab.id);
        });
    }, [closeTabById, openTabs]);

    const getActiveDocument = useCallback(() => {
        if (!selectedDocId) return null;
        return openTabsById.get(selectedDocId)
            ?? docById.get(selectedDocId)
            ?? null;
    }, [docById, openTabsById, selectedDocId]);

    const selectedDocForOutline = useMemo<DocItem | null>(() => {
        const isTextualName = (n?: string) => !!n && /\.(md|markdown|mdx|st|txt)$/i.test(n);
        const virtualTypes = new Set([
            'semantic-browser', 'board', 'kanban', 'st-runner', 'formalizer',
            'agora-ai', 'snippets', 'file-explorer', 'terminal', 'folder'
        ]);
        const isVirtualPanel = (t?: { type?: string }) => !!t && virtualTypes.has(t.type ?? '');

        if (selectedDocId) {
            const found = docById.get(selectedDocId) ?? openTabsById.get(selectedDocId);
            if (found && !isVirtualPanel(found)) return found;
        }
        const fromTabs = openTabs.find(t => isTextualName(t.name) && !isVirtualPanel(t));
        if (fromTabs) return fromTabs;
        const fromDocs = docs.find(d => isTextualName(d.name) && !isVirtualPanel(d));
        return fromDocs ?? null;
    }, [selectedDocId, docById, openTabsById, openTabs, docs]);

    const getDocumentDisplayPath = useCallback((doc: DocItem) => {
        const folder = normalizeFolderPath(doc.folder);
        return folder ? `${folder}/${doc.name}` : doc.name;
    }, []);

    const copyActiveDocumentPath = useCallback(() => {
        const doc = getActiveDocument();
        if (!doc) return;
        const path = getDocumentDisplayPath(doc);
        void navigator.clipboard?.writeText(path);
        toast.success('Ruta copiada', { description: path });
    }, [getActiveDocument, getDocumentDisplayPath]);

    const revealActiveDocumentInSidebar = useCallback(() => {
        const doc = getActiveDocument();
        if (!doc) return;
        setActiveFolderSafe(normalizeFolderPath(doc.folder));
        openSidebarViewFromShortcut('files');
    }, [getActiveDocument, openSidebarViewFromShortcut, setActiveFolderSafe]);

    const syncNowFromShortcut = useCallback(() => {
        void syncNow();
    }, [syncNow]);

    useEffect(() => {
        const clearShortcutChord = () => {
            shortcutChordDeadlineRef.current = 0;
        };

        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            const hasPrimaryModifier = e.ctrlKey || e.metaKey;
            const chordActive = shortcutChordDeadlineRef.current > Date.now();
            const normalizedKey = e.key.toLowerCase();
            const matchesShortcut = (code: string, key: string) => e.code === code || normalizedKey === key;
            const target = e.target instanceof HTMLElement ? e.target : null;
            const targetIsTerminal = Boolean(target?.closest('.xterm, .xterm-screen, .xterm-helper-textarea'));
            const targetIsEditable = Boolean(
                target && (
                    target.tagName === 'INPUT'
                    || target.tagName === 'TEXTAREA'
                    || target.tagName === 'SELECT'
                    || target.isContentEditable
                    || target.closest('[contenteditable="true"]')
                )
            );
            const hasBlockingOverlay = Boolean(
                dialogConfig
                || showNewFileModal
                || showNewWorkspaceModal
                || showWorkspaceManagerModal
                || showMembersModal
                || showPasswordModal
                || showPricingModal
                || settingsOpen
                || showCommandPalette
                || showKeyboardHelp
            );

            if (e.key === 'Escape' && showQuickSearch) {
                e.preventDefault();
                clearShortcutChord();
                closeQuickSearch();
                return;
            }

            if (e.key === '?' && !e.altKey && !hasPrimaryModifier) {
                const target = e.target as HTMLElement | null;
                const isEditing = target && (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable
                );
                if (!isEditing) {
                    e.preventDefault();
                    clearShortcutChord();
                    setShowKeyboardHelp(true);
                    return;
                }
            }

            if (chordActive && targetIsEditable) {
                clearShortcutChord();
                return;
            }

            if (chordActive) {
                if (matchesShortcut('KeyZ', 'z') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    handleToggleZenMode();
                    return;
                }
                if (matchesShortcut('KeyS', 's') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    setShowKeyboardHelp(true);
                    return;
                }
                if (matchesShortcut('KeyW', 'w') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    closeAllTabsFromShortcut();
                    return;
                }
                if (matchesShortcut('KeyH', 'h') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    showBottomDockTab('problems');
                    return;
                }
                if (matchesShortcut('KeyB', 'b') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    handleToggleSidebarCollapse();
                    return;
                }
                if (matchesShortcut('KeyT', 't') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    openSettings();
                    return;
                }
                if (matchesShortcut('KeyP', 'p') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    copyActiveDocumentPath();
                    return;
                }
                if (matchesShortcut('KeyR', 'r') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    revealActiveDocumentInSidebar();
                    return;
                }
                if (matchesShortcut('KeyO', 'o') && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    clearShortcutChord();
                    openUploadFolderPickerAt();
                    return;
                }
                if (!matchesShortcut('KeyK', 'k')) {
                    clearShortcutChord();
                }
            }

            if (e.key === 'F1' && !e.altKey && !hasPrimaryModifier && !hasBlockingOverlay && !showQuickSearch) {
                e.preventDefault();
                clearShortcutChord();
                setShowCommandPalette(true);
                return;
            }

            if (e.key === 'F11' && !e.altKey && !hasPrimaryModifier && !hasBlockingOverlay && !showQuickSearch) {
                e.preventDefault();
                clearShortcutChord();
                handleToggleZenMode();
                return;
            }

            if (hasBlockingOverlay || showQuickSearch || !hasPrimaryModifier) {
                return;
            }

            if (targetIsEditable && !targetIsTerminal) {
                return;
            }

            if (matchesShortcut('KeyK', 'k') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                shortcutChordDeadlineRef.current = Date.now() + 1500;
                return;
            }

            if (matchesShortcut('KeyS', 's') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                syncNowFromShortcut();
                return;
            }

            if (matchesShortcut('Comma', ',') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSettings();
                return;
            }

            if (matchesShortcut('KeyO', 'o') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openUploadFilePickerAt();
                return;
            }

            if (matchesShortcut('KeyP', 'p') && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                if (e.shiftKey) {
                    setShowCommandPalette(true);
                } else {
                    openQuickSearch();
                }
                return;
            }

            if (matchesShortcut('KeyE', 'e') && !e.shiftKey && !e.altKey) {
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

            if (matchesShortcut('KeyF', 'f') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSearchSidebarFromShortcut();
                return;
            }

            if (matchesShortcut('KeyH', 'h') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSearchSidebarFromShortcut();
                return;
            }

            if (matchesShortcut('KeyD', 'd') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSidebarViewFromShortcut('tools');
                return;
            }

            if (matchesShortcut('KeyX', 'x') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSidebarViewFromShortcut('snippets');
                return;
            }

            if (matchesShortcut('KeyO', 'o') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSidebarViewFromShortcut('outline');
                return;
            }

            if (matchesShortcut('KeyB', 'b') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                void openStRunner();
                return;
            }

            if (matchesShortcut('KeyB', 'b') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                handleToggleSidebarCollapse();
                return;
            }

            if (matchesShortcut('KeyI', 'i') && e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                setRightPanelOpen(e.shiftKey ? true : (current) => !current);
                return;
            }

            if (matchesShortcut('KeyI', 'i') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                setRightPanelOpen((v) => !v);
                return;
            }

            if (matchesShortcut('KeyM', 'm') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                showBottomDockTab('problems');
                return;
            }

            if (matchesShortcut('KeyE', 'e') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSidebarViewFromShortcut('files');
                return;
            }

            if (matchesShortcut('KeyG', 'g') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                openSidebarViewFromShortcut('git');
                return;
            }

            if (matchesShortcut('KeyU', 'u') && e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                showBottomDockTab('problems');
                return;
            }

            if (matchesShortcut('KeyW', 'w') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                closeActiveTabFromShortcut();
                return;
            }

            if (e.code === 'F4' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                closeActiveTabFromShortcut();
                return;
            }

            if (e.code === 'Tab' && !e.altKey) {
                if (openTabs.length <= 1) return;
                e.preventDefault();
                clearShortcutChord();
                selectOpenTabByOffset(e.shiftKey ? -1 : 1);
                return;
            }

            if ((e.code === 'PageDown' || e.code === 'PageUp') && !e.altKey) {
                if (openTabs.length <= 1) return;
                e.preventDefault();
                clearShortcutChord();
                selectOpenTabByOffset(e.code === 'PageDown' ? 1 : -1);
                return;
            }

            if (/^Digit[1-9]$/.test(e.code) && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                selectOpenTabByIndex(Number(e.code.replace('Digit', '')) - 1);
                return;
            }

            if (matchesShortcut('KeyJ', 'j') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                toggleBottomDockTab(dockInitialTab || 'terminal');
                return;
            }

            if (matchesShortcut('KeyC', 'c') && e.shiftKey && !e.altKey && !targetIsTerminal) {
                e.preventDefault();
                clearShortcutChord();
                void openTerminal();
                return;
            }

            if ((e.code === 'Backquote' || normalizedKey === '`' || normalizedKey === 'dead') && !e.altKey) {
                e.preventDefault();
                clearShortcutChord();
                if (e.shiftKey) {
                    handleRequestNewTerminal();
                } else {
                    toggleBottomDockTab('terminal');
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
        closeActiveTabFromShortcut,
        closeAllTabsFromShortcut,
        dialogConfig,
        copyActiveDocumentPath,
        handleRequestNewTerminal,
        handleToggleSidebarCollapse,
        handleToggleZenMode,
        openSearchSidebarFromShortcut,
        openNewFileModalAt,
        openSettings,
        openQuickSearch,
        openTerminal,
        openSidebarViewFromShortcut,
        openStRunner,
        openUploadFilePickerAt,
        openUploadFolderPickerAt,
        revealActiveDocumentInSidebar,
        selectOpenTabByIndex,
        selectOpenTabByOffset,
        settingsOpen,
        showBottomDockTab,
        showCommandPalette,
        showKeyboardHelp,
        showMembersModal,
        showNewFileModal,
        showNewWorkspaceModal,
        showWorkspaceManagerModal,
        showPasswordModal,
        showPricingModal,
        showQuickSearch,
        syncNowFromShortcut,
        toggleBottomDockTab,
        dockInitialTab,
        openTabs,
        selectedDocId
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

    const treeModel = useMemo(
        () => buildWorkspaceTreeModel(folders, docs),
        [folders, docs]
    );
    const { docsByFolder, folderChildrenMap } = treeModel;

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

    const handleDocDragStart = useCallback((e: ReactDragEvent, docItem: DocItem) => {
        markInternalDragStart();
        e.dataTransfer.setData('application/x-dashboard-internal-drag', 'doc');
        e.dataTransfer.setData('application/x-doc-id', docItem.id);
        e.dataTransfer.setData('text/plain', docItem.id);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDocDragEnd = useCallback(() => {
        markInternalDragEnd();
        setFolderDragOver(null);
        setDropPosition(null);
    }, []);

    const isPureReorderDrag = useCallback((types: string[]) => {
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        const hasFolderReorder = types.includes('application/x-folder-reorder');
        const hasDocReorderOnly = types.includes('application/x-doc-reorder') && !hasDocId;
        return hasFolderReorder || hasDocReorderOnly;
    }, []);

    const _handleDropZoneDragOver = useCallback((e: ReactDragEvent, position: number) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = isPureReorderDrag(types);
        if (isReorderDrag) return;
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId || types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(prev => (prev === position ? prev : position));
    }, [isPureReorderDrag]);

    const _handleDropZoneDragLeave = useCallback((e: ReactDragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
    }, []);

    const _handleDropZoneDrop = useCallback((e: ReactDragEvent, position: number) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = isPureReorderDrag(types);
        if (isReorderDrag) return;
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId || types.includes('Files')) return;
        const docId = e.dataTransfer.getData('application/x-doc-id') || e.dataTransfer.getData('text/plain');
        if (!docId) return;
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
        const docToOpen = docById.get(docId) ?? openTabsById.get(docId);
        if (docToOpen) {
            setOpenTabs(prev => {
                const filtered = prev.filter(t => t.id !== docToOpen.id);
                const newTabs = [...filtered];
                newTabs.splice(position, 0, docToOpen);
                return newTabs;
            });
            setSelectedDocId(docToOpen.id);
        }
    }, [docById, isPureReorderDrag, openTabsById, setOpenTabs]);

    const handleFolderDragOver = useCallback((e: ReactDragEvent, folderName: string) => {
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = isPureReorderDrag(types);
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
    }, [isPureReorderDrag]);

    const handleFolderDragLeave = useCallback((folderName: string) => {
        setFolderDragOver(prev => (prev === folderName ? null : prev));
    }, []);

    const handleFolderDrop = useCallback(async (e: ReactDragEvent, folderName: string) => {
        const didUpload = await uploadDroppedFilesToFolder(e, folderName);
        if (didUpload) {
            setFolderDragOver(null);
            return;
        }
        const types = Array.from(e.dataTransfer.types ?? []);
        const isReorderDrag = isPureReorderDrag(types);
        if (isReorderDrag) return;
        const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
        if (!hasDocId) return;
        const docId = e.dataTransfer.getData('application/x-doc-id') || e.dataTransfer.getData('text/plain');
        if (!docId) return;
        e.preventDefault();
        setFolderDragOver(null);
        await moveDocumentToFolder(docId, folderName);
    }, [isPureReorderDrag, moveDocumentToFolder, uploadDroppedFilesToFolder]);

    const deleteDocument = useCallback(async (docItem: DocItem, e: ReactMouseEvent) => {
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
    }, [deleteDocRecords, deletingIds, showDialog]);

    const deleteDocuments = useCallback(async (docItems: DocItem[]) => {
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
    }, [deleteDocRecords, deleteDocument, deletingIds, showDialog]);

    const getIcon = useCallback((doc: DocItem) => {
        if (doc.type === 'terminal') return <TerminalIcon className="w-5 h-5" />;
        if (doc.type === 'board') return <KanbanSquare className="w-5 h-5" />;
        if (doc.type === 'file') {
            if (doc.mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
            if (isMarkdownDocItem(doc)) return <FileText className="w-5 h-5" />;
            return <FileIcon className="w-5 h-5" />;
        }
        return <FileText className="w-5 h-5" />;
    }, []);

    const handleSidebarCreateDoc = useCallback(() => { openNewFileModalAt(); }, [openNewFileModalAt]);
    const handleSidebarCreateFolder = useCallback(() => { void createFolderAtPath(); }, [createFolderAtPath]);
    const handleSidebarCreateFolderInFolder = useCallback((folderPath: string) => {
        void createFolderAtPath(folderPath);
    }, [createFolderAtPath]);
    const handleSidebarUploadFile = useCallback(() => { openUploadFilePickerAt(); }, [openUploadFilePickerAt]);
    const handleSidebarUploadFolder = useCallback(() => { openUploadFolderPickerAt(); }, [openUploadFolderPickerAt]);
    const handleSidebarShowDocProperties = useCallback((doc: DocItem) => {
        void showDocumentProperties(doc);
    }, [showDocumentProperties]);
    const handleSidebarShowFolderProperties = useCallback((folder: FolderItem) => {
        void showFolderProperties(folder);
    }, [showFolderProperties]);
    const handleSidebarShowCurrentLocationProperties = useCallback(() => {
        void showCurrentLocationProperties();
    }, [showCurrentLocationProperties]);
    const handleSidebarRenameFolder = useCallback((folder: FolderItem) => {
        void promptRenameFolder(folder);
    }, [promptRenameFolder]);
    const handleSidebarDeleteFolder = useCallback((folder: FolderItem) => {
        void deleteFolder(folder);
    }, [deleteFolder]);

    const paletteCommands = useMemo<PaletteCommand[]>(() => [
        {
            id: 'file.new',
            category: 'Archivos',
            label: 'Nuevo archivo',
            shortcut: 'Ctrl+N',
            keywords: ['create', 'crear', 'nuevo', 'documento'],
            run: () => openNewFileModalAt()
        },
        {
            id: 'file.open',
            category: 'Archivos',
            label: 'Subir / abrir archivo del sistema',
            shortcut: 'Ctrl+O',
            keywords: ['open', 'abrir', 'subir', 'upload', 'archivo'],
            run: () => openUploadFilePickerAt()
        },
        {
            id: 'file.openFolder',
            category: 'Archivos',
            label: 'Subir carpeta',
            shortcut: 'Ctrl+K Ctrl+O',
            keywords: ['folder', 'carpeta', 'upload', 'abrir carpeta'],
            run: () => openUploadFolderPickerAt()
        },
        {
            id: 'file.save',
            category: 'Archivos',
            label: 'Guardar / sincronizar ahora',
            shortcut: 'Ctrl+S',
            keywords: ['save', 'guardar', 'sincronizar', 'sync'],
            run: () => syncNowFromShortcut()
        },
        {
            id: 'file.search',
            category: 'Archivos',
            label: 'Buscar archivos…',
            shortcut: 'Ctrl+P / Ctrl+E',
            keywords: ['find', 'buscar', 'encontrar'],
            run: () => setShowQuickSearch(true)
        },
        {
            id: 'file.copyPath',
            category: 'Archivos',
            label: 'Copiar ruta del archivo activo',
            shortcut: 'Ctrl+K Ctrl+P',
            keywords: ['path', 'ruta', 'copiar'],
            run: () => copyActiveDocumentPath()
        },
        {
            id: 'file.revealActive',
            category: 'Archivos',
            label: 'Revelar archivo activo en el explorador',
            shortcut: 'Ctrl+K Ctrl+R',
            keywords: ['reveal', 'mostrar', 'explorador', 'archivo activo'],
            run: () => revealActiveDocumentInSidebar()
        },
        {
            id: 'file.closeActive',
            category: 'Archivos',
            label: 'Cerrar pestaña activa',
            shortcut: 'Ctrl+W',
            keywords: ['close', 'cerrar', 'tab', 'pestaña'],
            run: () => closeActiveTabFromShortcut()
        },
        {
            id: 'file.closeAll',
            category: 'Archivos',
            label: 'Cerrar todas las pestañas',
            shortcut: 'Ctrl+K Ctrl+W',
            keywords: ['close all', 'cerrar todo', 'tabs', 'pestañas'],
            run: () => closeAllTabsFromShortcut()
        },
        {
            id: 'view.toggleSidebar',
            category: 'Vista',
            label: 'Alternar barra lateral',
            shortcut: 'Ctrl+B',
            keywords: ['sidebar', 'panel', 'archivos'],
            run: () => handleToggleSidebarCollapse()
        },
        {
            id: 'view.files',
            category: 'Vista',
            label: 'Mostrar Explorador',
            shortcut: 'Ctrl+Shift+E',
            keywords: ['explorer', 'archivos', 'files'],
            run: () => openSidebarViewFromShortcut('files')
        },
        {
            id: 'view.search',
            category: 'Vista',
            label: 'Mostrar búsqueda',
            shortcut: 'Ctrl+Shift+F',
            keywords: ['search', 'buscar', 'find in files'],
            run: () => openSearchSidebarFromShortcut()
        },
        {
            id: 'view.git',
            category: 'Vista',
            label: 'Mostrar control de versiones',
            shortcut: 'Ctrl+Shift+G',
            keywords: ['git', 'scm', 'source control'],
            run: () => openSidebarViewFromShortcut('git')
        },
        {
            id: 'view.tools',
            category: 'Vista',
            label: 'Mostrar herramientas',
            shortcut: 'Ctrl+Shift+D',
            keywords: ['run', 'debug', 'herramientas', 'tools'],
            run: () => openSidebarViewFromShortcut('tools')
        },
        {
            id: 'view.outline',
            category: 'Vista',
            label: 'Mostrar esquema del documento',
            shortcut: 'Ctrl+Shift+O',
            keywords: ['outline', 'symbol', 'simbolos', 'esquema'],
            run: () => openSidebarViewFromShortcut('outline')
        },
        {
            id: 'view.snippetsSidebar',
            category: 'Vista',
            label: 'Mostrar snippets',
            shortcut: 'Ctrl+Shift+X',
            keywords: ['snippets', 'extensions', 'plantillas'],
            run: () => openSidebarViewFromShortcut('snippets')
        },
        {
            id: 'view.toggleTerminal',
            category: 'Vista',
            label: 'Alternar terminal',
            shortcut: 'Ctrl+`',
            keywords: ['terminal', 'consola', 'shell', 'panel inferior', 'output'],
            run: () => toggleBottomDockTab('terminal')
        },
        {
            id: 'view.toggleProblems',
            category: 'Vista',
            label: 'Alternar Problemas',
            shortcut: 'Ctrl+Shift+M',
            keywords: ['problemas', 'errores', 'lint', 'diagnostics'],
            run: () => showBottomDockTab('problems')
        },
        {
            id: 'view.togglePanel',
            category: 'Vista',
            label: 'Alternar panel inferior',
            shortcut: 'Ctrl+J',
            keywords: ['panel', 'dock', 'inferior'],
            run: () => toggleBottomDockTab(dockInitialTab || 'terminal')
        },
        {
            id: 'view.output',
            category: 'Vista',
            label: 'Mostrar salida / problemas',
            shortcut: 'Ctrl+K Ctrl+H',
            keywords: ['output', 'salida', 'problems', 'diagnostics'],
            run: () => showBottomDockTab('problems')
        },
        {
            id: 'view.toggleAI',
            category: 'Vista',
            label: 'Alternar Agora AI',
            shortcut: 'Ctrl+Shift+I / Ctrl+Alt+I',
            keywords: ['ai', 'copilot', 'chat', 'asistente'],
            run: () => setRightPanelOpen((v) => !v)
        },
        {
            id: 'diagnostics.clear',
            category: 'Diagnóstico',
            label: 'Limpiar todos los problemas',
            keywords: ['clear', 'limpiar', 'errores', 'problemas'],
            run: () => { void import('@/lib/diagnostics-bus').then((m) => m.clearDiagnostics()); }
        },
        {
            id: 'help.shortcuts',
            category: 'Ayuda',
            label: 'Atajos de teclado',
            shortcut: '? / Ctrl+K Ctrl+S',
            keywords: ['shortcuts', 'atajos', 'teclado', 'help', 'ayuda'],
            run: () => setShowKeyboardHelp(true)
        },
        {
            id: 'workbench.commands',
            category: 'Ayuda',
            label: 'Mostrar todos los comandos',
            shortcut: 'Ctrl+Shift+P / F1',
            keywords: ['command palette', 'paleta', 'comandos'],
            run: () => setShowCommandPalette(true)
        },
        {
            id: 'preferences.openSettings',
            category: 'Preferencias',
            label: 'Abrir ajustes',
            shortcut: 'Ctrl+,',
            keywords: ['settings', 'configuracion', 'preferencias'],
            run: () => openSettings()
        },
        {
            id: 'view.zen',
            category: 'Vista',
            label: 'Modo Zen',
            shortcut: 'Ctrl+K Z / F11',
            keywords: ['focus', 'concentración', 'pantalla limpia'],
            run: () => handleToggleZenMode()
        },
        ...SIDEBAR_VIEWS.map((v) => ({
            id: `view.${v.id}`,
            category: 'Vista',
            label: v.label,
            shortcut: v.shortcut,
            keywords: [v.id, v.label.toLowerCase()],
            run: () => setActivityView(v.id)
        })),
        {
            id: 'workspace.manage',
            category: 'Workspace',
            label: 'Gestionar workspaces',
            keywords: ['cambiar', 'switch', 'lista', 'workspaces'],
            run: () => setShowWorkspaceManagerModal(true)
        },
        {
            id: 'tools.board',
            category: 'Herramientas',
            label: 'Tablero (Kanban)',
            keywords: ['kanban', 'tablero', 'tareas'],
            run: () => openBoard()
        },
        {
            id: 'tools.st',
            category: 'Herramientas',
            label: 'ST Logic',
            keywords: ['logic', 'pruebas', 'formal'],
            run: () => openStRunner()
        },
        {
            id: 'tools.semantic',
            category: 'Herramientas',
            label: 'Mesa semántica',
            keywords: ['semántica', 'concepts'],
            run: () => openSemanticBrowser()
        },
        {
            id: 'tools.formalizer',
            category: 'Herramientas',
            label: 'Formalizador',
            keywords: ['nl2st', 'formalizar'],
            run: () => openFormalizer()
        },
        {
            id: 'view.snippets',
            category: 'Vista',
            label: 'Snippets',
            shortcut: 'Ctrl+Shift+X',
            keywords: ['snippets', 'galería'],
            run: () => openSidebarViewFromShortcut('snippets')
        },
        {
            id: 'terminal.new',
            category: 'Terminal',
            label: 'Nueva sesión de terminal',
            shortcut: 'Ctrl+Shift+`',
            keywords: ['terminal', 'shell', 'session'],
            run: () => handleRequestNewTerminal()
        },
        {
            id: 'terminal.tab',
            category: 'Terminal',
            label: 'Abrir terminal como tab',
            shortcut: 'Ctrl+Shift+C',
            keywords: ['terminal', 'shell', 'tab', 'pestaña'],
            run: () => { void openTerminal(); }
        },
        {
            id: 'workspace.members',
            category: 'Workspace',
            label: 'Miembros del workspace',
            keywords: ['team', 'miembros'],
            run: () => setShowMembersModal(true)
        },
        {
            id: 'account.password',
            category: 'Cuenta',
            label: 'Cambiar contraseña',
            keywords: ['password', 'contraseña'],
            run: () => {
                setPasswordForm({ current: '', new: '', confirm: '' });
                setPasswordError('');
                setPasswordSuccess(false);
                setShowPasswordModal(true);
            }
        },
        {
            id: 'account.pricing',
            category: 'Cuenta',
            label: 'Plan y suscripción',
            keywords: ['plan', 'pricing', 'pagar'],
            run: () => setShowPricingModal(true)
        },
        {
            id: 'account.logout',
            category: 'Cuenta',
            label: 'Cerrar sesión',
            keywords: ['logout', 'salir'],
            run: () => logout()
        }
    ], [
        closeActiveTabFromShortcut,
        closeAllTabsFromShortcut,
        copyActiveDocumentPath,
        dockInitialTab,
        handleToggleSidebarCollapse,
        handleToggleZenMode,
        handleRequestNewTerminal,
        logout,
        openBoard,
        openFormalizer,
        openNewFileModalAt,
        openSearchSidebarFromShortcut,
        openSemanticBrowser,
        openSettings,
        openSidebarViewFromShortcut,
        openStRunner,
        openTerminal,
        openUploadFilePickerAt,
        openUploadFolderPickerAt,
        revealActiveDocumentInSidebar,
        setPasswordError,
        setPasswordForm,
        setPasswordSuccess,
        setShowMembersModal,
        setShowPasswordModal,
        setShowPricingModal,
        setShowQuickSearch,
        showBottomDockTab,
        syncNowFromShortcut,
        toggleBottomDockTab
    ]);

    if (loading || !user) {
        const skeletonSidebarWidth = readPersistedSidebarWidth();
        return (
            <div className="flex h-[100dvh] flex-col bg-surface-900 text-white overflow-hidden">
                <div className="h-12 border-b border-surface-700/40 bg-surface-800/40 flex items-center px-4 gap-3">
                    <div className="h-6 w-6 rounded bg-surface-700/60 animate-pulse" />
                    <div className="h-4 w-32 rounded bg-surface-700/60 animate-pulse" />
                    <div className="ml-auto h-4 w-20 rounded bg-surface-700/60 animate-pulse" />
                </div>
                <div className="flex-1 flex">
                    <div className="w-12 border-r border-surface-700/40 bg-surface-800/30 flex flex-col items-center gap-3 py-3 shrink-0">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-6 w-6 rounded bg-surface-700/60 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                        ))}
                    </div>
                    <div className="border-r border-surface-700/40 bg-surface-900 px-3 py-3 space-y-2 shrink-0" style={{ width: skeletonSidebarWidth }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-7 rounded bg-surface-700/40 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                        ))}
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-xs text-surface-500 flex items-center gap-3">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-surface-700 border-t-mandy-500" />
                            <span>Cargando workspace…</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <LazyMotion features={domAnimation}>
            <div
                className="h-[100dvh] bg-surface-900 flex flex-col text-white overflow-hidden relative"
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
                {showQuickSearch && (
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
                )}

                {showCommandPalette && (
                    <CommandPalette
                        open={showCommandPalette}
                        onClose={() => setShowCommandPalette(false)}
                        commands={paletteCommands}
                        modalFade={modalFade}
                        modalPop={modalPop}
                    />
                )}

                {showKeyboardHelp && (
                    <KeyboardShortcuts
                        open={showKeyboardHelp}
                        onClose={() => setShowKeyboardHelp(false)}
                        modalFade={modalFade}
                        modalPop={modalPop}
                    />
                )}

                <UserMenu
                    open={userMenuOpen}
                    onClose={() => setUserMenuOpen(false)}
                    anchorRef={userMenuButtonRef}
                    email={userEmail || user?.email || ''}
                    displayName={user?.displayName}
                    planName={PLANS[currentPlan]?.name}
                    onChangePassword={() => {
                        setPasswordForm({ current: '', new: '', confirm: '' });
                        setPasswordError('');
                        setPasswordSuccess(false);
                        setShowPasswordModal(true);
                    }}
                    onShowMembers={() => setShowMembersModal(true)}
                    onOpenPricing={() => setShowPricingModal(true)}
                    onOpenSettings={() => openSettings()}
                    onLogout={() => logout()}
                />

                {settingsOpen && (
                    <SettingsModal
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        initialSection={settingsInitialSection}
                        activeWorkspaceId={currentWorkspace?.id}
                        activeUserId={user?.uid}
                        onOpenChangePassword={() => {
                            setPasswordForm({ current: '', new: '', confirm: '' });
                            setPasswordError('');
                            setPasswordSuccess(false);
                            setShowPasswordModal(true);
                        }}
                        onOpenMembers={() => setShowMembersModal(true)}
                        onOpenWorkerInstall={() => setShowWorkerInstallModal(true)}
                    />
                )}

                {showWorkerInstallModal && (
                    <WorkerInstallModal
                        open={showWorkerInstallModal}
                        onClose={() => setShowWorkerInstallModal(false)}
                        workspaceId={currentWorkspace?.id}
                        workspaceName={currentWorkspace?.name}
                        isOwner={!!user && !!currentWorkspace && (currentWorkspace.ownerId === user.uid || isAdmin)}
                        modalFade={modalFade}
                        modalPop={modalPop}
                    />
                )}

                {showWhatsNew && (
                    <WhatsNewModal
                        open={showWhatsNew}
                        version="v1.0"
                        onDismiss={() => {
                            setShowWhatsNew(false);
                            try {
                                window.localStorage.setItem('agora-whats-new-v1.0:dismissed', 'true');
                            } catch {
                                /* noop */
                            }
                        }}
                        modalFade={modalFade}
                        modalPop={modalPop}
                    />
                )}

                <DragOverlay isDragActive={isDragActive} workspaceName={currentWorkspace?.name} activeFolder={activeFolder} onDismiss={dismissDragOverlay} />
                <StatusToasts uploadStatus={uploadStatus} deleteStatus={deleteStatus} />
                {dialogConfig && (
                    <DialogModal
                        dialogConfig={dialogConfig}
                        dialogInputValue={dialogInputValue}
                        onDialogInputChange={setDialogInputValue}
                        onConfirm={confirmDialog}
                        onCancel={cancelDialog}
                        modalFade={modalFade}
                        modalPop={modalPop}
                    />
                )}
                {showNewFileModal && (
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
                )}

                {/* HeaderBar eliminada: workspace, tools, terminales y user menu viven ahora en ActivityBar/LeftPanel.
                    Los inputs file/folder antes vivían en HeaderBar; sin ellos los refs quedaban null y los botones
                    "Subir archivos/carpeta" no respondían. Los renderizamos aquí ocultos. */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    multiple
                />
                <input
                    type="file"
                    ref={folderInputRef}
                    className="hidden"
                    onChange={handleFolderUpload}
                    multiple
                />

                {!isZenMode && (
                    <MobileTopBar
                        workspaceLabel={currentWorkspace?.name ?? 'Sin workspace'}
                        workspaceInitial={(currentWorkspace?.name ?? 'A').slice(0, 1)}
                        userInitial={(userEmail || user?.email || 'U').slice(0, 1)}
                        hasInvites={invites.length > 0}
                        workerStatus={workerStatus}
                        onOpenDrawer={() => setShowMobileSidebar(true)}
                        onOpenSearch={() => { setActivityView('search'); setShowMobileSidebar(true); }}
                        onOpenUserMenu={() => setUserMenuOpen(true)}
                    />
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
                    {showMobileSidebar && !isZenMode && (
                      <div
                        className="md:hidden fixed inset-0 z-30 bg-black/40"
                        onClick={() => setShowMobileSidebar(false)}
                        aria-hidden
                      />
                    )}

                    <div
                      data-mobile-drawer={showMobileSidebar ? 'open' : 'closed'}
                      className={`
                        flex flex-col shrink-0 z-40 h-full bg-surface-900
                        md:relative md:translate-x-0 md:transform-none
                        fixed inset-y-0 left-0 transform transition-transform duration-150
                        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
                        ${isZenMode ? 'hidden md:hidden' : ''}
                      `}
                      aria-hidden={isCompact && !showMobileSidebar}
                    >
                    {!isZenMode && (
                      <WorkspaceTopBar
                        workspaceLabel={currentWorkspace?.name ?? 'Sin workspace'}
                        workspaceInitial={(currentWorkspace?.name ?? 'A').slice(0, 1)}
                        hasInvites={invites.length > 0}
                        onOpenWorkspaceManager={() => setShowWorkspaceManagerModal(true)}
                        sidebarCollapsed={isSidebarCollapsed}
                        onToggleSidebar={handleToggleSidebarCollapse}
                        bottomDockOpen={bottomDockOpen}
                        onToggleBottomDock={() => { setDockInitialTab('terminal'); setBottomDockOpen((v) => !v); }}
                        rightPanelOpen={rightPanelOpen}
                        onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
                        totalWidth={48 + (isSidebarCollapsed ? 0 : effectiveSidebarWidth)}
                        presencePeers={presencePeers}
                        presenceCurrentDocId={selectedDocId}
                        presenceResolveDocName={resolvePresenceDocName}
                      />
                    )}

                    <div className="flex flex-1 min-h-0">
                    {!isZenMode && (
                      <ActivityBar
                        active={activityView}
                        onChange={(v) => {
                          setActivityView(v);
                          if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                        }}
                        isZenMode={isZenMode}
                        onToggleZenMode={handleToggleZenMode}
                        userInitial={(userEmail || user?.email || 'U').slice(0, 1)}
                        userMenuOpen={userMenuOpen}
                        onToggleUserMenu={() => setUserMenuOpen((v) => !v)}
                        userMenuButtonRef={userMenuButtonRef}
                      />
                    )}

                    {activityView === 'files' ? (
                      <Sidebar
                        sidebarWidth={effectiveSidebarWidth}
                        isCollapsed={isSidebarCollapsed}
                        showMobileSidebar={showMobileSidebar}
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
                        docsByFolder={docsByFolder}
                        folderChildrenMap={folderChildrenMap}
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
                        onCreateDoc={handleSidebarCreateDoc}
                        onCreateFolder={handleSidebarCreateFolder}
                        onCreateDocInFolder={openNewFileModalAt}
                        onCreateFolderInFolder={handleSidebarCreateFolderInFolder}
                        onUploadFile={handleSidebarUploadFile}
                        onUploadFolder={handleSidebarUploadFolder}
                        onUploadFileToFolder={openUploadFilePickerAt}
                        onUploadFolderToFolder={openUploadFolderPickerAt}
                        onShowDocProperties={handleSidebarShowDocProperties}
                        onShowFolderProperties={handleSidebarShowFolderProperties}
                        onShowCurrentLocationProperties={handleSidebarShowCurrentLocationProperties}
                        onRenameFolder={handleSidebarRenameFolder}
                        onDeleteFolder={handleSidebarDeleteFolder}
                        docById={docById}
                      />
                    ) : (
                      !isSidebarCollapsed && (
                        <aside
                          className="shrink-0 border-r border-surface-700/60"
                          style={{ width: effectiveSidebarWidth }}
                        >
                          <LeftPanel
                            view={activityView}
                            currentWorkspace={currentWorkspace}
                            userUid={user?.uid}
                            searchQuery={quickSearchQuery}
                            onSearchQueryChange={setQuickSearchQuery}
                            searchResults={semanticSearchResults}
                            searchLoading={semanticSearchLoading}
                            searchError={semanticSearchError}
                            searchFilter={quickSearchFilter}
                            onSearchFilterChange={setQuickSearchFilter}
                            searchSelectedIndex={quickSearchIndex}
                            onSearchSelectIndex={setQuickSearchIndex}
                            onSearchSelect={(r) => { void handleQuickSearchSelect(r); }}
                            onSearchKeyDown={handleQuickSearchKeyDown}
                            searchInputRef={quickSearchInputRef}
                            onOpenBoard={openBoard}
                            onOpenStRunner={openStRunner}
                            onOpenSemanticBrowser={openSemanticBrowser}
                            onOpenFormalizer={openFormalizer}
                            isBoardOpen={isBoardOpen}
                            isStRunnerOpen={isStRunnerOpen}
                            isSemanticBrowserOpen={isSemanticBrowserOpen}
                            isFormalizerOpen={isFormalizerOpen}
                            selectedDoc={selectedDocForOutline}
                            onJumpToLine={(line) => {
                              dispatchAgoraEvent(AGORA_EVENTS.jumpToLine, { line });
                            }}
                            filesContent={null}
                          />
                        </aside>
                      )
                    )}
                    </div>
                    </div>

                    {/* Resize Handle */}
                    {!isSidebarCollapsed && (
                        <div
                            onMouseDown={startResizingSidebar}
                            className={`hidden md:block w-1.5 h-full cursor-col-resize absolute z-50 hover:bg-mandy-500/40 transition-colors ${isResizingSidebar ? 'bg-mandy-500' : 'bg-transparent'}`}
                            style={{ left: (isZenMode ? 0 : 48) + sidebarWidth - 3 }}
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
                      <PanelGroup orientation="horizontal" id="agora-shell-horizontal" className="flex h-full w-full">
                        <Panel id="editor-column" minSize="30%">
                          <PanelGroup orientation="vertical" id="agora-shell-vertical" className="flex h-full w-full flex-col">
                            <Panel id="editor-main" minSize="20%">
                              <div className="relative h-full w-full flex flex-col">
                        {effectiveMosaicNode ? (
                            <div className="flex-1 min-h-0 relative">
                                <MosaicLayout
                                    value={effectiveMosaicNode}
                                    onChange={isCompact ? () => { /* readonly en mobile */ } : setMosaicNode}
                                    openTabs={openTabs}
                                    docs={docs}
                                    folders={folders}
                                    docModes={docModes}
                                    selectedDocId={selectedDocId}
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
                                        const doc = docById.get(docId);
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
                            <WelcomeView
                                workspaceName={currentWorkspace?.name}
                                recentDocs={recentDocs}
                                loadingRecents={loadingDocs}
                                onOpenDoc={openDocument}
                                onCreateDoc={() => openNewFileModalAt()}
                                onCreateFolder={() => { void createFolderAtPath(); }}
                                onUploadFile={() => openUploadFilePickerAt(activeFolder)}
                                onOpenSearch={() => { setActivityView('search'); if (isCompact) setShowMobileSidebar(true); }}
                                onOpenFiles={() => { setActivityView('files'); if (isCompact) setShowMobileSidebar(true); }}
                                onOpenTerminal={() => setBottomDockOpen(true)}
                                onOpenGit={() => { setActivityView('git'); if (isCompact) setShowMobileSidebar(true); }}
                                onOpenBoard={openBoard}
                                onOpenStRunner={openStRunner}
                                onOpenAI={() => setRightPanelOpen(true)}
                            />
                        )}
                              </div>
                            </Panel>

                            {bottomDockOpen && (
                              <>
                                <PanelResizeHandle
                                    aria-label="Redimensionar panel inferior"
                                    style={{ height: 5, cursor: 'row-resize' }}
                                    className="bg-surface-800 hover:bg-mandy-500/50 active:bg-mandy-500/70 transition-colors shrink-0"
                                />
                                <Panel id="bottom-dock" defaultSize="30%" minSize="15%" maxSize="70%">
                                  <BottomDock
                                    open
                                    initialTab={dockInitialTab}
                                    onToggle={() => setBottomDockOpen(false)}
                                    workspaceId={currentWorkspace?.id}
                                    workspaceName={currentWorkspace?.name}
                                    workspaceType={currentWorkspace?.type}
                                    nexusUrl={process.env.NEXT_PUBLIC_NEXUS_URL || 'http://localhost:3002'}
                                    sessions={terminalSessions}
                                    activeSessionId={activeSessionId}
                                    isCreatingSession={isCreatingSession}
                                    workerStatus={workerStatus}
                                    onCreateSession={createWorkspaceTerminal}
                                    onSelectSession={(id) => selectSession(id)}
                                    onDestroySession={(id) => destroySession(id)}
                                    onRenameSession={(id) => {
                                      const s = terminalSessions.find(t => t.id === id);
                                      if (s) void promptRenameTerminalSession(s);
                                    }}
                                    resolveDocName={(uri) => docById.get(uri)?.name ?? null}
                                    onOpenDocument={(uri, range) => {
                                      const doc = docById.get(uri);
                                      if (!doc) return;
                                      void openDocument(doc);
                                      if (range && typeof range.line === 'number') {
                                        // Esperar a que el editor monte y luego pedir jump.
                                        setTimeout(() => {
                                          dispatchAgoraEvent(AGORA_EVENTS.jumpToLine, {
                                            docId: doc.id,
                                            line: range.line,
                                            ...(typeof range.column === 'number' ? { column: range.column } : {})
                                          });
                                        }, 350);
                                      }
                                    }}
                                  />
                                </Panel>
                              </>
                            )}
                          </PanelGroup>
                        </Panel>

                        {rightPanelOpen && !isCompact && (
                          <>
                            <PanelResizeHandle
                                aria-label="Redimensionar panel Agora AI"
                                style={{ width: 5, cursor: 'col-resize' }}
                                className="bg-surface-800 hover:bg-mandy-500/50 active:bg-mandy-500/70 transition-colors shrink-0"
                            />
                            <Panel id="right-panel" defaultSize="35%" minSize="20%" maxSize="65%">
                              <RightPanel
                                open
                                currentWorkspace={currentWorkspace}
                              />
                            </Panel>
                          </>
                        )}
                      </PanelGroup>
                      {rightPanelOpen && isCompact && (
                        <div
                          className="fixed inset-x-0 bottom-0 top-11 z-40 flex bg-surface-900"
                          role="dialog"
                          aria-modal="true"
                          aria-label="Panel Agora AI"
                        >
                          <RightPanel
                            open
                            currentWorkspace={currentWorkspace}
                            onClose={() => setRightPanelOpen(false)}
                          />
                        </div>
                      )}

                    </div>
                </div>

                {!isZenMode && (
                    <StatusBar
                        workspaceLabel={currentWorkspace?.name ?? 'Sin workspace'}
                        workerStatus={workerStatus}
                        isOnline={isOnline}
                        onOpenProblems={() => { setDockInitialTab('problems'); setBottomDockOpen(true); }}
                        sidebarCollapsed={isSidebarCollapsed}
                        onShowSidebar={handleToggleSidebarCollapse}
                        activeFileExt={(() => {
                          const doc = selectedDocId ? docById.get(selectedDocId) ?? null : null;
                          if (!doc?.name) return null;
                          const dot = doc.name.lastIndexOf('.');
                          if (dot < 0 || dot === doc.name.length - 1) return null;
                          return doc.name.slice(dot + 1).toLowerCase();
                        })()}
                    />
                )}

                {showWorkspaceManagerModal && (
                    <WorkspaceManagerModal
                        isOpen={showWorkspaceManagerModal}
                        onClose={() => setShowWorkspaceManagerModal(false)}
                        workspaces={workspaces}
                        invites={invites}
                        currentWorkspace={currentWorkspace}
                        user={user}
                        isAdmin={isAdmin}
                        deletingWorkspaceId={deletingWorkspaceId}
                        personalWorkspaceId={PERSONAL_WORKSPACE_ID}
                        onAcceptInvite={acceptInvite}
                        onSelectWorkspace={selectWorkspace}
                        onRenameWorkspace={renameWorkspace}
                        onDuplicateWorkspace={duplicateWorkspace}
                        onMergeWorkspace={mergeWorkspaceIntoCurrent}
                        onDeleteWorkspace={deleteWorkspace}
                        onNewWorkspace={() => setShowNewWorkspaceModal(true)}
                        onOpenMembers={openMembersForWorkspace}
                        modalFade={modalFade}
                        modalPop={modalPop}
                    />
                )}

                {showNewWorkspaceModal && (
                    <NewWorkspaceModal
                        isOpen={showNewWorkspaceModal}
                        onClose={() => setShowNewWorkspaceModal(false)}
                        workspaceName={newWorkspaceName}
                        setWorkspaceName={setNewWorkspaceName}
                        onCreate={createWorkspace}
                        modalFade={modalFade}
                    />
                )}

                {currentWorkspace && showMembersModal && (
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

                {showPasswordModal && (
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
                )}

                {showPricingModal && (
                    <PricingModal
                        isOpen={showPricingModal}
                        onClose={() => setShowPricingModal(false)}
                        currentPlan={currentPlan}
                        userEmail={userEmail}
                        endDate={subscriptionEndDate}
                    />
                )}
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
        <Suspense fallback={<div className="flex h-[100dvh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}>
            <DashboardContent />
        </Suspense>
    );
}
