'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { TerminalController, WorkspaceWorkerStatus, WorkerStatus } from '@/lib/TerminalController';
import { useAuth } from './AuthContext';

export interface TerminalSession {
    id: string;
    name?: string;
    workspaceId?: string;
}

interface TerminalContextType {
    controller: TerminalController | null;
    sessions: TerminalSession[];
    activeSessionId: string | null;
    status: 'checking' | 'online' | 'offline' | 'error';
    hubConnected: boolean;
    isCreatingSession: boolean;
    initialize: (nexusUrl: string) => Promise<void>;
    createSession: (workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => void;
    selectSession: (sessionId: string) => void;
    destroySession: (sessionId: string) => void;
    errorMessage: string | null;
    // NEW: Per-workspace worker status tracking
    workspaceWorkerStatuses: Map<string, WorkerStatus>;
    getWorkerStatusForWorkspace: (workspaceId: string) => WorkerStatus;
}

const TerminalContext = createContext<TerminalContextType | null>(null);

export const useTerminal = () => {
    const context = useContext(TerminalContext);
    if (!context) {
        throw new Error('useTerminal must be used within a TerminalProvider');
    }
    return context;
};

export const TerminalProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const controllerRef = useRef<TerminalController | null>(null);
    const getUserRef = useRef(() => user);
    getUserRef.current = () => user;

    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'error'>('checking');
    const [hubConnected, setHubConnected] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    // NEW: Track worker status per workspace
    const [workspaceWorkerStatuses, setWorkspaceWorkerStatuses] = useState<Map<string, WorkerStatus>>(new Map());

    const getWorkerStatusForWorkspace = useCallback((workspaceId: string): WorkerStatus => {
        return workspaceWorkerStatuses.get(workspaceId) || 'unknown';
    }, [workspaceWorkerStatuses]);

    const initialize = useCallback(async (nexusUrl: string) => {
        const currentUser = getUserRef.current();
        if (!currentUser || controllerRef.current) {
            return;
        }

        setStatus('checking');
        setHubConnected(false);
        setErrorMessage(null);

        const controller = new TerminalController(nexusUrl);
        const ok = await controller.initialize();
        if (!ok) {
            setStatus('error');
            setErrorMessage('Failed to initialize terminal controller');
            return;
        }

        controllerRef.current = controller;

        // Load XTerm CSS globally once
        if (typeof document !== 'undefined' && !document.getElementById('xterm-css')) {
            const link = document.createElement('link');
            link.id = 'xterm-css';
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css';
            document.head.appendChild(link);
        }

        // Connect with per-workspace status handler
        try {
            let actualToken = 'mock-token';
            if (currentUser.getIdToken) {
                const token = await currentUser.getIdToken();
                actualToken = token.includes('.') ? token : 'mock-token';
            }

            controller.connect(
                actualToken,
                currentUser.uid,
                // Hub status callback
                (newStatus) => {
                    if (newStatus === 'hub-online') {
                        setHubConnected(true);
                        setStatus(prev => prev === 'online' ? 'online' : 'checking');
                    } else if (newStatus === 'hub-offline') {
                        setHubConnected(false);
                        setStatus('offline');
                    } else if (newStatus === 'online') {
                        setHubConnected(true);
                        setStatus('online');
                    } else if (newStatus === 'offline') {
                        setStatus('offline');
                    } else if (newStatus === 'error') {
                        setStatus('error');
                    }
                },
                // Session ended callback
                (_payload) => {
                    // Handled via socket events below
                },
                // Per-workspace worker status callback
                (workspaceStatus: WorkspaceWorkerStatus) => {
                    setWorkspaceWorkerStatuses(prev => {
                        const newMap = new Map(prev);
                        newMap.set(workspaceStatus.workspaceId, workspaceStatus.status);
                        return newMap;
                    });
                    // Also update global status if it's online (backwards compat)
                    if (workspaceStatus.status === 'online') {
                        setStatus('online');
                    }
                }
            );

            // Listen for events
            controller.socket?.on('session-created', (data: { id: string }) => {
                setIsCreatingSession(false);
                setSessions(prev => {
                    if (prev.find(s => s.id === data.id)) return prev;
                    const newSession = { id: data.id, name: `Terminal ${prev.length + 1}` };
                    return [...prev, newSession];
                });
                setActiveSessionId(data.id);
            });

            controller.socket?.on('session-ended', (data: { sessionId: string }) => {
                setSessions(prev => prev.filter(s => s.id !== data.sessionId));
                setActiveSessionId(prev => prev === data.sessionId ? null : prev);
            });

            controller.socket?.on('connect_error', (err: Error) => {
                setErrorMessage(err.message);
                setStatus('error');
            });

        } catch (e: unknown) {
            setStatus('error');
            setErrorMessage(e instanceof Error ? e.message : 'Unknown error');
        }
    }, []);

    const createSession = useCallback((workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => {
        setIsCreatingSession(true);
        controllerRef.current?.startSession({ workspaceId, workspaceName, workspaceType });
    }, []);

    const selectSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
        controllerRef.current?.setActiveSession(sessionId);
    }, []);

    const destroySession = useCallback((sessionId: string) => {
        controllerRef.current?.killSession(sessionId);
    }, []);

    useEffect(() => {
        return () => {
            controllerRef.current?.destroy();
            controllerRef.current = null;
        };
    }, []);

    return (
        <TerminalContext.Provider value={{
            controller: controllerRef.current,
            sessions,
            activeSessionId,
            status,
            hubConnected,
            isCreatingSession,
            initialize,
            createSession,
            selectSession,
            destroySession,
            errorMessage,
            workspaceWorkerStatuses,
            getWorkerStatusForWorkspace
        }}>
            {children}
        </TerminalContext.Provider>
    );
};
