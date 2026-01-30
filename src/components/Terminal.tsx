'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TerminalController } from '@/lib/TerminalController';
import { CheckCircle, AlertCircle, Loader2, Terminal as TerminalIcon, Download, Copy, Key } from 'lucide-react';

interface TerminalProps {
  nexusUrl: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: 'personal' | 'shared';
}

type TerminalStatus = 'checking' | 'online' | 'offline' | 'error';

const TerminalInner: React.FC<TerminalProps> = ({
  nexusUrl,
  workspaceId,
  workspaceName,
  workspaceType
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<TerminalController | null>(null);
  const { user } = useAuth();

  const [status, setStatus] = useState<TerminalStatus>('checking');
  const [sessionActive, setSessionActive] = useState(false);
  const [hubConnected, setHubConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastWorkspaceRef = useRef<string | null>(null);

  const resolvedWorkspaceId = workspaceId || 'personal';
  const isPersonalWorkspace = workspaceType === 'personal' || resolvedWorkspaceId === 'personal';
  const workspaceCode = isPersonalWorkspace ? 'personal' : resolvedWorkspaceId;
  const workspaceLabel = workspaceName || (isPersonalWorkspace ? 'Espacio Personal' : 'Espacio');
  const workspacePath = isPersonalWorkspace
    ? '/workspace'
    : `/workspace/_ws/${resolvedWorkspaceId}`;
  const sessionPayload = useMemo(() => ({
    workspaceId: workspaceCode,
    workspaceName: workspaceLabel,
    workspaceType: isPersonalWorkspace ? 'personal' : 'shared'
  }), [workspaceCode, workspaceLabel, isPersonalWorkspace]);

  useEffect(() => {
    if (!user || controllerRef.current) return;

    setStatus('checking');
    setHubConnected(false);
    setSessionActive(false);
    setErrorMessage(null);

    if (!nexusUrl) {
        setStatus('error');
        setErrorMessage('URL de Nexus no configurada.');
        return;
    }

    let cancelled = false;
    const uid = user.uid;

    const initAndConnect = async () => {
        const controller = new TerminalController(nexusUrl);

        // Initialize (lazy load xterm)
        const ok = await controller.initialize();
        if (!ok || cancelled) {
            console.error('[Terminal] Init failed');
            setStatus('error');
            setErrorMessage('No se pudo inicializar el terminal.');
            return;
        }

        controllerRef.current = controller;

        // Load CSS dynamically
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css';
        document.head.appendChild(link);

        try {
            // Get token - use mock-token for custom auth (non-Firebase users)
            let actualToken = 'mock-token';
            if (typeof user.getIdToken === 'function') {
                const token = await user.getIdToken();
                // If token looks like a JWT (has dots), use it. Otherwise use mock-token.
                actualToken = token.includes('.') ? token : 'mock-token';
            }
            if (cancelled) return;
            controller.connect(
                actualToken,
                uid,
                (newStatus) => {
                    if (newStatus === 'hub-online') {
                        setHubConnected(true);
                        setStatus(prev => (prev === 'online' ? prev : 'checking'));
                        return;
                    }
                    if (newStatus === 'hub-offline') {
                        setHubConnected(false);
                        setStatus('offline');
                        setSessionActive(false);
                        return;
                    }
                    if (newStatus === 'online') {
                        setHubConnected(true);
                        setStatus('online');
                        return;
                    }
                    if (newStatus === 'offline') {
                        setStatus('offline');
                        setSessionActive(false);
                        controllerRef.current?.clearSession('Worker offline');
                        return;
                    }
                    if (newStatus === 'error') {
                        setHubConnected(false);
                        setStatus('error');
                        setSessionActive(false);
                        controllerRef.current?.clearSession('Connection error');
                        return;
                    }
                },
                () => {
                    setSessionActive(false);
                }
            );

            controller.socket?.on('session-created', () => {
                setSessionActive(true);
            });
            controller.socket?.on('connect_error', (err: Error) => {
                setStatus('error');
                setHubConnected(false);
                setSessionActive(false);
                setErrorMessage(err?.message || 'No se pudo conectar al hub.');
            });
            controller.socket?.on('error', (err: unknown) => {
                const message = typeof err === 'string' ? err : 'Error en el socket.';
                setStatus('error');
                setHubConnected(false);
                setSessionActive(false);
                setErrorMessage(message);
            });
        } catch (err) {
            if (cancelled) return;
            console.error('[Terminal] Auth error', err);
            setStatus('error');
            setHubConnected(false);
            setSessionActive(false);
            setErrorMessage('Error de autenticacion. Revisa tu sesion.');
        }
    };

    initAndConnect();

    return () => {
        cancelled = true;
        controllerRef.current?.destroy();
        controllerRef.current = null;
    };
  }, [nexusUrl, user]);

  useEffect(() => {
      if (sessionActive && containerRef.current && controllerRef.current) {
          try {
              if (!containerRef.current.hasChildNodes()) {
                  controllerRef.current.mount(containerRef.current);
              }
              controllerRef.current.fit();
          } catch (err) {
              console.error('[Terminal] Mount error', err);
              setStatus('error');
              setHubConnected(false);
              setSessionActive(false);
              setErrorMessage('No se pudo montar el terminal.');
              return;
          }

          if (typeof ResizeObserver === 'function') {
              const resizeObserver = new ResizeObserver(() => {
                  controllerRef.current?.fit();
              });
              resizeObserver.observe(containerRef.current);
              return () => resizeObserver.disconnect();
          }
      }
  }, [sessionActive]);

  const handleStart = () => {
      controllerRef.current?.startSession(sessionPayload);
  };

  useEffect(() => {
    const currentWorkspace = workspaceCode;
    if (!sessionActive || !controllerRef.current) {
      lastWorkspaceRef.current = currentWorkspace;
      return;
    }
    if (lastWorkspaceRef.current && lastWorkspaceRef.current !== currentWorkspace) {
      controllerRef.current.startSession(sessionPayload);
    }
    lastWorkspaceRef.current = currentWorkspace;
  }, [sessionActive, workspaceCode, sessionPayload]);

  if (!user) return <div>Log in required</div>;

  const showHubError = status === 'error' || (!hubConnected && status !== 'checking');
  const downloadPath = '/downloads/edu-worker_1.0.0_amd64.deb';
  const downloadUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${downloadPath}`
    : downloadPath;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
        <div
            className={`absolute inset-0 ${sessionActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
            style={{ minHeight: '100%' }}
        >
            <div
                ref={containerRef}
                className="w-full h-full terminal-container"
                style={{
                    height: '100%',
                    minHeight: '300px'
                }}
                onClick={() => controllerRef.current?.term?.focus()}
            />
        </div>
        {!sessionActive && (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-black text-slate-200">
                <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div
                            className={`p-4 rounded-full border ${
                                status === 'online'
                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                    : status === 'checking'
                                        ? 'bg-amber-500/10 border-amber-500/20'
                                        : 'bg-red-500/10 border-red-500/20'
                            }`}
                        >
                            {status === 'online' && <CheckCircle className="w-12 h-12 text-emerald-500" />}
                            {status === 'checking' && <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />}
                            {status !== 'online' && status !== 'checking' && <AlertCircle className="w-12 h-12 text-red-500" />}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white">
                        {status === 'online'
                            ? 'Asistente Conectado'
                            : status === 'checking'
                                ? (hubConnected ? 'Buscando worker...' : 'Conectando al hub...')
                                : showHubError
                                    ? 'No se pudo conectar al hub'
                                    : 'Asistente Desconectado'}
                    </h2>

                    {status === 'online' ? (
                        <button
                            onClick={handleStart}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-lg flex items-center gap-2 mx-auto transition-all shadow-lg hover:shadow-emerald-900/20"
                        >
                            <TerminalIcon className="w-6 h-6" /> Abrir Terminal
                        </button>
                    ) : status === 'checking' ? (
                        <div className="text-slate-400 text-sm">
                            {hubConnected
                                ? 'Hub conectado. Esperando que tu worker esté activo.'
                                : 'Verificando conexión con el servidor.'}
                        </div>
                    ) : (
                        <div className="space-y-4 text-slate-400">
                            {showHubError ? (
                                <div className="space-y-2">
                                    <p>Revisa la URL de Nexus y la conectividad de red.</p>
                                    {errorMessage && (
                                        <p className="text-red-300 text-sm">{errorMessage}</p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <p>No se detecta el worker en tu máquina.</p>
                                    <div className="space-y-3">
                                        {/* Token Display */}
                                        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-left space-y-2">
                                            <div className="flex justify-between items-center text-xs font-mono">
                                                <span className="text-slate-400 font-bold flex items-center gap-2">
                                                    <Key className="w-3 h-3" /> WORKER_TOKEN (Clave de Asociación)
                                                </span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(user.uid)}
                                                    className="flex items-center gap-1 text-slate-500 hover:text-emerald-400 transition-colors"
                                                >
                                                    <Copy className="w-3 h-3" /> <span className="text-[10px]">Copiar</span>
                                                </button>
                                            </div>
                                            <code className="block w-full bg-black rounded border border-slate-800 p-2 text-yellow-400 text-sm font-mono break-all select-all">
                                                {user.uid}
                                            </code>
                                        </div>

                                        <div className="bg-slate-950/60 border border-slate-800/50 rounded-lg p-2 text-left text-xs font-mono space-y-1 opacity-75">
                                            <p className="text-slate-500">Espacio: <span className="text-slate-300">{workspaceLabel}</span></p>
                                            <p className="text-slate-500">Ruta: <span className="text-slate-300">{workspacePath}</span></p>
                                        </div>
                                    </div>

                                    <div className="bg-black p-4 rounded text-left font-mono text-sm border border-slate-800 overflow-x-auto">
                                        <p className="text-slate-500 text-xs mb-1"># 1. Descargar e Instalar</p>
                                        <p className="text-emerald-400 whitespace-nowrap mb-3">$ curl -fsSL {downloadUrl} -o edu-worker.deb && sudo apt install ./edu-worker.deb</p>

                                        <p className="text-slate-500 text-xs mb-1"># 2. Configurar Token</p>
                                        <p className="text-yellow-200 whitespace-pre-wrap mb-3 break-all">
                                            $ sudo sed -i &apos;s/WORKER_TOKEN=/WORKER_TOKEN={user.uid}/&apos; /etc/edu-worker/worker.env
                                        </p>

                                        <p className="text-slate-500 text-xs mb-1"># 3. Reiniciar Servicio</p>
                                        <p className="text-emerald-400 whitespace-nowrap">$ sudo systemctl restart edu-worker</p>
                                    </div>
                                    <a href={downloadPath} className="text-blue-400 hover:underline flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" /> Descargar Worker
                                    </a>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default TerminalInner;
