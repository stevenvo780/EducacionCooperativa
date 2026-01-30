import { io, Socket } from 'socket.io-client';

// Global types for CDN-loaded xterm
declare global {
  interface Window {
    Terminal: any;
    FitAddon: any;
    WebLinksAddon: any;
  }
}

export class TerminalController {
  public term: any = null;
  public socket: Socket | null = null;
  private fitAddon: any = null;
  private container: HTMLElement | null = null;
  private activeSessionId: string | null = null;
  private nexusUrl: string;
  private resizeObserver: ResizeObserver | null = null;
  private initialized = false;

  constructor(nexusUrl: string) {
    this.nexusUrl = nexusUrl;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  private loadCSS(href: string): void {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  public async initialize(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.initialized) return true;

    try {
      // Load xterm from CDN (avoids bundler issues)
      this.loadCSS('https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css');

      await this.loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js');

      // Wait a tick for globals to be available
      await new Promise(r => setTimeout(r, 50));

      const Terminal = window.Terminal;
      const FitAddon = window.FitAddon?.FitAddon;
      const WebLinksAddon = window.WebLinksAddon?.WebLinksAddon;

      if (!Terminal || !FitAddon) {
        throw new Error('xterm globals not found');
      }

      this.term = new Terminal({
        cursorBlink: true,
        theme: {
          background: '#09090b',
          foreground: '#f4f4f5',
          cursor: '#22c55e',
          selectionBackground: '#3f3f46'
        },
        fontFamily: 'monospace',
        fontSize: 14
      });

      this.fitAddon = new FitAddon();
      this.term.loadAddon(this.fitAddon);

      if (WebLinksAddon) {
        this.term.loadAddon(new WebLinksAddon());
      }

      // Input handler
      this.term.onData((data: string) => {
        // console.log('[TerminalController] Input captured:', JSON.stringify(data), 'ActiveSession:', this.activeSessionId);
        if (this.socket?.connected && this.activeSessionId) {
          this.socket.emit('execute', {
            sessionId: this.activeSessionId,
            command: data
          });
        } else {
             console.warn('[TerminalController] Cannot send input: Socket not connected or no active session', {
                 socket: this.socket?.connected,
                 activeSessionId: this.activeSessionId
             });
        }
      });

      this.initialized = true;
      return true;
    } catch (err) {
      console.error('[TerminalController] Failed to load xterm:', err);
      return false;
    }
  }

  private mounted = false;

  public mount(container: HTMLElement) {
    if (!this.term || !this.fitAddon) return;
    
    // Prevent double mount
    if (this.mounted && this.container === container) {
      this.fit();
      return;
    }

    this.container = container;
    
    // Only open if not already opened
    if (!this.mounted) {
      this.term.open(container);
      this.mounted = true;
    }
    
    // Delay fit to allow DOM to settle
    setTimeout(() => {
      this.fitAddon.fit();
      this.term.focus();
    }, 100);

    // Setup resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this.fit());
    });
    this.resizeObserver.observe(container);
  }

  public connect(
    token: string,
    uid: string,
    onStatusChange?: (status: string) => void,
    onSessionEnded?: (payload: { sessionId: string; reason?: string }) => void
  ) {
    if (this.socket) this.socket.disconnect();

    this.socket = io(this.nexusUrl, {
      auth: { type: 'client', token, uid },
      transports: ['websocket'],
      autoConnect: false // Don't connect automatically - wait for listeners
    });

    // Register listeners BEFORE connecting
    this.socket.on('connect', () => {
      onStatusChange?.('hub-online');
    });

    this.socket.on('disconnect', () => {
      this.clearSession('Hub disconnected');
      onStatusChange?.('hub-offline');
    });

    this.socket.on('connect_error', (err: any) => {
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && this.nexusUrl.startsWith('http:')) {
        // Mixed content warning - nothing to log
      }
      onStatusChange?.('error');
    });

    this.socket.on('worker-status', (data: { status: string; workspaceId?: string }) => {
      onStatusChange?.(data.status);
    });

    this.socket.on('session-created', (data: { id: string }) => {
      this.activeSessionId = data.id;
      this.term?.clear();
      this.term?.writeln('\x1b[32m✔ Sesion iniciada\x1b[0m');
      this.fit();
    });

    this.socket.on('session-ended', (payload: { sessionId: string; reason?: string }) => {
      if (payload.sessionId === this.activeSessionId) {
        this.clearSession(payload.reason);
      }
      onSessionEnded?.(payload);
    });

    this.socket.on('output', (data: { sessionId: string; data: string }) => {
      if (data.sessionId === this.activeSessionId && data.data) {
        this.term?.write(data.data);
      }
    });

    // Now connect after all listeners are registered
    this.socket.connect();
  }

  public startSession(payload?: { workspaceId?: string; workspaceName?: string; workspaceType?: string }) {
    if (this.socket?.connected) {
      this.socket.emit('create-session', payload);
    }
  }

  public setActiveSession(sessionId: string) {
    this.activeSessionId = sessionId;
    // For V1: Reset terminal on switch to avoid mixing output.
    // In a real production app, we would cache the buffer or request 'replay' from Hub.
    this.term?.reset();
    this.term?.writeln(`\x1b[33mSwitched to session ${sessionId}\x1b[0m`);
    this.fit();
  }

  public killSession(sessionId: string) {
      if (this.socket?.connected) {
          this.socket.emit('kill-session', { sessionId });
      }
      if (this.activeSessionId === sessionId) {
          this.activeSessionId = null;
          this.term?.writeln('\x1b[31mSession ended\x1b[0m');
      }
  }

  public focus() {
    this.term?.focus();
  }

  public fit() {
    if (!this.term || !this.fitAddon) return;
    try {
      this.fitAddon.fit();
      const { cols, rows } = this.term;
      // Only send resize if we have an active session
      if (this.activeSessionId && this.socket?.connected && cols > 0 && rows > 0) {
        this.socket.emit('resize', {
          sessionId: this.activeSessionId,
          cols,
          rows
        });
      }
    } catch (e) {
      // Ignore fit errors
    }
  }

  public clearSession(reason?: string) {
    if (!this.activeSessionId) return;
    this.activeSessionId = null;
    try {
      const message = reason ? `Sesion terminada: ${reason}` : 'Sesion terminada';
      this.term?.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
    } catch (e) {
      // Ignore
    }
  }

  public destroy() {
    this.resizeObserver?.disconnect();
    this.socket?.disconnect();
    this.socket = null;
    this.activeSessionId = null;
    this.term?.dispose();
  }
}
