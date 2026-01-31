import { io, Socket } from 'socket.io-client';

// Global types for CDN-loaded xterm
declare global {
  interface Window {
    Terminal: any;
    FitAddon: any;
    WebLinksAddon: any;
  }
}

// Represents a single terminal session with its own xterm instance
export interface TerminalInstance {
  term: any;
  fitAddon: any;
  container: HTMLElement | null;
  resizeObserver: ResizeObserver | null;
  mounted: boolean;
}

export class TerminalController {
  // Map of sessionId -> TerminalInstance (each session has its own xterm)
  private terminals: Map<string, TerminalInstance> = new Map();
  public socket: Socket | null = null;
  private nexusUrl: string;
  private initialized = false;
  private activeSessionId: string | null = null;

  // Keep a reference to the old single-terminal API for backwards compat
  public get term(): any {
    if (this.activeSessionId) {
      return this.terminals.get(this.activeSessionId)?.term ?? null;
    }
    return null;
  }

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

      if (!window.Terminal || !window.FitAddon?.FitAddon) {
        throw new Error('xterm globals not found');
      }

      this.initialized = true;
      return true;
    } catch (err) {
      console.error('[TerminalController] Failed to load xterm:', err);
      return false;
    }
  }

  // Create a new xterm instance for a session
  private createTerminalInstance(sessionId: string): TerminalInstance {
    const Terminal = window.Terminal;
    const FitAddon = window.FitAddon.FitAddon;
    const WebLinksAddon = window.WebLinksAddon?.WebLinksAddon;

    const term = new Terminal({
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

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (WebLinksAddon) {
      term.loadAddon(new WebLinksAddon());
    }

    // Input handler - sends data to THIS session
    term.onData((data: string) => {
      if (this.socket?.connected) {
        this.socket.emit('execute', {
          sessionId: sessionId,
          command: data
        });
      }
    });

    const instance: TerminalInstance = {
      term,
      fitAddon,
      container: null,
      resizeObserver: null,
      mounted: false
    };

    this.terminals.set(sessionId, instance);
    return instance;
  }

  // Get or create a terminal instance for a session
  public getTerminalInstance(sessionId: string): TerminalInstance | null {
    if (!this.initialized) return null;

    let instance = this.terminals.get(sessionId);
    if (!instance) {
      instance = this.createTerminalInstance(sessionId);
    }
    return instance;
  }

  // Mount a specific session's terminal to a container
  public mountSession(sessionId: string, container: HTMLElement): boolean {
    const instance = this.getTerminalInstance(sessionId);
    if (!instance) return false;

    const { term, fitAddon } = instance;
    const termElement = term.element as HTMLElement | undefined;
    const isAttached = termElement ? container.contains(termElement) : false;

    // Prevent double mount
    if (instance.mounted && instance.container === container && isAttached) {
      this.fitSession(sessionId);
      return true;
    }

    instance.container = container;

    if (instance.mounted) {
      // Re-parent existing terminal element
      if (termElement && !isAttached) {
        container.appendChild(termElement);
      }
    } else {
      term.open(container);
      instance.mounted = true;
    }

    // Delay fit to allow DOM to settle
    setTimeout(() => {
      fitAddon.fit();
      term.focus();
    }, 100);

    // Setup resize observer
    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect();
    }
    instance.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this.fitSession(sessionId));
    });
    instance.resizeObserver.observe(container);

    return true;
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
      autoConnect: false
    });

    this.socket.on('connect', () => {
      onStatusChange?.('hub-online');
    });

    this.socket.on('disconnect', () => {
      this.terminals.forEach((instance) => {
        instance.term?.writeln('\r\n\x1b[31mHub disconnected\x1b[0m');
      });
      onStatusChange?.('hub-offline');
    });

    this.socket.on('connect_error', () => {
      onStatusChange?.('error');
    });

    this.socket.on('worker-status', (data: { status: string }) => {
      onStatusChange?.(data.status);
    });

    this.socket.on('session-created', (data: { id: string }) => {
      this.activeSessionId = data.id;
      // Create terminal instance for new session
      const instance = this.getTerminalInstance(data.id);
      if (instance) {
        instance.term.clear();
        instance.term.writeln('\x1b[32m✔ Sesion iniciada\x1b[0m');
      }
    });

    this.socket.on('session-ended', (payload: { sessionId: string; reason?: string }) => {
      const instance = this.terminals.get(payload.sessionId);
      if (instance) {
        const message = payload.reason ? `Sesion terminada: ${payload.reason}` : 'Sesion terminada';
        instance.term?.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      }
      onSessionEnded?.(payload);
    });

    // Route output to the correct terminal instance
    this.socket.on('output', (data: { sessionId: string; data: string }) => {
      const instance = this.terminals.get(data.sessionId);
      if (instance && data.data) {
        instance.term?.write(data.data);
      }
    });

    this.socket.connect();
  }

  public startSession(payload?: { workspaceId?: string; workspaceName?: string; workspaceType?: string }) {
    if (this.socket?.connected) {
      this.socket.emit('create-session', payload);
    }
  }

  // Set active session (for backwards compatibility - tracks "focused" session)
  public setActiveSession(sessionId: string) {
    this.activeSessionId = sessionId;
  }

  public killSession(sessionId: string) {
    if (this.socket?.connected) {
      this.socket.emit('kill-session', { sessionId });
    }

    // Clean up the terminal instance
    const instance = this.terminals.get(sessionId);
    if (instance) {
      instance.term?.writeln('\x1b[31mSession ended\x1b[0m');
      instance.resizeObserver?.disconnect();
    }

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  // Dispose a terminal instance (called when component unmounts)
  public disposeSession(sessionId: string) {
    const instance = this.terminals.get(sessionId);
    if (instance) {
      instance.resizeObserver?.disconnect();
      instance.term?.dispose();
      this.terminals.delete(sessionId);
    }
  }

  public focusSession(sessionId: string) {
    const instance = this.terminals.get(sessionId);
    instance?.term?.focus();
  }

  public fitSession(sessionId: string) {
    const instance = this.terminals.get(sessionId);
    if (!instance) return;

    try {
      instance.fitAddon.fit();
      const { cols, rows } = instance.term;
      if (this.socket?.connected && cols > 0 && rows > 0) {
        this.socket.emit('resize', { sessionId, cols, rows });
      }
    } catch (e) {
      // Ignore fit errors
    }
  }

  // Legacy API - mount the "active" session
  public mount(container: HTMLElement) {
    if (this.activeSessionId) {
      this.mountSession(this.activeSessionId, container);
    }
  }

  public focus() {
    if (this.activeSessionId) {
      this.focusSession(this.activeSessionId);
    }
  }

  public fit() {
    if (this.activeSessionId) {
      this.fitSession(this.activeSessionId);
    }
  }

  public clearSession(reason?: string) {
    if (!this.activeSessionId) return;
    const instance = this.terminals.get(this.activeSessionId);
    if (instance) {
      const message = reason ? `Sesion terminada: ${reason}` : 'Sesion terminada';
      instance.term?.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
    }
    this.activeSessionId = null;
  }

  public destroy() {
    this.terminals.forEach((instance) => {
      instance.resizeObserver?.disconnect();
      instance.term?.dispose();
    });
    this.terminals.clear();
    this.socket?.disconnect();
    this.socket = null;
    this.activeSessionId = null;
  }
}
// Build Sat Jan 31 08:59:20 -05 2026
