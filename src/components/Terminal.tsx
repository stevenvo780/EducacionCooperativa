"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { useAuth } from '@/context/AuthContext';
import { Download, Copy, CheckCircle, Terminal as TerminalIcon, Cpu, AlertCircle, Loader2 } from 'lucide-react';

interface TerminalProps {
  nexusUrl: string;
}

const Terminal: React.FC<TerminalProps> = ({ nexusUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  const { user } = useAuth();
  const [hubConnected, setHubConnected] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- 1. Socket Connection ---
  useEffect(() => {
    if (!user) return;

    console.log('🔌 Connecting Socket...');
    
    // Auth fallback
    // @ts-ignore
    const token = typeof user.getIdToken === 'function' ? user.getIdToken() : 'mock-token'; 
    // @ts-ignore
    const uid = user.uid;

    // Use a promised token if it's a promise (standard firebase)
    Promise.resolve(token).then(actualToken => {
        const socket = io(nexusUrl, {
            auth: {
                type: 'client',
                token: actualToken,
                uid: uid
            },
            transports: ['websocket'],
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Socket Connected:', socket.id);
            setHubConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket Disconnected');
            setHubConnected(false);
            setWorkerStatus('checking');
        });

        socket.on('worker-status', (data) => {
            console.log('🤖 Worker Status:', data.status);
            setWorkerStatus(data.status);
        });

        socket.on('session-created', (data) => {
            console.log('🚀 Session Created:', data.id);
            setActiveSession(data.id);
        });

        socket.on('output', (data) => {
            // Write to terminal directly here to avoid React render cycle latency
            if (activeSession && data.sessionId === activeSession && xtermRef.current) {
                xtermRef.current.write(data.data);
            }
        });
    });

    return () => {
        if (socketRef.current) socketRef.current.disconnect();
    };
  }, [nexusUrl, user]); // Only reconnect if user/url changes

  // --- 2. Terminal Instance ---
  useEffect(() => {
    if (!activeSession || !containerRef.current) return;
    
    // Prevent double init
    if (xtermRef.current) return;

    console.log('🖥️ Initializing Terminal UI...');

    const term = new XTerm({
        cursorBlink: true,
        theme: {
            background: '#09090b',
            foreground: '#f4f4f5',
            cursor: '#22c55e',
            selectionBackground: '#3f3f46',
        },
        fontFamily: 'monospace', // Use generic monospace to avoid font loading issues crashing canvas
        fontSize: 14,
        allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    try {
        term.open(containerRef.current);
        fitAddon.fit();
    } catch (e) {
        console.error("Terminal Open Error:", e);
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[32m✔ Connected.\x1b[0m');

    // Input Handler
    term.onData(data => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('execute', {
                sessionId: activeSession,
                command: data
            });
        }
    });

    // Resize Observer for robust responsiveness
    const resizeObserver = new ResizeObserver(() => {
        try {
            fitAddon.fit();
            if (socketRef.current?.connected) {
                socketRef.current.emit('resize', {
                    sessionId: activeSession,
                    cols: term.cols,
                    rows: term.rows
                });
            }
        } catch (e) { 
            // Ignore resize errors
        }
    });
    
    resizeObserver.observe(containerRef.current);

    // Force focus
    term.focus();

    return () => {
        resizeObserver.disconnect();
        term.dispose();
        xtermRef.current = null;
    };
  }, [activeSession]); // Only init when we have a session

  // --- Actions ---
  const startSession = () => {
      if (socketRef.current?.connected) {
          socketRef.current.emit('create-session');
      }
  };

  const copyToken = () => {
    // @ts-ignore
    if (user?.uid) {
        // @ts-ignore
        navigator.clipboard.writeText(user.uid);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- Render ---
  if (!user) return <div className="p-8 text-center text-gray-400">Please log in.</div>;

  if (workerStatus === 'offline' || workerStatus === 'checking') {
      // ... same onboarding UI ...
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-black text-slate-200 overflow-y-auto">
            {/* ... Reuse previous UI for brevity, it was good ... */}
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shrink-0">
                <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-950">
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <Cpu className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Connect your Local Agent</h2>
                        <p className="text-sm text-slate-400">Run the agent on your Linux machine.</p>
                    </div>
                </div>
                <div className="bg-slate-950/50 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
                     <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-400">Hub Status:</span>
                        {hubConnected ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-medium"><CheckCircle className="w-3 h-3" /> Connected</span>
                        ) : (
                            <span className="flex items-center gap-1 text-red-400 font-medium"><AlertCircle className="w-3 h-3" /> Disconnected</span>
                        )}
                     </div>
                     <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-400">Agent Status:</span>
                        {workerStatus === 'checking' ? (
                            <span className="flex items-center gap-1 text-yellow-400"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</span>
                        ) : (
                            <span className="flex items-center gap-1 text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">OFFLINE</span>
                        )}
                     </div>
                </div>
                <div className="p-8 space-y-8">
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">1</div>
                        <div className="space-y-3 flex-1">
                            <h3 className="font-semibold text-white">Download & Install</h3>
                            <a href="/downloads/edu-agent_1.0.0_amd64.deb" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"><Download className="w-4 h-4" /> Download .deb</a>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">2</div>
                        <div className="space-y-3 flex-1">
                            <h3 className="font-semibold text-white">Your Token</h3>
                            <div className="flex items-center gap-2">
                                {/* @ts-ignore */}
                                <code className="flex-1 bg-black border border-slate-800 rounded px-3 py-2 font-mono text-green-400 text-sm truncate">{user.uid}</code>
                                <button onClick={copyToken} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"><Copy className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
      <div className="flex flex-col h-full bg-black">
          {!activeSession ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 mb-2">
                       <CheckCircle className="w-12 h-12 text-emerald-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Agent Online</h2>
                  <button 
                      onClick={startSession}
                      className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-900/20"
                  >
                      <TerminalIcon className="w-5 h-5" /> Launch Terminal
                  </button>
              </div>
          ) : (
            // IMPORTANT: Container with strict dimensions to prevent fit() crash
            <div className="flex-1 relative w-full h-full overflow-hidden bg-black p-2">
                <div ref={containerRef} className="w-full h-full" style={{ minHeight: '300px' }} />
            </div>
          )}
      </div>
  );
};

export default Terminal;