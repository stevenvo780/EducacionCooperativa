'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { TerminalController, WorkspaceWorkerStatus, WorkerStatus } from '@/lib/TerminalController';
import { useAuth } from './AuthContext';

export interface TerminalSession {
    id: string;
    name?: string;
    workspaceId: string;
    workspaceType: 'personal' | 'shared';
    workspaceName?: string;
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
    // Per-workspace worker status tracking
    workspaceWorkerStatuses: Map<string, WorkerStatus>;
    getWorkerStatusForWorkspace: (workspaceId: string) => WorkerStatus;
    // Per-workspace session filtering
    getSessionsForWorkspace: (workspaceId: string) => TerminalSession[];
    // Subscribe to workspace worker status
    subscribeToWorkspace: (workspaceId: string) => void;
    // Clear active session (used when switching workspaces)
    clearActiveSession: () => void;
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

    const debugLog = useCallback((...args: unknown[]) => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(...args);
        }
    }, []);

    const getWorkerStatusForWorkspace = useCallback((workspaceId: string): WorkerStatus => {
        return workspaceWorkerStatuses.get(workspaceId) || 'unknown';
    }, [workspaceWorkerStatuses]);

    // Filter sessions by workspace
    const getSessionsForWorkspace = useCallback((workspaceId: string): TerminalSession[] => {
        return sessions.filter(s => s.workspaceId === workspaceId);
    }, [sessions]);

    const initialize = useCallback(async (nexusUrl: string) => {
        debugLog('[TerminalContext] initialize called with nexusUrl:', nexusUrl);
        const currentUser = getUserRef.current();
        debugLog('[TerminalContext] currentUser:', currentUser?.uid, 'controllerRef.current:', !!controllerRef.current);
        if (!currentUser || controllerRef.current) {
            debugLog('[TerminalContext] Returning early - no user or controller already exists');
            return;
        }

        debugLog('[TerminalContext] Starting initialization...');
        setStatus('checking');
        setHubConnected(false);
        setErrorMessage(null);

        const controller = new TerminalController(nexusUrl);
        const ok = await controller.initialize();
        debugLog('[TerminalContext] Controller initialized:', ok);
        if (!ok) {
            setStatus('error');
            setErrorMessage('Failed to initialize terminal controller');
            return;
        }

        controllerRef.current = controller;

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
                    debugLog('[TerminalContext] Hub status changed:', newStatus);
                    if (newStatus === 'hub-online') {
                        // Hub reachable; treat as online so UI does not remain stuck in "checking" state
                        debugLog('[TerminalContext] Setting hubConnected=true, status=online');
                        setHubConnected(true);
                        setStatus('online');
                    } else if (newStatus === 'hub-offline') {
                        debugLog('[TerminalContext] Setting hubConnected=false, status=offline');
                        setHubConnected(false);
                        setStatus('offline');
                    } else if (newStatus === 'online') {
                        debugLog('[TerminalContext] Setting hubConnected=true, status=online (online event)');
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
            // Track pending session metadata for when session-created fires
            let pendingSessionMeta: { workspaceId: string; workspaceType: 'personal' | 'shared'; workspaceName?: string } | null = null;

            // Override startSession to capture metadata
            const originalStartSession = controller.startSession.bind(controller);
            controller.startSession = (opts: { workspaceId: string; workspaceName?: string; workspaceType: 'personal' | 'shared' }) => {
                pendingSessionMeta = { workspaceId: opts.workspaceId, workspaceType: opts.workspaceType, workspaceName: opts.workspaceName };
                originalStartSession(opts);
            };

            controller.socket?.on('session-created', (data: { id: string; workspaceId?: string }) => {
                setIsCreatingSession(false);
                setSessions(prev => {
                    if (prev.find(s => s.id === data.id)) return prev;
                    // Prefer server-provided workspaceId; fallback to pending meta
                    const workspaceId = data.workspaceId || pendingSessionMeta?.workspaceId || 'unknown';
                    const workspaceType = pendingSessionMeta?.workspaceType || 'personal';
                    const workspaceName = pendingSessionMeta?.workspaceName;
                    const existingCount = prev.filter(s => s.workspaceId === workspaceId).length;
                    const newSession: TerminalSession = {
                        id: data.id,
                        name: `Terminal ${existingCount + 1}`,
                        workspaceId,
                        workspaceType,
                        workspaceName
                    };
                    pendingSessionMeta = null;
                    return [...prev, newSession];
                });
                setActiveSessionId(data.id);
            });

            controller.socket?.on('session-ended', (data: { sessionId: string }) => {
                setSessions(prev => prev.filter(s => s.id !== data.sessionId));
                setActiveSessionId(prev => prev === data.sessionId ? null : prev);
                controllerRef.current?.disposeSession(data.sessionId);
            });

            controller.socket?.on('connect_error', (err: Error) => {
                setErrorMessage(err.message);
                setStatus('error');
            });

        } catch (e: unknown) {
            setStatus('error');
            setErrorMessage(e instanceof Error ? e.message : 'Unknown error');
        }
    }, [debugLog]);

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

    const subscribeToWorkspace = useCallback((workspaceId: string) => {
        controllerRef.current?.subscribeToWorkspace(workspaceId);
        controllerRef.current?.checkWorkerStatus(workspaceId);
    }, []);

    // Clear active session when switching workspaces to prevent cross-workspace session leakage
    const clearActiveSession = useCallback(() => {
        setActiveSessionId(null);
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
            getWorkerStatusForWorkspace,
            getSessionsForWorkspace,
            subscribeToWorkspace,
            clearActiveSession
        }}>
            {children}
        </TerminalContext.Provider>
    );
};
