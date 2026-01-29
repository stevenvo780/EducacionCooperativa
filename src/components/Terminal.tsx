"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { useAuth } from '@/context/AuthContext';
import { Download, Copy, CheckCircle, Terminal as TerminalIcon, Cpu, AlertCircle, Loader2 } from 'lucide-react';

interface TerminalProps {
  nexusUrl: string;
}

const Terminal: React.FC<TerminalProps> = ({ nexusUrl }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const { user } = useAuth();
  const [hubConnected, setHubConnected] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Socket Connection & Event Handling ---
  useEffect(() => {
    if (!user) return;

    let socket: Socket | null = null;

    const connect = async () => {
        try {
            let token = '';
            // @ts-ignore
            if (typeof user.getIdToken === 'function') {
                // @ts-ignore
                token = await user.getIdToken();
            } else {
                console.warn("User object has no getIdToken method (Custom/Mock User). Using fallback.");
                // Fallback for custom auth users (won't work with strict Firebase Verify, but stops crash)
                token = 'mock-token'; 
            }
            
            console.log('🔌 Connecting to Hub at:', nexusUrl);

                        socket = io(nexusUrl, {

                            auth: {

                                type: 'client',

                                token: token,

                                // @ts-ignore

                                uid: user.uid // Send UID explicitly for permissive auth fallback

                            },

                            transports: ['websocket'],

             // Force WebSocket to avoid CORS/Proxy polling issues
                reconnectionDelay: 1000,
                timeout: 10000,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('✅ Connected to Hub (Socket ID:', socket?.id, ')');
                setHubConnected(true);
            });

            socket.on('connect_error', (err) => {
                console.error('❌ Connection Error:', err.message);
                setHubConnected(false);
            });

            socket.on('disconnect', () => {
                console.log('❌ Disconnected from Hub');
                setHubConnected(false);
                setWorkerStatus('checking');
            });

            // Hub Protocol: Receives worker status for THIS user
            socket.on('worker-status', (data: { status: 'online' | 'offline' }) => {
                console.log('🤖 Worker Status:', data.status);
                setWorkerStatus(data.status);
            });

            socket.on('session-created', (data: { id: string }) => {
                console.log('🚀 Session Created:', data.id);
                setActiveSession(data.id);
                // The terminal component will handle the attach now
            });
            
            socket.on('error', (err) => {
                console.error('Hub Error:', err);
            });

        } catch (e) {
            console.error("Auth Token Error:", e);
        }
    };

    connect();

    return () => {
        if (socket) socket.disconnect();
    };
  }, [nexusUrl, user]);


  // --- Terminal Initialization & Input Handling ---
  useEffect(() => {
    if (!activeSession || !terminalRef.current || !socketRef.current) return;
    
    // Only init if not already done
    if (xtermRef.current) {
        xtermRef.current.clear();
        return; 
    }

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#09090b', // Zinc-950
        foreground: '#f4f4f5', // Zinc-100
        cursor: '#22c55e',     // Green-500
        selectionBackground: '#3f3f46',
      },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    term.writeln('\x1b[32m✔ Connected to your Personal Assistant.\x1b[0m');
    term.writeln('Type commands to execute on your local machine.\r\n');

    const socket = socketRef.current;

    // Handle incoming data
    const handleOutput = (data: { sessionId: string; data: string }) => {
        if (data.sessionId === activeSession) {
             term.write(data.data);
        }
    };
    
    socket.on('output', handleOutput);

    // Handle outgoing data
    term.onData((data) => {
      socket.emit('execute', {
        sessionId: activeSession,
        command: data
      });
    });

    // Handle Resize
    const handleResize = () => {
        if (!fitAddonRef.current) return;
        fitAddonRef.current.fit();
        if (xtermRef.current) {
            const { cols, rows } = xtermRef.current;
            socket.emit('resize', { sessionId: activeSession, cols, rows });
        }
    };
    window.addEventListener('resize', handleResize);
    // Initial resize
    setTimeout(handleResize, 100);

    return () => {
        socket.off('output', handleOutput);
        window.removeEventListener('resize', handleResize);
        term.dispose();
        xtermRef.current = null;
    };
  }, [activeSession]);


  // --- Actions ---
  const startSession = () => {
      if (socketRef.current && hubConnected) {
          socketRef.current.emit('create-session');
      }
  };

  const copyToken = () => {
    if (user?.uid) {
        navigator.clipboard.writeText(user.uid);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };


  // --- Render: Onboarding View ---
  if (!user) return <div className="p-8 text-center text-gray-400">Please log in.</div>;

  if (workerStatus === 'offline' || workerStatus === 'checking') {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-black text-slate-200">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-950">
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <Cpu className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Connect your Local Agent</h2>
                        <p className="text-sm text-slate-400">To use the terminal and file sync, you need to run the agent on your Linux machine.</p>
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
                            <p className="text-sm text-slate-400">Download the <code>.deb</code> package for Ubuntu/Debian.</p>
                            <a 
                                href="/downloads/edu-agent_1.0.0_amd64.deb" 
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"
                            >
                                <Download className="w-4 h-4" /> Download .deb
                            </a>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">2</div>
                        <div className="space-y-3 flex-1">
                            <h3 className="font-semibold text-white">Setup & Run</h3>
                            <div className="bg-black rounded-lg border border-slate-800 p-4 font-mono text-sm text-slate-300">
                                <p><span className="text-blue-400">$</span> sudo dpkg -i edu-agent_1.0.0_amd64.deb</p>
                                <p><span className="text-blue-400">$</span> edu-agent setup</p>
                                <p><span className="text-blue-400">$</span> edu-agent start</p>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">3</div>
                        <div className="space-y-3 flex-1">
                            <h3 className="font-semibold text-white">Your Worker Token</h3>
                            <p className="text-sm text-slate-400">When prompted during setup, paste this token:</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-black border border-slate-800 rounded px-3 py-2 font-mono text-green-400 text-sm truncate">
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
                
                {workerStatus === 'offline' && (
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

  // --- Render: Terminal View (Online) ---
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
            <div className="flex-1 relative p-1">
                <div ref={terminalRef} className="w-full h-full" />
            </div>
          )}
      </div>
  );
};

export default Terminal;
