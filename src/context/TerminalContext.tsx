'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { TerminalController, WorkspaceWorkerStatus, WorkerStatus, DocChangeEvent } from '@/lib/TerminalController';
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
    workspaceWorkerStatuses: Map<string, WorkerStatus>;
    getWorkerStatusForWorkspace: (workspaceId: string) => WorkerStatus;
    getSessionsForWorkspace: (workspaceId: string) => TerminalSession[];
    subscribeToWorkspace: (workspaceId: string) => void;
    clearActiveSession: () => void;
    lastDocChange: DocChangeEvent | null;
    onDocChangeCallback: ((cb: (event: DocChangeEvent) => void) => () => void) | null;
}

const TERMINAL_SESSIONS_VERSION = 1;
const TERMINAL_SESSIONS_KEY_PREFIX = 'terminal_sessions';
const TERMINAL_ACTIVE_SESSION_KEY_PREFIX = 'terminal_active_session';

interface PersistedTerminalState {
    version: number;
    sessions: TerminalSession[];
}

function getSessionsStorageKey(uid: string): string {
    return `${TERMINAL_SESSIONS_KEY_PREFIX}_${uid}`;
}

function getActiveStorageKey(uid: string): string {
    return `${TERMINAL_ACTIVE_SESSION_KEY_PREFIX}_${uid}`;
}

function isValidSession(value: unknown): value is TerminalSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as TerminalSession;
    return typeof session.id === 'string'
        && typeof session.workspaceId === 'string'
        && (session.workspaceType === 'personal' || session.workspaceType === 'shared');
}

function normalizeSessions(input: unknown): TerminalSession[] {
    if (!Array.isArray(input)) return [];
    const unique = new Map<string, TerminalSession>();
    for (const item of input) {
        if (!isValidSession(item)) continue;
        if (!unique.has(item.id)) {
            unique.set(item.id, item);
        }
    }
    return Array.from(unique.values());
}

function loadPersistedSessions(uid: string): TerminalSession[] {
    if (!uid || typeof window === 'undefined') return [];
    try {
        const stored = window.localStorage.getItem(getSessionsStorageKey(uid));
        if (!stored) return [];
        const parsed: PersistedTerminalState | TerminalSession[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
            return normalizeSessions(parsed);
        }
        if (!parsed || parsed.version !== TERMINAL_SESSIONS_VERSION) return [];
        return normalizeSessions(parsed.sessions);
    } catch (error) {
        console.warn('Failed to load terminal sessions:', error);
        return [];
    }
}

