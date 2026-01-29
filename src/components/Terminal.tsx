"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { useAuth } from '@/context/AuthContext'; // Assuming AuthContext exists

interface TerminalProps {
  nexusUrl: string;
}

const Terminal: React.FC<TerminalProps> = ({ nexusUrl }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const workersRef = useRef<any[]>([]);
  const { user } = useAuth(); // Get current user for auth token
  const [connected, setConnected] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  useEffect(() => {
    if (!terminalRef.current || !user) return;

    // Initialize XTerm
    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
      },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to Nexus
    // Note: In a real app, you'd get the token securely
    const token = "dummy-token"; // We'll need a way to pass the user token if Nexus supports it
    
    const socket = io(nexusUrl, {
      auth: {
        type: 'client',
        token: token, // Or firebaseToken: await user.getIdToken()
        firebaseToken: "implement-get-token-here" 
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to Nexus');
      setConnected(true);
      term.writeln('\x1b[32mConnected to Education Cooperative Cloud Hub\x1b[0m');
      
      // Register as client
      socket.emit('register', { type: 'client' });
    });

    socket.on('worker-list', (list: any[]) => {
      setWorkers(list);
      // If we see our own worker (matched by some logic), auto-connect?
      // For now just list them
    });

    socket.on('output', (data: { sessionId: string; data: string }) => {
        if (data.sessionId === activeSessionRef.current) {
             term.write(data.data);
        }
    });

    socket.on('session-created', (session: any) => {
        setActiveSession(session.id);
        term.clear();
    });

    // Handle input
    term.onData((data) => {
      if (activeSessionRef.current && socket.connected) {
        socket.emit('execute', {
            workerId: workersRef.current[0]?.id, // Hack: just pick first worker for demo
            sessionId: activeSessionRef.current,
            command: data 
        });
      }
    });
    
    // Handle resize
    const handleResize = () => {
        fitAddon.fit();
        if (activeSessionRef.current && socket.connected) {
            socket.emit('resize', {
                workerId: workersRef.current[0]?.id,
                sessionId: activeSessionRef.current,
                cols: term.cols,
                rows: term.rows
            });
        }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      socket.disconnect();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [nexusUrl, user]);

  // Simple UI to pick a worker if not in a session
  if (!activeSession && workers.length > 0) {
      return (
          <div className="p-4 bg-gray-900 text-white h-full">
              <h2 className="text-xl mb-4">Available Assistants</h2>
              <div className="grid gap-4">
                  {workers.map(w => (
                      <button 
                        key={w.id}
                        className="p-4 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 text-left"
                        onClick={() => {
                            // Start session
                            const sessionId = `session-${Date.now()}`;
                            socketRef.current?.emit('create-session', {
                                id: sessionId,
                                workerName: w.name,
                                workerKey: w.name.toLowerCase(), // Simplification
                                displayName: "My Session"
                            });
                            setActiveSession(sessionId);
                            // Also need to join it?
                            // Nexus logic implies create -> ready.
                        }}
                      >
                          <div className="font-bold">{w.name}</div>
                          <div className="text-sm text-gray-400">{w.status}</div>
                      </button>
                  ))}
              </div>
          </div>
      )
  }

  return <div ref={terminalRef} className="w-full h-full min-h-[500px]" />;
};

export default Terminal;
