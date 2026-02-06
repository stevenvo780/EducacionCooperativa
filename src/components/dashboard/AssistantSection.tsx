'use client';

import { memo } from 'react';
import { AlertCircle, Plus, Settings, Terminal as TerminalIcon, X, Loader2, Pencil } from 'lucide-react';
import type { DocItem, Workspace } from '@/components/dashboard/types';
import type { TerminalSession } from '@/context/TerminalContext';
import type { WorkerStatus } from '@/lib/TerminalController';
import type { User as FirebaseUser } from 'firebase/auth';

interface AssistantSectionProps {
  currentWorkspace: Workspace | null;
  user: FirebaseUser | null;
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
}

const AssistantSection = memo(function AssistantSection({
  currentWorkspace,
  user,
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
  closeTabById
}: AssistantSectionProps) {
  const workerToken = currentWorkspace && user
    ? (currentWorkspace.type === 'personal' || currentWorkspace.id === 'personal'
        ? `personal:${user.uid}`
        : currentWorkspace.id)
    : '';

  const workerStatus = workerToken ? getWorkerStatusForWorkspace(workerToken) : 'unknown';
  const isWorkerOnline = workerStatus === 'online';
  const workspaceSessions = workerToken ? getSessionsForWorkspace(workerToken) : [];

  const handleCreateSession = () => {
    if (!currentWorkspace || !user || !workerToken) return;
    createSession(workerToken, currentWorkspace.type, `Terminal ${workspaceSessions.length + 1}`);
  };

  return (
    <div>
      <div className="px-2 py-1 flex items-center justify-between group">
        <button
          onClick={() => openTerminal()}
          className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2 hover:text-mandy-400 transition-colors"
        >
          MI ASISTENTE
        </button>
      </div>

      {/* Botón grande y visible para crear nueva terminal */}
      <div className="px-2 pb-2">
        <button
          disabled={!isWorkerOnline || isCreatingSession}
          onClick={handleCreateSession}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${
            isWorkerOnline && !isCreatingSession
              ? 'bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95'
              : 'bg-surface-800/50 border border-surface-700/50 text-surface-600 cursor-not-allowed'
          }`}
          title={isWorkerOnline ? (isCreatingSession ? 'Creando...' : 'Crear nueva terminal') : 'Worker no conectado'}
        >
          {connectionStatus === 'checking' || isCreatingSession
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Plus className="w-4 h-4 stroke-[3]" />
          }
          <span>{isCreatingSession ? 'Creando...' : 'NUEVA TERMINAL'}</span>
        </button>
      </div>

      <div className="mt-1 space-y-0.5">
        {connectionStatus === 'checking' && (
          <div className="px-3 py-1 text-[10px] text-surface-500 italic flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Conectando al Hub...
          </div>
        )}

        {isCreatingSession && (
          <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] text-mandy-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Creando sesion...</span>
          </div>
        )}

        {workspaceSessions.length === 0 && isWorkerOnline && !isCreatingSession && connectionStatus !== 'checking' && (
          <div className="px-3 py-1 text-[10px] text-emerald-400/70 italic flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Worker listo - Sin sesiones activas
          </div>
        )}

        {!isWorkerOnline && connectionStatus !== 'checking' && (
          <button
            onClick={() => openTerminal()}
            className="w-full px-3 py-2 text-[10px] bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-400 hover:bg-amber-500/20 flex items-center gap-2 transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">
              Sin worker para <strong>{currentWorkspace?.name || 'este espacio'}</strong>
            </span>
            <Settings className="w-3 h-3" />
          </button>
        )}

        {workspaceSessions.map(sess => (
          <div
            key={sess.id}
            className={`group w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeSessionId === sess.id
                ? 'bg-mandy-500/15 text-mandy-400 font-medium'
                : 'text-surface-400 hover:bg-surface-700/50 hover:text-surface-200'
            }`}
          >
            <button
              onClick={() => {
                selectSession(sess.id);
                openTerminal({ id: sess.id, name: sess.name || 'Mi Asistente' });
              }}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <TerminalIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1 text-left">{sess.name || 'Terminal'}</span>
              {activeSessionId === sess.id && <div className="w-1.5 h-1.5 rounded-full bg-mandy-500 shrink-0" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameSession(sess);
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-600/20 hover:text-surface-200 transition-[opacity,background-color,color] duration-150"
              title="Renombrar sesion"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                destroySession(sess.id);
                const terminalTab = openTabs.find(t => t.type === 'terminal' && t.sessionId === sess.id);
                if (terminalTab) {
                  closeTabById(terminalTab.id);
                }
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-[opacity,background-color,color] duration-150"
              title="Cerrar sesion"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

AssistantSection.displayName = 'AssistantSection';

export default AssistantSection;
