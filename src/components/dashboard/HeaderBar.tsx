'use client';

import { Briefcase, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, KanbanSquare, Key, Loader2, LogOut, Maximize2, Menu, Minimize2, Plus, Trash2, User, Users } from 'lucide-react';
import type { Workspace } from '@/components/dashboard/types';
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
  deletingWorkspaceId: string | null;
  personalWorkspaceId: string;
  isBoardOpen: boolean;
  onOpenBoard: () => void;
  onAcceptInvite: (ws: Workspace) => void;
  onSelectWorkspace: (ws: Workspace) => void;
  onDeleteWorkspace: (ws: Workspace) => void;
  onNewWorkspace: () => void;
  onShowMembers: () => void;
  onOpenPassword: () => void;
  onLogout: () => void;
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
  deletingWorkspaceId,
  personalWorkspaceId,
  isBoardOpen,
  onOpenBoard,
  onAcceptInvite,
  onSelectWorkspace,
  onDeleteWorkspace,
  onNewWorkspace,
  onShowMembers,
  onOpenPassword,
  onLogout
}: HeaderBarProps) => {
  return (
    <header className="h-14 bg-surface-800 border-b border-surface-600/50 flex items-center justify-between px-4 shrink-0 z-50 relative">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 text-surface-400 hover:bg-surface-700 rounded"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div onClick={onClearSelectedDoc} className="font-bold flex items-center gap-2 text-white cursor-pointer">
          <span className="bg-gradient-mandy text-white p-1 rounded-md text-xs">St</span>
          <span className="hidden sm:inline">Studio</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-700 rounded-lg transition border border-transparent hover:border-surface-600"
            title={currentWorkspace?.id && currentWorkspace.id !== personalWorkspaceId ? `ID: ${currentWorkspace.id}` : undefined}
          >
            {currentWorkspace?.type === 'personal' ? (
              <User className="w-4 h-4 text-surface-400" />
            ) : (
              <Briefcase className="w-4 h-4 text-mandy-400" />
            )}
            <div className="flex flex-col items-start">
              <span className="font-medium text-sm max-w-[120px] truncate text-surface-200">{currentWorkspace?.name || 'Seleccionar'}</span>
              {currentWorkspace?.id && currentWorkspace.id !== personalWorkspaceId && (
                <span className="text-[9px] text-surface-500 font-mono truncate max-w-[120px]">{currentWorkspace.id.slice(0, 8)}...</span>
              )}
            </div>
            <ChevronDown className="w-3 h-3 text-surface-500" />
            {invites.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mandy-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-mandy-500" />
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
                      {user && ws.type === 'shared' && ws.ownerId === user.uid && ws.id !== personalWorkspaceId && (
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
            className="items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-200 px-2 py-1 rounded hover:bg-surface-700 transition hidden sm:flex"
          >
            <Users className="w-3.5 h-3.5" />
            {currentWorkspace.members.length}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-surface-400 bg-surface-700 px-3 py-1.5 rounded-full">
          <User className="w-4 h-4" />
          <span className="truncate max-w-[150px] hidden md:inline">{user?.email}</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={onToggleSidebarCollapse}
            className={`p-2 rounded-full transition ${
              isSidebarCollapsed
                ? 'bg-mandy-500/15 text-mandy-300'
                : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
            }`}
            title={isSidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggleHeaderCollapse}
            className={`p-2 rounded-full transition ${
              isHeaderCollapsed
                ? 'bg-mandy-500/15 text-mandy-300'
                : 'text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10'
            }`}
            title={isHeaderCollapsed ? 'Mostrar barra superior' : 'Ocultar barra superior'}
          >
            {isHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={onToggleZenMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition ${
            isZenMode
              ? 'bg-mandy-500/15 text-mandy-300 border-mandy-500/40'
              : 'bg-surface-700 text-surface-300 border-surface-600/60 hover:text-white hover:border-mandy-500/40'
          }`}
          title={isZenMode ? 'Salir de modo Zen' : 'Modo Zen (pantalla completa)'}
        >
          {isZenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span className="hidden md:inline">{isZenMode ? 'Salir Zen' : 'Zen'}</span>
        </button>
        <button
          onClick={onOpenBoard}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition ${
            isBoardOpen
              ? 'bg-mandy-500/15 text-mandy-300 border-mandy-500/40'
              : 'bg-surface-700 text-surface-300 border-surface-600/60 hover:text-white hover:border-mandy-500/40'
          }`}
          title={isBoardOpen ? 'Ir al tablero' : 'Abrir tablero'}
        >
          <KanbanSquare className="w-4 h-4" />
          <span className="hidden md:inline">Tablero</span>
        </button>
        <button
          onClick={onOpenPassword}
          className="p-2 text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10 rounded-full transition"
          title="Cambiar Contrasena"
        >
          <Key className="w-5 h-5" />
        </button>
        <button
          onClick={onLogout}
          className="p-2 text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10 rounded-full transition"
          title="Cerrar Sesion"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default HeaderBar;