function savePersistedSessions(uid: string, sessionsToSave: TerminalSession[]): void {
    if (!uid || typeof window === 'undefined') return;
    try {
        if (!sessionsToSave.length) {
            window.localStorage.removeItem(getSessionsStorageKey(uid));
            return;
        }
        const payload: PersistedTerminalState = {
            version: TERMINAL_SESSIONS_VERSION,
            sessions: sessionsToSave
        };
        window.localStorage.setItem(getSessionsStorageKey(uid), JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to persist terminal sessions:', error);
    }
}

function loadPersistedActiveSession(uid: string): string | null {
    if (!uid || typeof window === 'undefined') return null;
    try {
        const stored = window.localStorage.getItem(getActiveStorageKey(uid));
        if (stored) return stored;
        const legacy = window.localStorage.getItem(TERMINAL_ACTIVE_SESSION_KEY_PREFIX);
        if (legacy) {
            window.localStorage.setItem(getActiveStorageKey(uid), legacy);
            window.localStorage.removeItem(TERMINAL_ACTIVE_SESSION_KEY_PREFIX);
            return legacy;
        }
    } catch (error) {
        console.warn('Failed to load active terminal session:', error);
    }
    return null;
}

function savePersistedActiveSession(uid: string, sessionId: string): void {
    if (!uid || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(getActiveStorageKey(uid), sessionId);
    } catch (error) {
        console.warn('Failed to persist active terminal session:', error);
    }
}

function clearPersistedActiveSession(uid: string): void {
    if (!uid || typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(getActiveStorageKey(uid));
        window.localStorage.removeItem(TERMINAL_ACTIVE_SESSION_KEY_PREFIX);
    } catch (error) {
        console.warn('Failed to clear active terminal session:', error);
    }
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

    const [workspaceWorkerStatuses, setWorkspaceWorkerStatuses] = useState<Map<string, WorkerStatus>>(new Map());
    const [lastDocChange, setLastDocChange] = useState<DocChangeEvent | null>(null);
    const docChangeCallbacksRef = useRef<Set<(event: DocChangeEvent) => void>>(new Set());
    const sessionsLoadedRef = useRef(false);
    const persistedSessionsRef = useRef<Map<string, TerminalSession>>(new Map());
    const restoringSessionIdsRef = useRef<Set<string>>(new Set());
    const savedActiveSessionIdRef = useRef<string | null>(null);

    const onDocChangeCallback = useCallback((cb: (event: DocChangeEvent) => void) => {
        docChangeCallbacksRef.current.add(cb);
        return () => {
            docChangeCallbacksRef.current.delete(cb);
        };
    }, []);

    const debugLog = useCallback((...args: unknown[]) => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(...args);
        }
    }, []);

    const getWorkerStatusForWorkspace = useCallback((workspaceId: string): WorkerStatus => {
        return workspaceWorkerStatuses.get(workspaceId) || 'unknown';
    }, [workspaceWorkerStatuses]);

    const getSessionsForWorkspace = useCallback((workspaceId: string): TerminalSession[] => {
        return sessions.filter(s => s.workspaceId === workspaceId);
    }, [sessions]);

    const restorePersistedSessions = useCallback(() => {
        const controller = controllerRef.current;
        if (!controller || !controller.socket?.connected) return;

        const sessionIds = new Set<string>();
        persistedSessionsRef.current.forEach((_value, sessionId) => {
            sessionIds.add(sessionId);
        });
        if (savedActiveSessionIdRef.current) {
            sessionIds.add(savedActiveSessionIdRef.current);
        }

        if (sessionIds.size === 0) return;
        restoringSessionIdsRef.current = new Set(sessionIds);
        sessionIds.forEach(sessionId => controller.restoreSession(sessionId));
    }, []);

    useEffect(() => {
        sessionsLoadedRef.current = false;
        persistedSessionsRef.current = new Map();
        restoringSessionIdsRef.current = new Set();
        savedActiveSessionIdRef.current = null;

        if (!user?.uid) {
            setSessions([]);
            setActiveSessionId(null);
            return;
        }

        const restoredSessions = loadPersistedSessions(user.uid);
        const restoredActive = loadPersistedActiveSession(user.uid);
        const restoredMap = new Map<string, TerminalSession>();
        restoredSessions.forEach(session => {
            restoredMap.set(session.id, session);
        });

        persistedSessionsRef.current = restoredMap;
        savedActiveSessionIdRef.current = restoredActive;
        restoringSessionIdsRef.current = new Set([
            ...restoredMap.keys(),
            ...(restoredActive ? [restoredActive] : [])
        ]);

        setSessions(Array.from(restoredMap.values()));
        setActiveSessionId(restoredActive ?? null);

        sessionsLoadedRef.current = true;
        if (controllerRef.current?.socket?.connected) {
            restorePersistedSessions();
        }
    }, [user?.uid, restorePersistedSessions]);

    useEffect(() => {
        if (!sessionsLoadedRef.current || !user?.uid) return;
        persistedSessionsRef.current = new Map(sessions.map(session => [session.id, session]));
        savePersistedSessions(user.uid, sessions);
    }, [sessions, user?.uid]);

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

        try {
            if (!currentUser.getIdToken) {
                throw new Error('User does not have getIdToken method - Firebase auth required');
            }
            const actualToken = await currentUser.getIdToken();

            // Try to restore session
            const savedSessionId = loadPersistedActiveSession(currentUser.uid);
            savedActiveSessionIdRef.current = savedSessionId;
            if (savedSessionId) {
                restoringSessionIdsRef.current.add(savedSessionId);
            }

            let pendingSessionMeta: { workspaceId: string; workspaceType: 'personal' | 'shared'; workspaceName?: string } | null = null;

            const handleSessionCreated = (data: { id: string; workspaceId?: string; workspaceType?: 'personal' | 'shared'; workspaceName?: string }) => {
                const isRestored = restoringSessionIdsRef.current.has(data.id);
                if (!isRestored) {
                    setIsCreatingSession(false);
                }
                restoringSessionIdsRef.current.delete(data.id);

                setSessions(prev => {
                    const existing = prev.find(s => s.id === data.id);
                    const workspaceId = data.workspaceId || pendingSessionMeta?.workspaceId || 'unknown';
                    const workspaceType = data.workspaceType || pendingSessionMeta?.workspaceType || 'personal';
                    const workspaceName = data.workspaceName || pendingSessionMeta?.workspaceName;
                    const persisted = persistedSessionsRef.current.get(data.id);
                    const existingCount = prev.filter(s => s.workspaceId === workspaceId).length;
                    const fallbackName = persisted?.name || `Terminal ${existingCount + 1}`;

                    if (existing) {
                        const nextSession = {
                            ...existing,
                            workspaceId,
                            workspaceType,
                            workspaceName,
                            name: existing.name || persisted?.name || fallbackName
                        };
                        if (
                            existing.workspaceId === nextSession.workspaceId
                            && existing.workspaceType === nextSession.workspaceType
                            && existing.workspaceName === nextSession.workspaceName
                            && existing.name === nextSession.name
                        ) {
                            return prev;
                        }
                        return prev.map(s => s.id === data.id ? nextSession : s);
                    }

                    const newSession: TerminalSession = {
                        id: data.id,
                        name: persisted?.name || fallbackName,
                        workspaceId,
                        workspaceType,
                        workspaceName
                    };
                    return [...prev, newSession];
                });

                if (!isRestored) {
                    pendingSessionMeta = null;
                }

                const shouldActivate = !isRestored || data.id === savedActiveSessionIdRef.current;
                if (shouldActivate) {
                    setActiveSessionId(data.id);
                    savePersistedActiveSession(currentUser.uid, data.id);
                    savedActiveSessionIdRef.current = data.id;
                }
            };

            const handleSessionEnded = (data: { sessionId: string }) => {
                setSessions(prev => prev.filter(s => s.id !== data.sessionId));
                setActiveSessionId(prev => {
                    if (prev === data.sessionId) {
                        clearPersistedActiveSession(currentUser.uid);
                        savedActiveSessionIdRef.current = null;
                        return null;
                    }
                    return prev;
                });
                restoringSessionIdsRef.current.delete(data.sessionId);
                controllerRef.current?.disposeSession(data.sessionId);
            };

            controller.connect(
                actualToken,
                currentUser.uid,
                savedSessionId,
                (newStatus) => {
                    debugLog('[TerminalContext] Hub status changed:', newStatus);
                    if (newStatus === 'hub-online') {
                        debugLog('[TerminalContext] Setting hubConnected=true, status=online');
                        setHubConnected(true);
                        setStatus('online');
                        restorePersistedSessions();
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
                handleSessionEnded,
                (workspaceStatus: WorkspaceWorkerStatus) => {
                    setWorkspaceWorkerStatuses(prev => {
                        const newMap = new Map(prev);
                        newMap.set(workspaceStatus.workspaceId, workspaceStatus.status);
                        return newMap;
                    });
                    if (workspaceStatus.status === 'online') {
                        setStatus('online');
                    }
                },
                // Callback para cambios de documentos (sync en tiempo real)
                (docEvent: DocChangeEvent) => {
                    debugLog('[TerminalContext] doc-change received:', docEvent);
                    setLastDocChange(docEvent);
                    // Notificar a todos los callbacks registrados
                    docChangeCallbacksRef.current.forEach(cb => cb(docEvent));
                },
                handleSessionCreated
            );

            controller.setWorkspaceSessionsHandler(({ workspaceId, sessions: remoteSessions }) => {
                setSessions(prev => {
                    const otherWorkspaceSessions = prev.filter(s => s.workspaceId !== workspaceId);
                    
                    const newSessions = remoteSessions.map(rs => {
                        const existing = prev.find(p => p.id === rs.id);
                        return {
                            id: rs.id,
                            workspaceId: rs.workspaceId,
                            workspaceType: (rs.workspaceType as 'personal' | 'shared') || 'personal',
                            workspaceName: rs.workspaceName,
                            name: existing?.name || `Terminal ${rs.id.slice(0, 4)}`
                        };
                    });

                    return [...otherWorkspaceSessions, ...newSessions];
                });
            });

            const originalStartSession = controller.startSession.bind(controller);
            controller.startSession = (opts: { workspaceId: string; workspaceName?: string; workspaceType: 'personal' | 'shared' }) => {
                pendingSessionMeta = { workspaceId: opts.workspaceId, workspaceType: opts.workspaceType, workspaceName: opts.workspaceName };
                originalStartSession(opts);
            };

            controller.socket?.on('connect_error', (err: Error) => {
                setErrorMessage(err.message);
                setStatus('error');
            });

        } catch (e: unknown) {
            setStatus('error');
            setErrorMessage(e instanceof Error ? e.message : 'Unknown error');
        }
    }, [debugLog, restorePersistedSessions]);

    const createSession = useCallback((workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => {
        setIsCreatingSession(true);
        controllerRef.current?.startSession({ workspaceId, workspaceName, workspaceType });
    }, []);

    const selectSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
        controllerRef.current?.setActiveSession(sessionId);
        if (user?.uid) {
            savePersistedActiveSession(user.uid, sessionId);
            savedActiveSessionIdRef.current = sessionId;
        }
    }, [user?.uid]);

    const destroySession = useCallback((sessionId: string) => {
        controllerRef.current?.killSession(sessionId);
    }, []);

    const subscribeToWorkspace = useCallback((workspaceId: string) => {
        controllerRef.current?.subscribeToWorkspace(workspaceId);
        controllerRef.current?.checkWorkerStatus(workspaceId);
    }, []);

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
            clearActiveSession,
            lastDocChange,
            onDocChangeCallback
        }}>
            {children}
        </TerminalContext.Provider>
    );
};
