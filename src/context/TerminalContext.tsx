'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { TerminalController } from '@/lib/TerminalController';
import { useAuth } from './AuthContext';

export interface TerminalSession {
    id: string;
    // We can add name or other metadata here if the backend provides it
    name?: string;
    workspaceId?: string;
}

interface TerminalContextType {
    controller: TerminalController | null;
    sessions: TerminalSession[];
    activeSessionId: string | null;
    status: 'checking' | 'online' | 'offline' | 'error';
    hubConnected: boolean;
    initialize: (nexusUrl: string) => Promise<void>;
    createSession: (workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => void;
    selectSession: (sessionId: string) => void;
    destroySession: (sessionId: string) => void; // Optional, if we supported it
    errorMessage: string | null;
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
    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'error'>('checking');
    const [hubConnected, setHubConnected] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initialize ONLY when explicitly called (usually by Dashboard) to allow dynamic Nexus URL
    const initialize = async (nexusUrl: string) => {
        if (!user || controllerRef.current) return;
        
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
            link.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css';
            document.head.appendChild(link);
        }

        // Connect
        try {
             let actualToken = 'mock-token';
             if (user.getIdToken) {
                 const token = await user.getIdToken();
                 actualToken = token.includes('.') ? token : 'mock-token';
             }

             controller.connect(actualToken, user.uid, (newStatus) => {
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
             }, () => {
                 // On Session Ended (Legacy callback, handled via events now)
             });

             // Listen for events
             controller.socket?.on('session-created', (data: { id: string }) => {
                 setSessions(prev => {
                     if (prev.find(s => s.id === data.id)) return prev;
                     return [...prev, { id: data.id, name: `Terminal ${prev.length + 1}` }];
                 });
                 setActiveSessionId(data.id);
             });

             controller.socket?.on('session-ended', (data: { sessionId: string }) => {
                 setSessions(prev => prev.filter(s => s.id !== data.sessionId));
                 setActiveSessionId(prev => prev === data.sessionId ? null : prev);
             });

             controller.socket?.on('connect_error', (err: any) => {
                 setErrorMessage(err.message);
                 setStatus('error');
             });

        } catch (e: any) {
            console.error('Terminal Connect Error', e);
            setStatus('error');
            setErrorMessage(e.message);
        }
    };

    const createSession = (workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => {
        controllerRef.current?.startSession({ workspaceId, workspaceName, workspaceType });
    };

    const selectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
        controllerRef.current?.setActiveSession(sessionId);
    };
    
    const destroySession = (sessionId: string) => {
        controllerRef.current?.killSession(sessionId);
    };

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
            initialize,
            createSession,
            selectSession,
            destroySession,
            errorMessage
        }}>
            {children}
        </TerminalContext.Provider>
    );
};
