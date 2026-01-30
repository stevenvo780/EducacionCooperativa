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
          selectionBackground: '#3f3f46',
        },
        fontFamily: 'monospace',
        fontSize: 14,
      });

      this.fitAddon = new FitAddon();
      this.term.loadAddon(this.fitAddon);
      
      if (WebLinksAddon) {
        this.term.loadAddon(new WebLinksAddon());
      }

      // Input handler
      this.term.onData((data: string) => {
        if (this.socket?.connected && this.activeSessionId) {
          this.socket.emit('execute', {
            sessionId: this.activeSessionId,
            command: data,
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

  public mount(container: HTMLElement) {
    if (!this.term || !this.fitAddon) return;
    
    this.container = container;
    this.term.open(container);
    this.fitAddon.fit();
    this.term.focus();

    this.resizeObserver = new ResizeObserver(() => {
      this.fit();
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

    console.log('[Terminal] Connecting to', this.nexusUrl);
    
    this.socket = io(this.nexusUrl, {
      auth: { type: 'client', token, uid },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('[Terminal] Socket connected');
      onStatusChange?.('hub-online');
    });

    this.socket.on('disconnect', () => {
      console.log('[Terminal] Socket disconnected');
      this.clearSession('Hub disconnected');
      onStatusChange?.('hub-offline');
    });

    this.socket.on('connect_error', (err: any) => {
      console.error('[Terminal] Socket connect error detailed:', {
        message: err.message,
        stack: err.stack,
        url: this.nexusUrl,
        type: err.type,
        name: err.name
      });
      
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && this.nexusUrl.startsWith('http:')) {
        console.error('[Terminal] SECURITY BLOCK: Attempting to connect to insecure HTTP Hub from HTTPS origin.');
      }

      onStatusChange?.('error');
    });

    this.socket.on('worker-status', (data: { status: string }) => {
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
  }

  public startSession(payload?: { workspaceId?: string; workspaceName?: string; workspaceType?: string }) {
    if (this.socket?.connected) {
      this.socket.emit('create-session', payload);
    }
  }

  public fit() {
    if (!this.activeSessionId || !this.socket?.connected || !this.term || !this.fitAddon) return;
    try {
      this.fitAddon.fit();
      const { cols, rows } = this.term;
      this.socket.emit('resize', {
        sessionId: this.activeSessionId,
        cols,
        rows
      });
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
