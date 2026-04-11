'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  BookMarked,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crown,
  FolderOpen,
  FlaskConical,
  KanbanSquare,
  Key,
  Loader2,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Terminal as TerminalIcon,
  Trash2,
  User,
  Users,
  X,
  Zap
} from 'lucide-react';
import type { DocItem, Workspace } from '@/components/dashboard/types';
import type { TerminalSession } from '@/context/TerminalContext';
import type { User as FirebaseUser } from 'firebase/auth';
import { fetchStorageUsage, type StorageUsage } from '@/services/subscriptionApi';
import { TerminalConnectionStatus, WorkerStatusValue, type TerminalConnectionStatusId, type WorkerStatus } from '@/types/terminal';
import { PERSONAL_WORKSPACE_ID, WorkspaceType, type WorkspaceTypeId } from '@/types/workspace';
import { formatStorageSize } from '@/types/subscription';

interface HeaderBarProps {
  onToggleMobileSidebar: () => void;
  onClearSelectedDoc: () => void;
  isZenMode: boolean;
  onToggleHeaderCollapse: () => void;
  onToggleZenMode: () => void;
  showWorkspaceMenu: boolean;
  setShowWorkspaceMenu: (value: boolean) => void;
  currentWorkspace: Workspace | null;
  invites: Workspace[];
  workspaces: Workspace[];
  user: FirebaseUser | null;
  isOnline: boolean;
  deletingWorkspaceId: string | null;
  personalWorkspaceId: string;
  isAdmin: boolean;
  isBoardOpen: boolean;
  onOpenBoard: () => void;
  isStRunnerOpen: boolean;
  onOpenStRunner: () => void;
  isSemanticBrowserOpen: boolean;
  onOpenSemanticBrowser: () => void;
  isFormalizerOpen: boolean;
  onOpenFormalizer: () => void;
  formalizerTileId: string | null;
  onOpenSnippetsGallery: () => void;
  onOpenQuickSearch: () => void;
  onAcceptInvite: (ws: Workspace) => void;
  onSelectWorkspace: (ws: Workspace) => void;
  onDeleteWorkspace: (ws: Workspace) => void;
  onNewWorkspace: () => void;
  onShowMembers: () => void;
  onOpenPassword: () => void;
  onLogout: () => void;
  /* Terminal / session props */
  connectionStatus: TerminalConnectionStatusId;
  isCreatingSession: boolean;
  activeSessionId: string | null;
  getWorkerStatusForWorkspace: (workspaceId: string) => WorkerStatus;
  getSessionsForWorkspace: (workspaceId: string) => TerminalSession[];
  createSession: (workspaceId: string, workspaceType: WorkspaceTypeId, workspaceName?: string) => void;
  selectSession: (sessionId: string) => void;
  destroySession: (sessionId: string) => void;
  onRenameSession: (session: TerminalSession) => void;
  onAddStInstructions: () => void;
  openTerminal: (session?: { id: string; name: string }) => void;
  openTabs: DocItem[];
  closeTabById: (tabId: string) => void;
  /* File action props (hidden inputs remain here) */
  fileInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  folderInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  openFilesTab: () => void;
  onOpenPricing?: () => void;
  currentPlanName?: string;
}

