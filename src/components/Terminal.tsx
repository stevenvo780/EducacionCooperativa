"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { useAuth } from '@/context/AuthContext';
import { Download, Copy, CheckCircle, Terminal as TerminalIcon, Cpu, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface TerminalProps {
  nexusUrl: string;
}

const Terminal: React.FC<TerminalProps> = ({ nexusUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for persistent instances across renders
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  const { user } = useAuth();
  const [hubConnected, setHubConnected] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- 1. Socket Connection Management ---
  useEffect(() => {
    if (!user) return;

    // Clean up existing socket if any
    if (socketRef.current) {
        socketRef.current.disconnect();
    }

    const initSocket = async () => {
        try {
            let token = '';
            // @ts-ignore
            if (typeof user.getIdToken === 'function') {
                // @ts-ignore
                token = await user.getIdToken();
            } else {
                console.warn("Using fallback auth token");
                token = 'mock-token'; 
            }

            console.log('🔌 Connecting to Hub:', nexusUrl);

            const socket = io(nexusUrl, {
                auth: {
                    type: 'client',
                    token: token,
                    // @ts-ignore
                    uid: user.uid 
                },
                transports: ['websocket'], // Force WebSocket
                reconnectionDelay: 1000,
                timeout: 10000,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('✅ Connected to Hub');
                setHubConnected(true);
                // Request updated worker status on connect
                // Note: The Hub should send it automatically on join, but we can't manually request it easily without an event
            });

            socket.on('disconnect', () => {
                console.log('❌ Disconnected from Hub');
                setHubConnected(false);
                setWorkerStatus('checking');
            });

            socket.on('worker-status', (data: { status: 'online' | 'offline' }) => {
                console.log('🤖 Worker Status:', data.status);
                setWorkerStatus(data.status);
            });

            socket.on('session-created', (data: { id: string }) => {
                console.log('🚀 Session Created:', data.id);
                setActiveSession(data.id);
            });

            socket.on('error', (err) => {
                console.error('Hub Error:', err);
            });
        } catch (e) {
            console.error("Socket Init Error:", e);
        }
    };

    initSocket();

    return () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    };
  }, [nexusUrl, user]); // Only re-run if URL or User changes

  // --- 2. Terminal Instance Management ---
  useEffect(() => {
    if (!activeSession || !containerRef.current) return;

    // If terminal already exists, just clear it and resize
    if (xtermRef.current) {
        xtermRef.current.clear();
        fitAddonRef.current?.fit();
        return;
    }

    console.log("🖥️ Initializing Xterm.js...");
    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#22c55e',
        selectionBackground: '#3f3f46',
      },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
      allowProposedApi: true,
      scrollback: 10000, // Increase scrollback
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    term.writeln('\x1b[32m✔ Connected to your Personal Assistant.\x1b[0m');
    term.writeln('Type commands to execute on your local machine.\r\n');

    // Handle Input (Keyboard -> Socket)
    term.onData((data) => {
      if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('execute', {
            sessionId: activeSession,
            command: data
          });
      }
    });

    // Handle Resize
    const handleResize = () => {
        if (!fitAddonRef.current || !socketRef.current || !activeSession) return;
        
        fitAddonRef.current.fit();
        const { cols, rows } = term;
        
        // Debounce resize events slightly if needed, but direct emit is usually fine for UI events
        socketRef.current.emit('resize', { sessionId: activeSession, cols, rows });
    };

    window.addEventListener('resize', handleResize);
    // Initial resize sync
    setTimeout(handleResize, 200);

    return () => {
        console.log("🧹 Cleaning up Terminal Instance");
        window.removeEventListener('resize', handleResize);
        term.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
    };
  }, [activeSession]); // Re-init ONLY if activeSession changes (which usually implies a session restart)

  // --- 3. Output Handling (Socket -> Terminal) ---
  // This is separated to avoid re-initializing the terminal when just the listener logic needs to bind
  useEffect(() => {
      if (!socketRef.current || !activeSession) return;

      const socket = socketRef.current;
      const term = xtermRef.current;

      const handleOutput = (data: { sessionId: string; data: string }) => {
          if (data.sessionId === activeSession && xtermRef.current) {
               xtermRef.current.write(data.data);
          }
      };

      socket.on('output', handleOutput);

      return () => {
          socket.off('output', handleOutput);
      };
  }, [activeSession, hubConnected]); // Re-bind if session or connection state cycles


  // --- Actions ---
  const startSession = () => {
      if (socketRef.current && hubConnected) {
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
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-black text-slate-200 overflow-y-auto">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shrink-0">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-950">
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <Cpu className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Connect your Local Agent</h2>
                        <p className="text-sm text-slate-400">Run the agent on your Linux machine to enable the terminal.</p>
                    </div>
                </div>

                {/* Status Bar */}
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

                {/* Instructions */}
                <div className="p-8 space-y-8">
                    
                    {/* Step 1 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">1</div>
                        <div className="space-y-3 flex-1">
                            <h3 className="font-semibold text-white">Download & Install Agent</h3>
                            <div className="flex gap-2">
                                <a 
                                    href="/downloads/edu-agent_1.0.0_amd64.deb" 
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"
                                >
                                    <Download className="w-4 h-4" /> Download .deb
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">2</div>
                        <div className="space-y-3 flex-1">
                            <h3 className="font-semibold text-white">Setup & Run</h3>
                            <div className="bg-black rounded-lg border border-slate-800 p-4 font-mono text-sm text-slate-300 space-y-2">
                                <p><span className="text-blue-400">$</span> sudo dpkg -i edu-agent_1.0.0_amd64.deb</p>
                                <p><span className="text-blue-400">$</span> edu-agent setup</p>
                                <p><span className="text-blue-400">$</span> edu-agent start -d</p>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">3</div>
                        <div className="space-y-3 flex-1">
                            <h3 className="font-semibold text-white">Your Worker Token</h3>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-black border border-slate-800 rounded px-3 py-2 font-mono text-green-400 text-sm truncate">
                                    {/* @ts-ignore */}
                                    {user.uid}
                                </code>
                                <button 
                                    onClick={copyToken}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                                    title="Copy Token"
                                >
                                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                {workerStatus === 'offline' && hubConnected && (
                    <div className="bg-yellow-500/10 border-t border-yellow-500/20 p-4 text-center">
                        <p className="text-yellow-200 text-sm flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Waiting for agent to connect...
                        </p>
                    </div>
                )}
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
                  <p>Your local assistant is ready.</p>
                  <button 
                      onClick={startSession}
                      className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-900/20"
                  >
                      <TerminalIcon className="w-5 h-5" /> Launch Terminal
                  </button>
              </div>
          ) : (
            <div className="flex-1 relative p-1 h-full w-full bg-black overflow-hidden">
                <div ref={containerRef} className="w-full h-full" />
            </div>
          )}
      </div>
  );
};

export default Terminal;
