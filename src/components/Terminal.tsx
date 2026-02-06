'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import { CheckCircle, AlertCircle, Loader2, Terminal as TerminalIcon, Download, Copy, Key, Monitor, X, Settings, ChevronDown, ChevronUp } from 'lucide-react';

interface TerminalProps {
  nexusUrl: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: 'personal' | 'shared';
  sessionId?: string;
}

function getWorkerToken(workspaceType: 'personal' | 'shared', workspaceId: string | undefined, userId: string): string {
  if (workspaceType === 'personal' || !workspaceId || workspaceId === 'personal') {
    return `personal:${userId}`;
  }
  return workspaceId;
}

const Terminal: React.FC<TerminalProps> = ({
    nexusUrl,
    workspaceId,
    workspaceName,
    workspaceType = 'personal',
    sessionId
}) => {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const { user } = useAuth();

  const {
    controller,
    sessions,
    status,
    hubConnected,
    errorMessage,
    initialize,
        activeSessionId,
    createSession,
    joinSession,
    selectSession,
    getWorkerStatusForWorkspace
  } = useTerminal();

    // Only fall back to activeSessionId if this tab originally HAD a sessionId that became stale.
    // Tabs without sessionId (terminal-main) should NOT auto-attach to any session.
    const effectiveSessionId = sessionId
        ? (sessions.some(s => s.id === sessionId) ? sessionId : activeSessionId)
        : null;
    const sessionActive = effectiveSessionId ? sessions.some(s => s.id === effectiveSessionId) : false;

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
      setContainerEl(node);
  }, []);

  useEffect(() => {
      if (!controller && status !== 'error' && nexusUrl) {
          initialize(nexusUrl);
      }
  }, [controller, status, nexusUrl, initialize]);

  const isPersonalWorkspace = workspaceType === 'personal' || workspaceId === 'personal' || !workspaceId;
  const workerToken = user ? getWorkerToken(workspaceType, workspaceId, user.uid) : '';

  const workspaceWorkerStatus = getWorkerStatusForWorkspace?.(workerToken) || status;

  useEffect(() => {
    if (!controller || !workerToken) return;

    controller.subscribeToWorkspace(workerToken);
    controller.checkWorkerStatus(workerToken);

    return () => {
      controller.unsubscribeFromWorkspace(workerToken);
    };
  }, [controller, workerToken]);

  useEffect(() => {
      if (!effectiveSessionId || !sessionActive || !containerEl || !controller) return;
      let mounted = false;

      const tryMount = () => {
          if (mounted) return;
          if (containerEl.offsetWidth > 0 && containerEl.offsetHeight > 0) {
              try {
                  controller.mountSession(effectiveSessionId, containerEl);
                  mounted = true;
              } catch (e) {
                  console.error('Error mounting terminal for session', sessionId, e);
              }
          }
      };

      tryMount();
      if (mounted) return;

      const fallbackTimeout = window.setTimeout(tryMount, 100);
      if (typeof ResizeObserver === 'undefined') {
          return () => window.clearTimeout(fallbackTimeout);
      }

      const observer = new ResizeObserver(() => {
          tryMount();
          if (mounted) {
              observer.disconnect();
          }
      });
      observer.observe(containerEl);

      return () => {
          observer.disconnect();
          window.clearTimeout(fallbackTimeout);
      };
    }, [effectiveSessionId, sessionActive, controller, containerEl, sessionId]);

  useEffect(() => {
      if (!effectiveSessionId || !sessionActive || !controller) return;
      const handleResize = () => controller?.fitSession(effectiveSessionId);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    }, [controller, effectiveSessionId, sessionActive]);

  const handleCreateSession = () => {
      if (!createSession) return;
      createSession(workerToken, workspaceType, workspaceName);
  };

  const downloadPath = '/downloads/edu-worker_1.0.10_amd64.deb';
  const downloadUrl = typeof window !== 'undefined' ? `${window.location.origin}${downloadPath}` : downloadPath;

  if (!user) return <div className="h-full flex items-center justify-center text-slate-500">Log in required</div>;

  if (status === 'checking') {
      return (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500/50" />
              <p className="text-sm font-medium">Conectando servicio...</p>
          </div>
      );
  }

  const showHubError = status === 'error' || (!hubConnected && status !== 'offline');
  const workerOnline = workspaceWorkerStatus === 'online';
  const workerOffline = workspaceWorkerStatus === 'offline' || workspaceWorkerStatus === 'unknown';

  if (effectiveSessionId && sessionActive) {
      return (
        <div className="h-full w-full flex flex-col bg-black relative overflow-hidden group">
            <div className="absolute top-4 right-4 z-10 flex gap-2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase backdrop-blur-md border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ONLINE
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase backdrop-blur-md border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                    <Monitor className="w-3 h-3" />
                    SESIÓN {effectiveSessionId.slice(-4)}
                </div>
            </div>
            <div
                ref={setContainerRef}
                className="flex-1 min-h-0 w-full bg-black"
                style={{ minHeight: '200px', minWidth: '300px' }}
            />
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-black text-slate-200 overflow-y-auto">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-8 text-center space-y-6">
            <div className="flex justify-center">
                <div className={`p-4 rounded-full border ${
                    workerOnline ? 'bg-emerald-500/10 border-emerald-500/20' :
                    workerOffline ? 'bg-amber-500/10 border-amber-500/20' :
                    'bg-red-500/10 border-red-500/20'
                }`}>
                    {workerOnline && <CheckCircle className="w-12 h-12 text-emerald-500" />}
                    {workerOffline && <AlertCircle className="w-12 h-12 text-amber-500" />}
                    {showHubError && <X className="w-12 h-12 text-red-500" />}
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white">
                {workerOnline
                    ? 'Worker Conectado'
                    : workerOffline
                        ? `Sin Worker para "${workspaceName || (isPersonalWorkspace ? 'Espacio Personal' : 'este espacio')}"`
                        : 'Error de Conexión'}
            </h2>

            {workerOffline && !showHubError && (
                <p className="text-amber-400/80 text-sm -mt-2">
                    Este espacio de trabajo necesita un worker dedicado para funcionar
                </p>
            )}

            {workerOnline ? (
                <div className="space-y-4">
                    <p className="text-slate-400">El servicio está listo. Puedes iniciar una nueva terminal.</p>
                    <button
                        onClick={handleCreateSession}
                        className="group/btn relative px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-base flex items-center gap-3 mx-auto transition-all shadow-xl shadow-emerald-900/30 hover:shadow-emerald-500/30 hover:scale-105 active:scale-95 ring-2 ring-emerald-500/20 hover:ring-emerald-400/40"
                    >
                        <span className="absolute inset-0 rounded-xl bg-emerald-400/20 animate-ping opacity-30 group-hover/btn:opacity-0 transition-opacity" />
                        <TerminalIcon className="w-6 h-6" /> Iniciar Terminal
                    </button>
                    <p className="text-xs text-slate-500">O selecciona una sesión existente en la barra lateral.</p>

                    {/* Show active sessions in this workspace for joining */}
                    {sessions.filter(s => s.workspaceId === workerToken).length > 0 && (
                        <div className="border-t border-slate-800 pt-4 mt-2">
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5 justify-center">
                                <Monitor className="w-3.5 h-3.5" />
                                Sesiones activas en este espacio:
                            </p>
                            <div className="space-y-1.5 max-w-sm mx-auto">
                                {sessions.filter(s => s.workspaceId === workerToken).map(sess => (
                                    <button
                                        key={sess.id}
                                        onClick={() => {
                                            joinSession(sess.id);
                                            selectSession(sess.id);
                                        }}
                                        className="w-full px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 hover:bg-indigo-500/20 flex items-center gap-2 text-xs transition-colors"
                                    >
                                        <TerminalIcon className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate flex-1 text-left">{sess.name || `Sesión ${sess.id.slice(-4)}`}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border-t border-slate-800 pt-4 mt-4">
                        <button
                            onClick={() => setShowInstallGuide(!showInstallGuide)}
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 mx-auto transition-colors"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Instalar worker en otra máquina</span>
                            {showInstallGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {showInstallGuide && (
                            <div className="mt-4 space-y-4 text-slate-400 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                                    <div className="flex justify-between items-center text-xs font-mono">
                                        <span className="text-slate-400 font-bold flex items-center gap-2">
                                            <Key className="w-3 h-3" /> WORKER TOKEN
                                        </span>
                                        <button onClick={() => navigator.clipboard.writeText(workerToken)} className="flex items-center gap-1 text-slate-500 hover:text-emerald-400 transition-colors">
                                            <Copy className="w-3 h-3" /> <span className="text-[10px]">Copiar</span>
                                        </button>
                                    </div>
                                    <code className="block w-full bg-black rounded border border-slate-800 p-2 text-yellow-400 text-sm font-mono break-all select-all">
                                        {workerToken}
                                    </code>
                                    <p className="text-[10px] text-slate-500">
                                        {isPersonalWorkspace
                                            ? 'Token personal: sincroniza archivos de tu espacio personal'
                                            : `Token de workspace compartido: ${workspaceId}`}
                                    </p>
                                </div>

                                <div className="bg-black p-4 rounded font-mono text-xs border border-slate-800 overflow-x-auto space-y-2">
                                    <p className="text-slate-500 mb-1"># 1. Descargar e instalar el paquete</p>
                                    <p className="text-emerald-400 whitespace-nowrap mb-3">$ curl -fsSL {downloadUrl} -o edu-worker.deb && sudo apt install ./edu-worker.deb</p>

                                    <p className="text-slate-500 mb-1"># 2. Agregar worker para este workspace</p>
                                    <p className="text-emerald-400 whitespace-pre-wrap">
{isPersonalWorkspace
    ? `$ sudo edu-worker-manager add ${user?.uid || '<userId>'} --type personal --name "${user?.email || 'Mi Espacio'}"`
    : `$ sudo edu-worker-manager add ${workspaceId} --name "${workspaceName || 'Workspace'}"`}
                                    </p>

                                    <p className="text-slate-500 mt-3 mb-1"># Comandos útiles</p>
                                    <p className="text-slate-400">$ sudo edu-worker-manager list           <span className="text-slate-600"># Ver todos los workers</span></p>
                                    <p className="text-slate-400">$ sudo edu-worker-manager status         <span className="text-slate-600"># Estado de cada worker</span></p>
                                    <p className="text-slate-400">$ sudo edu-worker-manager logs {workerToken.slice(0,8)}...  <span className="text-slate-600"># Ver logs</span></p>
                                    <p className="text-slate-400">$ sudo edu-worker-manager resync all      <span className="text-slate-600"># Forzar resync</span></p>
                                </div>

                                <p className="text-[10px] text-slate-600 text-center">
                                    El worker se conectará a: <code className="text-slate-500">{nexusUrl || 'http://148.230.88.162:3010'}</code>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4 text-slate-400 text-left max-h-[70vh] overflow-y-auto pr-2">
                    {showHubError ? (
                        <>
                            <p className="text-center">No se pudo contactar con el servidor central (Hub).</p>
                             {errorMessage && <p className="text-red-400 text-xs font-mono text-center">{errorMessage}</p>}
                        </>
                    ) : (
                        <>
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                                <p className="text-center text-amber-400 font-medium mb-2">
                                    ¿Cómo funciona?
                                </p>
                                <p className="text-center text-sm text-slate-400">
                                    Cada espacio de trabajo necesita su propio <strong className="text-white">worker</strong> (contenedor Docker)
                                    para ejecutar comandos y sincronizar archivos de forma aislada.
                                </p>
                            </div>

                            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-center text-xs font-mono">
                                    <span className="text-slate-400 font-bold flex items-center gap-2">
                                        <Key className="w-3 h-3" /> WORKER TOKEN
                                    </span>
                                    <button onClick={() => navigator.clipboard.writeText(workerToken)} className="flex items-center gap-1 text-slate-500 hover:text-emerald-400 transition-colors">
                                        <Copy className="w-3 h-3" /> <span className="text-[10px]">Copiar</span>
                                    </button>
                                </div>
                                <code className="block w-full bg-black rounded border border-slate-800 p-2 text-yellow-400 text-sm font-mono break-all select-all">
                                    {workerToken}
                                </code>
                                <p className="text-[10px] text-slate-500">
                                    {isPersonalWorkspace
                                        ? 'Token personal: sincroniza archivos de tu espacio personal'
                                        : `Token de workspace compartido: ${workspaceId}`}
                                </p>
                            </div>

                            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">1</div>
                                    <h3 className="text-emerald-400 font-bold text-sm">Instalación Rápida (Un comando)</h3>
                                </div>
                                <p className="text-xs text-slate-400 mb-3">
                                    Ejecuta este comando en tu servidor Linux para instalar y configurar el worker automáticamente:
                                </p>
                                <div className="relative">
                                    <pre className="bg-black p-3 rounded border border-slate-800 text-xs overflow-x-auto">
                                        <code className="text-emerald-400 whitespace-pre-wrap break-all">
{`curl -fsSL ${downloadUrl} -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb && sudo edu-worker-manager add ${workerToken}${isPersonalWorkspace ? ' --type personal' : ''} --name "${workspaceName || (isPersonalWorkspace ? user?.email || 'Mi Espacio' : 'Workspace')}"`}
                                        </code>
                                    </pre>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(
                                            `curl -fsSL ${downloadUrl} -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb && sudo edu-worker-manager add ${workerToken}${isPersonalWorkspace ? ' --type personal' : ''} --name "${workspaceName || (isPersonalWorkspace ? user?.email || 'Mi Espacio' : 'Workspace')}"`
                                        )}
                                        className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] rounded flex items-center gap-1 transition-colors"
                                    >
                                        <Copy className="w-3 h-3" /> Copiar
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-full bg-slate-600/50 flex items-center justify-center text-slate-300 text-xs font-bold">2</div>
                                    <h3 className="text-slate-300 font-bold text-sm">Instalación Manual (Paso a paso)</h3>
                                </div>

                                <div className="space-y-4 text-xs">
                                    <div>
                                        <p className="text-slate-500 mb-1 font-medium">Paso 1: Descargar el paquete</p>
                                        <div className="bg-black p-2 rounded border border-slate-800">
                                            <code className="text-blue-400">curl -fsSL {downloadUrl} -o edu-worker.deb</code>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-slate-500 mb-1 font-medium">Paso 2: Instalar el paquete</p>
                                        <div className="bg-black p-2 rounded border border-slate-800">
                                            <code className="text-blue-400">sudo apt install ./edu-worker.deb</code>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-slate-500 mb-1 font-medium">Paso 3: Agregar worker para este workspace</p>
                                        <div className="bg-black p-2 rounded border border-slate-800 overflow-x-auto">
                                            <code className="text-blue-400 whitespace-pre">
{isPersonalWorkspace
    ? `sudo edu-worker-manager add ${user?.uid || '<userId>'} --type personal --name "${user?.email || 'Mi Espacio'}"`
    : `sudo edu-worker-manager add ${workspaceId} --name "${workspaceName || 'Workspace'}"`}
                                            </code>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-700 pt-3 mt-3">
                                        <p className="text-slate-500 mb-2 font-medium">Comandos útiles:</p>
                                        <div className="bg-black p-2 rounded border border-slate-800 space-y-1">
                                            <p><code className="text-slate-400">sudo edu-worker-manager list</code> <span className="text-slate-600 ml-2"># Ver workers</span></p>
                                            <p><code className="text-slate-400">sudo edu-worker-manager status</code> <span className="text-slate-600 ml-2"># Estado</span></p>
                                            <p><code className="text-slate-400">sudo edu-worker-manager logs {workerToken.slice(0,12)}...</code> <span className="text-slate-600 ml-2"># Logs</span></p>
                                            <p><code className="text-slate-400">sudo edu-worker-manager remove {workerToken.slice(0,12)}...</code> <span className="text-slate-600 ml-2"># Eliminar</span></p>
                                            <p><code className="text-slate-400">sudo edu-worker-manager resync all</code> <span className="text-slate-600 ml-2"># Forzar resync</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[10px] text-slate-600 text-center pt-2">
                                El worker se conectará a: <code className="text-slate-500">{nexusUrl || 'http://148.230.88.162:3001'}</code>
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default Terminal;
