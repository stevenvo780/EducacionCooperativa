import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io, Socket } from 'socket.io-client';

export class TerminalController {
  public term: Terminal;
  public socket: Socket | null = null;
  private fitAddon: FitAddon;
  private container: HTMLElement | null = null;
  private activeSessionId: string | null = null;
  private nexusUrl: string;
  private resizeObserver: ResizeObserver | null = null;

  constructor(nexusUrl: string) {
    this.nexusUrl = nexusUrl;
    
    // Safety check for SSR
    if (typeof window === 'undefined') {
        this.term = {} as any;
        this.fitAddon = {} as any;
        return;
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
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(new WebLinksAddon());

    // Input handler
    this.term.onData((data) => {
      if (this.socket?.connected && this.activeSessionId) {
        this.socket.emit('execute', {
          sessionId: this.activeSessionId,
          command: data,
        });
      }
    });
  }

  public mount(container: HTMLElement) {
    this.container = container;
    this.term.open(container);
    this.fitAddon.fit();
    this.term.focus(); // Force focus immediately

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
        
        // Specific check for Mixed Content (HTTPS -> HTTP)
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && this.nexusUrl.startsWith('http:')) {
             console.error('[Terminal] SECURITY BLOCK: Attempting to connect to insecure HTTP Hub from HTTPS origin. Browsers block this.');
        }

        onStatusChange?.('error');
    });

    this.socket.on('worker-status', (data: { status: string }) => {
        onStatusChange?.(data.status);
    });

    this.socket.on('session-created', (data: { id: string }) => {
        this.activeSessionId = data.id;
        this.term.clear();
        this.term.writeln('\x1b[32m✔ Sesion iniciada\x1b[0m');
        this.fit(); // Sync size immediately
    });

    this.socket.on('session-ended', (payload: { sessionId: string; reason?: string }) => {
        if (payload.sessionId === this.activeSessionId) {
            this.clearSession(payload.reason);
        }
        onSessionEnded?.(payload);
    });

    this.socket.on('output', (data: { sessionId: string; data: string }) => {
        if (data.sessionId === this.activeSessionId && data.data) {
            this.term.write(data.data);
        }
    });
  }

  public startSession() {
      if (this.socket?.connected) {
          this.socket.emit('create-session');
      }
  }

  public fit() {
    if (!this.activeSessionId || !this.socket?.connected) return;
    try {
        this.fitAddon.fit();
        const { cols, rows } = this.term;
        this.socket.emit('resize', {
            sessionId: this.activeSessionId,
            cols,
            rows
        });
    } catch (e) {
        // Ignore fit errors if container is hidden
    }
  }

  public clearSession(reason?: string) {
    if (!this.activeSessionId) return;
    this.activeSessionId = null;
    try {
        const message = reason ? `Sesion terminada: ${reason}` : 'Sesion terminada';
        this.term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
    } catch (e) {
        // Ignore terminal write errors on teardown
    }
  }

  public destroy() {
    this.resizeObserver?.disconnect();
    this.socket?.disconnect();
    this.socket = null;
    this.activeSessionId = null;
    this.term.dispose();
  }
}