const HeaderBar = ({
  onToggleMobileSidebar,
  onClearSelectedDoc,
  isZenMode,
  onToggleHeaderCollapse,
  onToggleZenMode,
  showWorkspaceMenu,
  setShowWorkspaceMenu,
  currentWorkspace,
  invites,
  workspaces,
  user,
  isOnline,
  deletingWorkspaceId,
  personalWorkspaceId,
  isAdmin,
  isBoardOpen,
  onOpenBoard,
  isStRunnerOpen,
  onOpenStRunner,
  isSemanticBrowserOpen,
  onOpenSemanticBrowser,
  isFormalizerOpen,
  onOpenFormalizer,
  formalizerTileId,
  onOpenSnippetsGallery,
  onOpenQuickSearch,
  onAcceptInvite,
  onSelectWorkspace,
  onDeleteWorkspace,
  onNewWorkspace,
  onShowMembers,
  onOpenPassword,
  onLogout,
  connectionStatus,
  isCreatingSession,
  activeSessionId,
  getWorkerStatusForWorkspace,
  getSessionsForWorkspace,
  createSession,
  selectSession,
  destroySession,
  onRenameSession,
  onAddStInstructions,
  openTerminal,
  openTabs,
  closeTabById,
  fileInputRef,
  folderInputRef,
  handleFileUpload,
  handleFolderUpload,
  folderInputProps,
  openFilesTab,
  onOpenPricing,
  currentPlanName
}: HeaderBarProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuButtonRef = useRef<HTMLButtonElement>(null);

  // Load storage usage when user menu opens
  useEffect(() => {
    if (showUserMenu && !storageUsage) {
      fetchStorageUsage().then(setStorageUsage).catch(() => {});
    }
  }, [showUserMenu, storageUsage]);

  /* ── Terminal helpers ── */
  const workerToken = currentWorkspace && user
    ? (currentWorkspace.type === WorkspaceType.Personal || currentWorkspace.id === PERSONAL_WORKSPACE_ID
        ? `${PERSONAL_WORKSPACE_ID}:${user.uid}`
        : currentWorkspace.id)
    : '';

  const workerStatus = workerToken ? getWorkerStatusForWorkspace(workerToken) : WorkerStatusValue.Unknown;
  const isWorkerOnline = workerStatus === WorkerStatusValue.Online;
  const workspaceSessions = workerToken ? getSessionsForWorkspace(workerToken) : [];
  const boardPanelId = currentWorkspace ? `board-${currentWorkspace.id}` : '';
  const stRunnerPanelId = currentWorkspace ? `st-runner-${currentWorkspace.id}` : '';
  const semanticBrowserPanelId = currentWorkspace ? `semantic-browser-${currentWorkspace.id}` : '';
  const formalizerPanelId = formalizerTileId || (currentWorkspace ? `formalizer-${currentWorkspace.id}` : '');
  const snippetsGalleryPanelId = currentWorkspace ? `snippets-gallery-${currentWorkspace.id}` : '';
  const filesPanelId = currentWorkspace ? `files-${currentWorkspace.id}` : '';

  const handleCreateSession = useCallback(() => {
    if (!currentWorkspace || !user || !workerToken) return;
    createSession(workerToken, currentWorkspace.type, `Terminal ${workspaceSessions.length + 1}`);
  }, [currentWorkspace, user, workerToken, createSession, workspaceSessions.length]);

  const handleHeaderDragStart = useCallback((event: React.DragEvent<HTMLElement>, docId: string) => {
    if (!docId) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-doc-id', docId);
    event.dataTransfer.setData('text/plain', docId);
  }, []);

  const statusDot = isWorkerOnline
    ? 'bg-emerald-400'
    : connectionStatus === TerminalConnectionStatus.Checking
      ? 'bg-amber-400 animate-pulse'
      : 'bg-red-400';

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMenu = menuRef.current && menuRef.current.contains(target);
      const insideButton = menuButtonRef.current && menuButtonRef.current.contains(target);
      if (!insideMenu && !insideButton) {
        setMenuOpenId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  useEffect(() => {
    if (!showToolsMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMenu = toolsMenuRef.current && toolsMenuRef.current.contains(target);
      const insideButton = toolsMenuButtonRef.current && toolsMenuButtonRef.current.contains(target);
      if (!insideMenu && !insideButton) {
        setShowToolsMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showToolsMenu]);

  useEffect(() => {
    if (showWorkspaceMenu || showUserMenu) {
      setShowToolsMenu(false);
    }
  }, [showWorkspaceMenu, showUserMenu]);

  const panelTools = [
    {
      id: 'st',
      label: 'ST Logic',
      description: 'Ejecutor lógico y pruebas formales',
      icon: FlaskConical,
      active: isStRunnerOpen,
      dragId: stRunnerPanelId,
      onClick: onOpenStRunner,
      activeClasses: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
      iconClasses: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25'
    },
    {
      id: 'semantic',
      label: 'Semántica',
      description: 'Mesa semántica global del espacio',
      icon: BookMarked,
      active: isSemanticBrowserOpen,
      dragId: semanticBrowserPanelId,
      onClick: onOpenSemanticBrowser,
      activeClasses: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
      iconClasses: 'text-blue-300 bg-blue-500/15 border-blue-500/25'
    },
    {
      id: 'formalizer',
      label: 'Formalizar',
      description: 'Conversión asistida a lenguaje ST',
      icon: Zap,
      active: isFormalizerOpen,
      dragId: formalizerPanelId,
      onClick: onOpenFormalizer,
      activeClasses: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
      iconClasses: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/25'
    },
    {
      id: 'snippets',
      label: 'Snippets',
      description: 'Galería reutilizable del workspace',
      icon: Plus,
      active: openTabs.some(t => t.type === ('snippets-gallery' as string)),
      dragId: snippetsGalleryPanelId,
      onClick: onOpenSnippetsGallery,
      activeClasses: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      iconClasses: 'text-amber-300 bg-amber-500/15 border-amber-500/25'
    }
  ] as const;

  const utilityTools = [
    {
      id: 'team',
      label: 'Equipo',
      description: 'Ver miembros y colaboradores',
      icon: Users,
      onClick: onShowMembers
    },
    {
      id: 'docs',
      label: 'Ayuda',
      description: 'Abrir documentación en otra pestaña',
      icon: BookOpen,
      href: '/docs'
    }
  ] as const;

  return (
    <header className="h-11 bg-surface-800 border-b border-surface-600/50 flex items-center px-3 shrink-0 z-50 relative gap-2">
      {/* ── Left: Logo + Workspace ── */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1 text-surface-400 hover:bg-surface-700 rounded"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div onClick={onClearSelectedDoc} className="font-bold flex items-center gap-1.5 text-white cursor-pointer">
          <span className="bg-gradient-mandy text-white p-1 rounded-md text-xs font-bold">A</span>
          <span className="hidden lg:inline text-sm">Agora</span>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowToolsMenu(false);
              setShowUserMenu(false);
              setShowWorkspaceMenu(!showWorkspaceMenu);
            }}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-surface-700 rounded-lg transition border border-transparent hover:border-surface-600"
            title={currentWorkspace?.id && currentWorkspace.id !== personalWorkspaceId ? `ID: ${currentWorkspace.id}` : undefined}
          >
            {currentWorkspace?.type === WorkspaceType.Personal ? (
              <User className="w-3.5 h-3.5 text-surface-400" />
            ) : (
              <Briefcase className="w-3.5 h-3.5 text-mandy-400" />
            )}
            <span className="font-medium text-xs max-w-[100px] truncate text-surface-200">{currentWorkspace?.name || 'Seleccionar'}</span>
            <ChevronDown className="w-3 h-3 text-surface-500" />
            {invites.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mandy-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-mandy-500" />
              </span>
            )}
          </button>

          {showWorkspaceMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowWorkspaceMenu(false)} />
              <div className="absolute top-full left-0 mt-2 w-64 bg-surface-800 border border-surface-600/50 shadow-xl shadow-black/40 rounded-xl z-20 overflow-hidden">
                {invites.length > 0 && (
                  <>
                    <div className="p-2 border-b border-surface-600/50 bg-mandy-500/10">
                      <span className="text-xs font-semibold text-mandy-400 uppercase tracking-wider px-2">Invitaciones</span>
                    </div>
                    {invites.map(ws => (
                      <div key={ws.id} className="px-4 py-3 flex items-center justify-between hover:bg-surface-700 border-b border-surface-600/30">
                        <span className="text-sm font-medium text-surface-200 truncate max-w-[120px]">{ws.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onAcceptInvite(ws);
                          }}
                          className="text-xs bg-mandy-500 text-white px-2 py-1 rounded hover:bg-mandy-600"
                        >
                          Unirse
                        </button>
                      </div>
                    ))}
                  </>
                )}
                <div className="p-2 border-b border-surface-600/50">
                  <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-2">Mis Espacios</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {workspaces.map(ws => (
                    <div
                      key={ws.id}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-surface-700 transition cursor-pointer ${currentWorkspace?.id === ws.id ? 'bg-mandy-500/10 text-mandy-400' : 'text-surface-300'}`}
                      onClick={() => {
                        onSelectWorkspace(ws);
                        setShowWorkspaceMenu(false);
                      }}
                    >
                      {ws.type === WorkspaceType.Personal ? <User className="w-4 h-4 shrink-0" /> : <Briefcase className="w-4 h-4 shrink-0" />}
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">{ws.name}</span>
                        {ws.id !== personalWorkspaceId && (
                          <span className="text-[10px] font-mono text-surface-500 truncate">{ws.id}</span>
                        )}
                      </div>
                      {ws.id !== personalWorkspaceId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(ws.id);
                          }}
                          className="p-1 hover:bg-surface-600 rounded shrink-0"
                          title="Copiar ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                      {user && ws.type === WorkspaceType.Shared && ws.id !== personalWorkspaceId && (ws.ownerId === user.uid || isAdmin) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWorkspace(ws);
                          }}
                          className="p-1 hover:bg-red-500/20 rounded shrink-0 text-red-400 disabled:opacity-50"
                          title="Eliminar workspace"
                          disabled={deletingWorkspaceId === ws.id}
                        >
                          {deletingWorkspaceId === ws.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      )}
                      {currentWorkspace?.id === ws.id && <Check className="w-3 h-3 shrink-0" />}
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-surface-600/50 bg-surface-700/50">
                  <button
                    onClick={() => {
                      onNewWorkspace();
                      setShowWorkspaceMenu(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-xs font-medium hover:border-mandy-500/50 hover:text-mandy-400 transition"
                  >
                    <Plus className="w-3 h-3" /> Nuevo Espacio
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {currentWorkspace?.members && (
          <button
            onClick={onShowMembers}
            className="items-center gap-1 text-[10px] font-medium text-surface-500 hover:text-surface-200 px-1.5 py-0.5 rounded hover:bg-surface-700 transition hidden sm:flex"
          >
            <Users className="w-3 h-3" />
            {currentWorkspace.members.length}
          </button>
        )}

        <div className="w-px h-5 bg-surface-600/40 ml-1" />
      </div>

      {/* ── Center: Terminal tabs + File actions ── */}
      <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
        {/* Worker status dot */}
        <div className="flex items-center gap-1 shrink-0 pr-1" title={isWorkerOnline ? 'Worker listo' : connectionStatus === TerminalConnectionStatus.Checking ? 'Conectando…' : 'Sin worker'}>
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          <TerminalIcon className="w-3 h-3 text-surface-500" />
        </div>

        {/* Terminal session tabs */}
        {connectionStatus === TerminalConnectionStatus.Checking && (
          <span className="flex items-center gap-1 text-[10px] text-surface-500 italic px-1 whitespace-nowrap shrink-0">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Conectando…
          </span>
        )}

        {isCreatingSession && (
          <span className="flex items-center gap-1 text-[10px] text-mandy-400 px-1 whitespace-nowrap shrink-0">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Creando…
          </span>
        )}

        {!isWorkerOnline && connectionStatus !== TerminalConnectionStatus.Checking && (
          <button
            onClick={() => openTerminal()}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 hover:bg-amber-500/20 transition whitespace-nowrap shrink-0"
          >
            <AlertCircle className="w-2.5 h-2.5" />
            Sin worker
          </button>
        )}

        {workspaceSessions.length === 0 && isWorkerOnline && !isCreatingSession && connectionStatus !== TerminalConnectionStatus.Checking && (
          <span className="text-[10px] text-surface-500 italic whitespace-nowrap px-1 shrink-0">Sin sesiones</span>
        )}

        {workspaceSessions.map(sess => {
          const isActive = activeSessionId === sess.id;
          const terminalDocId = `terminal-${sess.id}`;
          return (
            <div key={sess.id} className="relative flex items-center gap-0.5 shrink-0">
              <button
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/x-doc-id', terminalDocId);
                  e.dataTransfer.setData('text/plain', terminalDocId);
                }}
                onClick={() => {
                  selectSession(sess.id);
                  openTerminal({ id: sess.id, name: sess.name || 'Terminal' });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-mandy-500/20 text-mandy-300 font-medium border border-mandy-500/30'
                    : 'text-surface-400 hover:bg-surface-700/60 hover:text-surface-200 border border-transparent'
                }`}
              >
                <TerminalIcon className="w-3 h-3 shrink-0" />
                <span className="max-w-[100px] truncate">{sess.name || 'Terminal'}</span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-mandy-500 shrink-0" />}
              </button>

              <button
                ref={menuOpenId === sess.id ? menuButtonRef : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (menuOpenId === sess.id) {
                    setMenuOpenId(null);
                    setMenuPos(null);
                  } else {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setMenuPos({ top: rect.bottom + 4, left: Math.max(0, rect.right - 196) });
                    setMenuOpenId(sess.id);
                  }
                }}
                className="p-1.5 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-600 transition"
                title="Opciones"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpenId === sess.id && menuPos && (
                <div
                  ref={menuRef}
                  className="fixed z-[9999] w-48 bg-surface-800 border border-surface-600/50 rounded-lg shadow-2xl shadow-black/50 overflow-hidden"
                  style={{ top: menuPos.top, left: menuPos.left }}
                >
                  <button
                    onClick={() => {
                      onAddStInstructions();
                      setMenuOpenId(null);
                      setMenuPos(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 transition"
                  >
                    <BookOpen className="w-3 h-3" />
                    Añadir instrucciones ST
                  </button>
                  <button
                    onClick={() => {
                      onRenameSession(sess);
                      setMenuOpenId(null);
                      setMenuPos(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 transition"
                  >
                    <Pencil className="w-3 h-3" />
                    Renombrar
                  </button>
                  <button
                    onClick={() => {
                      destroySession(sess.id);
                      const terminalTab = openTabs.find(t => t.type === 'terminal' && t.sessionId === sess.id);
                      if (terminalTab) closeTabById(terminalTab.id);
                      setMenuOpenId(null);
                      setMenuPos(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-surface-700 transition"
                  >
                    <X className="w-3 h-3" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* New terminal button */}
        <button
          disabled={!isWorkerOnline || isCreatingSession}
          onClick={handleCreateSession}
          className={`p-1 rounded transition shrink-0 ${
            isWorkerOnline && !isCreatingSession
              ? 'text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300'
              : 'text-surface-600 cursor-not-allowed'
          }`}
          title={isWorkerOnline ? (isCreatingSession ? 'Creando terminal…' : 'Nueva terminal') : 'Servidor de trabajo no conectado'}
        >
          {isCreatingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

      </div>

      {/* ── Right: Collapse + Zen + Status + Panels + Utils + User ── */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden md:flex items-center">
          <button
            onClick={onToggleHeaderCollapse}
            className="p-1.5 rounded-full transition text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10"
            title="Ocultar barra superior"
            aria-label="Ocultar barra superior"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={onToggleZenMode}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition ${
            isZenMode
              ? 'bg-mandy-500/15 text-mandy-300'
              : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
          }`}
          title={isZenMode ? 'Salir del modo concentración (Ctrl+K Z)' : 'Modo concentración (Ctrl+K Z)'}
        >
          {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{isZenMode ? 'Salir' : 'Zen'}</span>
        </button>
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide border ${
            isOnline
              ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              : 'border-red-500/40 text-red-300 bg-red-500/10'
          }`}
          title={isOnline ? 'Conectado' : 'Sin conexión'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
        </div>
        <button
          draggable={Boolean(boardPanelId)}
          onDragStart={(e) => handleHeaderDragStart(e, boardPanelId)}
          onClick={onOpenBoard}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition cursor-grab active:cursor-grabbing ${
            isBoardOpen
              ? 'bg-mandy-500/15 text-mandy-300'
              : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
          }`}
          title="Tablero (arrastrar al grid)"
          aria-label="Tablero"
        >
          <KanbanSquare className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Tablero</span>
        </button>
        <div className="relative">
          <button
            ref={toolsMenuButtonRef}
            onClick={() => {
              setShowWorkspaceMenu(false);
              setShowUserMenu(false);
              setShowToolsMenu(prev => !prev);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition border ${
              showToolsMenu
                ? 'border-surface-500/60 bg-surface-700 text-surface-100'
                : 'border-transparent text-surface-500 hover:text-surface-200 hover:bg-surface-700/80 hover:border-surface-600/50'
            }`}
            title="Paneles y herramientas"
            aria-label="Paneles y herramientas"
            aria-haspopup="menu"
            aria-expanded={showToolsMenu}
          >
            <MoreVertical className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Paneles</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} />
          </button>

          {showToolsMenu && (
            <div
              ref={toolsMenuRef}
              className="absolute top-full right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-80 rounded-2xl border border-surface-600/60 bg-surface-800 shadow-2xl shadow-black/50 z-30 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-surface-600/50 bg-surface-700/50">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-surface-500">Paneles</p>
                <p className="mt-1 text-xs text-surface-400">Arrastra cualquier panel al grid para fijarlo en el espacio de trabajo.</p>
              </div>

              <div className="p-2 space-y-1.5">
                {panelTools.map(tool => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      draggable={Boolean(tool.dragId)}
                      onDragStart={(event) => handleHeaderDragStart(event, tool.dragId)}
                      onClick={() => {
                        tool.onClick();
                        setShowToolsMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        tool.active
                          ? tool.activeClasses
                          : 'border-surface-700/80 bg-surface-900/40 text-surface-300 hover:border-surface-500/50 hover:bg-surface-700/70'
                      } ${tool.dragId ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      title={`${tool.label}${tool.dragId ? ' (arrastrar al grid)' : ''}`}
                      aria-label={tool.label}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tool.active ? tool.iconClasses : 'border-surface-700 bg-surface-900/70 text-surface-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold">{tool.label}</div>
                        <div className="text-[11px] text-surface-500 truncate">{tool.description}</div>
                      </div>
                      {tool.dragId && (
                        <span className="shrink-0 rounded-full border border-surface-600/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-surface-500">
                          Arrastra
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-surface-600/40 px-2 py-2 space-y-1">
                {utilityTools.map(tool => {
                  const Icon = tool.icon;
                  const content = (
                    <>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-700 bg-surface-900/70 text-surface-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-surface-200">{tool.label}</div>
                        <div className="text-[11px] text-surface-500 truncate">{tool.description}</div>
                      </div>
                    </>
                  );

                  if ('href' in tool) {
                    return (
                      <a
                        key={tool.id}
                        href={tool.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowToolsMenu(false)}
                        className="w-full flex items-center gap-3 rounded-xl border border-surface-700/80 bg-surface-900/40 px-3 py-2.5 text-left transition hover:border-surface-500/50 hover:bg-surface-700/70"
                      >
                        {content}
                      </a>
                    );
                  }

                  return (
                    <button
                      key={tool.id}
                      onClick={() => {
                        tool.onClick();
                        setShowToolsMenu(false);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl border border-surface-700/80 bg-surface-900/40 px-3 py-2.5 text-left transition hover:border-surface-500/50 hover:bg-surface-700/70"
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <button
          draggable={Boolean(filesPanelId)}
          onDragStart={(e) => handleHeaderDragStart(e, filesPanelId)}
          onClick={openFilesTab}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10 cursor-grab active:cursor-grabbing"
          title="Explorador de archivos (arrastrar al grid)"
          aria-label="Archivos"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Archivos</span>
        </button>
        <button
          onClick={onOpenQuickSearch}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10"
          title="Buscar en este espacio (Ctrl+P / Ctrl+Shift+P)"
          aria-label="Buscar en este espacio"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Buscar</span>
        </button>
        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowToolsMenu(false);
              setShowWorkspaceMenu(false);
              setShowUserMenu(!showUserMenu);
            }}
            className="p-1.5 text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 rounded-full transition"
            title={user?.email || 'Usuario'}
          >
            <User className="w-4 h-4" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute top-full right-0 mt-2 w-56 bg-surface-800 border border-surface-600/50 shadow-xl shadow-black/40 rounded-xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-600/50">
                  <p className="text-xs text-surface-500">Conectado como</p>
                  <p className="text-sm text-surface-200 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  {onOpenPricing && (
                    <button
                      onClick={() => {
                        onOpenPricing();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-surface-700 transition"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Planes y precios</span>
                      {currentPlanName && (
                        <span className="ml-auto text-xs bg-surface-600 px-2 py-0.5 rounded-full text-surface-300">
                          {currentPlanName}
                        </span>
                      )}
                    </button>
                  )}
                  {/* Storage usage bar */}
                  {storageUsage && (
                    <div className="px-4 py-2 border-b border-surface-600/50">
                      <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
                        <span>Almacenamiento</span>
                        <span>{formatStorageSize(storageUsage.usedMB)} / {formatStorageSize(storageUsage.limitMB)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            storageUsage.percentage >= 90 ? 'bg-red-500' :
                            storageUsage.percentage >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-300 hover:bg-surface-700 transition"
                  >
                    <BookOpen className="w-4 h-4" />
                    Documentación
                  </a>
                  <button
                    onClick={() => {
                      onOpenPassword();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-300 hover:bg-surface-700 transition"
                  >
                    <Key className="w-4 h-4" />
                    Cambiar contraseña
                  </button>
                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-surface-700 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
      <input type="file" ref={folderInputRef} className="hidden" onChange={handleFolderUpload} multiple {...folderInputProps} />
    </header>
  );
};

export default React.memo(HeaderBar);
