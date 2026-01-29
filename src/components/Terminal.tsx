"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TerminalController } from '@/lib/TerminalControllerLazy';
import { CheckCircle, AlertCircle, Loader2, Terminal as TerminalIcon, Download } from 'lucide-react';

interface TerminalProps {
  nexusUrl: string;
}

type TerminalStatus = 'checking' | 'online' | 'offline' | 'error';

const TerminalInner: React.FC<TerminalProps> = ({ nexusUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<TerminalController | null>(null);
  const { user } = useAuth();
  
  const [status, setStatus] = useState<TerminalStatus>('checking');
  const [sessionActive, setSessionActive] = useState(false);
  const [hubConnected, setHubConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            const actualToken =
                typeof user.getIdToken === 'function' ? await user.getIdToken() : 'mock-token';
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

  // Mount Xterm to DOM when session becomes active and div is rendered
  useEffect(() => {
      if (sessionActive && containerRef.current && controllerRef.current) {
          try {
              // Check if already mounted (xterm element exists)
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
      controllerRef.current?.startSession();
  };

  // --- Render UI ---
  if (!user) return <div>Log in required</div>;

  const showHubError = status === 'error' || (!hubConnected && status !== 'checking');

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
        <div
            className={`absolute inset-0 ${sessionActive ? 'opacity-100' : 'opacity-0 pointer-events-none'} cursor-text`}
            onClick={() => controllerRef.current?.term.focus()}
        >
            <div ref={containerRef} className="w-full h-full" />
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
                                ? (hubConnected ? 'Buscando agente...' : 'Conectando al hub...')
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
                                ? 'Hub conectado. Esperando que tu agente esté activo.'
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
                                    <p>No se detecta el agente en tu máquina.</p>
                                    <div className="bg-black p-4 rounded text-left font-mono text-sm border border-slate-800">
                                        <p className="text-emerald-400">$ edu-agent start -d</p>
                                    </div>
                                    <a href="/downloads/edu-agent_1.0.0_amd64.deb" className="text-blue-400 hover:underline flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" /> Descargar Instalador
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
