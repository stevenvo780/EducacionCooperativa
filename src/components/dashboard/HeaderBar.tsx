'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  FolderOpen,
  FolderPlus,
  FolderUp,
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
  Terminal as TerminalIcon,
  Trash2,
  Upload,
  User,
  Users,
  X
} from 'lucide-react';
import type { DocItem, Workspace } from '@/components/dashboard/types';
import type { TerminalSession } from '@/context/TerminalContext';
import type { WorkerStatus } from '@/lib/TerminalController';
import type { User as FirebaseUser } from 'firebase/auth';

interface HeaderBarProps {
  onToggleMobileSidebar: () => void;
  onClearSelectedDoc: () => void;
  isSidebarCollapsed: boolean;
  isHeaderCollapsed: boolean;
  isZenMode: boolean;
  onToggleSidebarCollapse: () => void;
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
  onAcceptInvite: (ws: Workspace) => void;
  onSelectWorkspace: (ws: Workspace) => void;
  onDeleteWorkspace: (ws: Workspace) => void;
  onNewWorkspace: () => void;
  onShowMembers: () => void;
  onOpenPassword: () => void;
  onLogout: () => void;
  /* Terminal / session props */
  connectionStatus: 'checking' | 'online' | 'offline' | 'error';
  isCreatingSession: boolean;
  activeSessionId: string | null;
  getWorkerStatusForWorkspace: (workspaceId: string) => WorkerStatus;
  getSessionsForWorkspace: (workspaceId: string) => TerminalSession[];
  createSession: (workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => void;
  selectSession: (sessionId: string) => void;
  destroySession: (sessionId: string) => void;
  onRenameSession: (session: TerminalSession) => void;
  openTerminal: (session?: { id: string; name: string }) => void;
  openTabs: DocItem[];
  closeTabById: (tabId: string) => void;
  /* File action props */
  createDoc: (e?: React.FormEvent, folderName?: string) => void;
  createFolder: () => void;
  activeFolder: string;
  setUploadTargetFolder: (folder: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  folderInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  defaultFolderName: string;
  openFilesTab: () => void;
}

const HeaderBar = ({
  onToggleMobileSidebar,
  onClearSelectedDoc,
  isSidebarCollapsed,
  isHeaderCollapsed,
  isZenMode,
  onToggleSidebarCollapse,
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
  openTerminal,
  openTabs,
  closeTabById,
  createDoc,
  createFolder,
  activeFolder,
  setUploadTargetFolder,
  fileInputRef,
  folderInputRef,
  handleFileUpload,
  handleFolderUpload,
  folderInputProps,
  defaultFolderName,
  openFilesTab
}: HeaderBarProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  /* ── Terminal helpers ── */
  const workerToken = currentWorkspace && user
    ? (currentWorkspace.type === 'personal' || currentWorkspace.id === 'personal'
        ? `personal:${user.uid}`
        : currentWorkspace.id)
    : '';

  const workerStatus = workerToken ? getWorkerStatusForWorkspace(workerToken) : ('unknown' as WorkerStatus);
  const isWorkerOnline = workerStatus === 'online';
  const workspaceSessions = workerToken ? getSessionsForWorkspace(workerToken) : [];

  const handleCreateSession = useCallback(() => {
    if (!currentWorkspace || !user || !workerToken) return;
    createSession(workerToken, currentWorkspace.type, `Terminal ${workspaceSessions.length + 1}`);
  }, [currentWorkspace, user, workerToken, createSession, workspaceSessions.length]);

  const statusDot = isWorkerOnline
    ? 'bg-emerald-400'
    : connectionStatus === 'checking'
      ? 'bg-amber-400 animate-pulse'
      : 'bg-red-400';

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpenId && !showUploadMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMenu = menuRef.current && menuRef.current.contains(target);
      const insideButton = menuButtonRef.current && menuButtonRef.current.contains(target);
      if (!insideMenu && !insideButton) {
        setMenuOpenId(null);
        setMenuPos(null);
        setShowUploadMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId, showUploadMenu]);

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
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-surface-700 rounded-lg transition border border-transparent hover:border-surface-600"
            title={currentWorkspace?.id && currentWorkspace.id !== personalWorkspaceId ? `ID: ${currentWorkspace.id}` : undefined}
          >
            {currentWorkspace?.type === 'personal' ? (
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
                      {ws.type === 'personal' ? <User className="w-4 h-4 shrink-0" /> : <Briefcase className="w-4 h-4 shrink-0" />}
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
                      {user && ws.type === 'shared' && ws.id !== personalWorkspaceId && (ws.ownerId === user.uid || isAdmin) && (
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
        <div className="flex items-center gap-1 shrink-0 pr-1" title={isWorkerOnline ? 'Worker listo' : connectionStatus === 'checking' ? 'Conectando…' : 'Sin worker'}>
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          <TerminalIcon className="w-3 h-3 text-surface-500" />
        </div>

        {/* Terminal session tabs */}
        {connectionStatus === 'checking' && (
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

        {!isWorkerOnline && connectionStatus !== 'checking' && (
          <button
            onClick={() => openTerminal()}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 hover:bg-amber-500/20 transition whitespace-nowrap shrink-0"
          >
            <AlertCircle className="w-2.5 h-2.5" />
            Sin worker
          </button>
        )}

        {workspaceSessions.length === 0 && isWorkerOnline && !isCreatingSession && connectionStatus !== 'checking' && (
          <span className="text-[10px] text-surface-500 italic whitespace-nowrap px-1 shrink-0">Sin sesiones</span>
        )}

        {workspaceSessions.map(sess => {
          const isActive = activeSessionId === sess.id;
          return (
            <div key={sess.id} className="relative flex items-center gap-0.5 shrink-0">
              <button
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
                    setMenuPos({ top: rect.bottom + 4, left: Math.max(0, rect.right - 160) });
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
                  className="fixed z-[9999] w-40 bg-surface-800 border border-surface-600/50 rounded-lg shadow-2xl shadow-black/50 overflow-hidden"
                  style={{ top: menuPos.top, left: menuPos.left }}
                >
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
          title={isWorkerOnline ? (isCreatingSession ? 'Creando…' : 'Nueva terminal') : 'Worker no conectado'}
        >
          {isCreatingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

        <div className="w-px h-4 bg-surface-600/40 mx-0.5 shrink-0" />

        {/* File action buttons */}
        <button
          onClick={() => createDoc(undefined, activeFolder)}
          className="p-1 rounded text-surface-500 hover:text-mandy-400 hover:bg-surface-700 transition shrink-0"
          title="Nuevo Archivo"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          onClick={() => createFolder()}
          className="p-1 rounded text-surface-500 hover:text-mandy-400 hover:bg-surface-700 transition shrink-0"
          title="Nueva Carpeta"
        >
          <FolderPlus className="w-3 h-3" />
        </button>
        <div className="relative shrink-0" ref={showUploadMenu ? menuRef : undefined}>
          <button
            onClick={() => setShowUploadMenu(prev => !prev)}
            className="p-1 rounded text-surface-500 hover:text-mandy-400 hover:bg-surface-700 transition"
            title="Subir"
          >
            <Upload className="w-3 h-3" />
          </button>
          {showUploadMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface-800 border border-surface-600 rounded-lg shadow-xl p-1 z-50 flex flex-col gap-1 min-w-[120px]">
              <button
                onClick={() => {
                  setUploadTargetFolder(defaultFolderName);
                  fileInputRef.current?.click();
                  setShowUploadMenu(false);
                }}
                className="px-3 py-1.5 text-xs text-left text-surface-300 hover:bg-surface-700 rounded flex gap-2 items-center"
              >
                <Upload className="w-3 h-3" /> Archivos
              </button>
              <button
                onClick={() => {
                  setUploadTargetFolder(defaultFolderName);
                  folderInputRef.current?.click();
                  setShowUploadMenu(false);
                }}
                className="px-3 py-1.5 text-xs text-left text-surface-300 hover:bg-surface-700 rounded flex gap-2 items-center"
              >
                <FolderUp className="w-3 h-3" /> Carpeta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Status + Controls ── */}
      <div className="flex items-center gap-1 shrink-0">
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide border ${
            isOnline
              ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              : 'border-red-500/40 text-red-300 bg-red-500/10'
          }`}
          title={isOnline ? 'Conectado' : 'Sin conexión'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="hidden md:flex items-center">
          <button
            onClick={onToggleSidebarCollapse}
            className={`p-1.5 rounded-full transition ${
              isSidebarCollapsed
                ? 'bg-mandy-500/15 text-mandy-300'
                : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
            }`}
            title={isSidebarCollapsed ? 'Mostrar archivos' : 'Ocultar archivos'}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggleHeaderCollapse}
            className={`p-1.5 rounded-full transition ${
              isHeaderCollapsed
                ? 'bg-mandy-500/15 text-mandy-300'
                : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
            }`}
            title={isHeaderCollapsed ? 'Mostrar barra superior' : 'Ocultar barra superior'}
          >
            {isHeaderCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={onToggleZenMode}
          className={`p-1.5 rounded-full transition ${
            isZenMode
              ? 'bg-mandy-500/15 text-mandy-300'
              : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
          }`}
          title={isZenMode ? 'Salir de modo Zen' : 'Modo Zen'}
        >
          {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onOpenBoard}
          className={`p-1.5 rounded-full transition ${
            isBoardOpen
              ? 'bg-mandy-500/15 text-mandy-300'
              : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
          }`}
          title="Tablero"
        >
          <KanbanSquare className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={openFilesTab}
          className="p-1.5 rounded-full transition text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10"
          title="Explorador de archivos"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
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

export default HeaderBar;
