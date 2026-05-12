import type { FitAddon as FitAddonType } from '@xterm/addon-fit';
import type { WebLinksAddon as WebLinksAddonType } from '@xterm/addon-web-links';
import type { ITerminalOptions, Terminal as XTermTerminal } from '@xterm/xterm';
import { io, Socket } from 'socket.io-client';
import { TerminalConnectionStatus, WorkerStatusValue, type TerminalConnectionStatusId, type TerminalSessionCreationPayload, type TerminalSessionPayload, type WorkerStatus } from '@/types/terminal';
import type { WorkspaceTypeId } from '@/types/workspace';

type SocketStatus = TerminalConnectionStatusId | 'hub-online' | 'hub-offline';

type XTermModules = {
  Terminal: new (options?: ITerminalOptions) => XTermTerminal;
  FitAddon: new () => FitAddonType;
  WebLinksAddon: new () => WebLinksAddonType;
};

let xtermModulesPromise: Promise<XTermModules> | null = null;

function loadXTermModules(): Promise<XTermModules> {
  if (xtermModulesPromise) return xtermModulesPromise;
  xtermModulesPromise = Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-web-links')
  ]).then(([xterm, fitMod, linksMod]) => ({
    Terminal: xterm.Terminal,
    FitAddon: fitMod.FitAddon,
    WebLinksAddon: linksMod.WebLinksAddon
  })).catch((err) => {
    xtermModulesPromise = null;
    throw err;
  });
  return xtermModulesPromise;
}

export interface TerminalInstance {
  term: XTermTerminal;
  fitAddon: FitAddonType;
  container: HTMLElement | null;
  resizeObserver: ResizeObserver | null;
  fitTimeout: ReturnType<typeof setTimeout> | null;
  fitRaf: number | null;
  lastFitAt: number;
  mounted: boolean;
}

export interface WorkspaceWorkerStatus {
  workspaceId: string;
  status: WorkerStatus;
}

export interface DocChangeEvent {
  workspaceId: string;
  docId: string;
  action: 'created' | 'updated' | 'deleted';
  data?: { name?: string; parentId?: string | null };
}

export interface WorkspaceSession {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  workspaceType?: WorkspaceTypeId;
  ownerUid?: string;
  sessionName?: string;
}

export class TerminalController {
  private terminals: Map<string, TerminalInstance> = new Map();
  private sessionOwnership: Map<string, boolean> = new Map();
  public socket: Socket | null = null;
  private nexusUrl: string;
  private initialized = false;
  private xtermModules: XTermModules | null = null;
  private activeSessionId: string | null = null;
  private debugEnabled = process.env.NODE_ENV !== 'production';

  private workspaceStatuses: Map<string, WorkerStatus> = new Map();
  private subscribedWorkspaces: Set<string> = new Set();
  private onWorkerStatusChange?: (status: WorkspaceWorkerStatus) => void;
  private onDocChange?: (event: DocChangeEvent) => void;
  private onWorkspaceSessionsChange?: (data: { workspaceId: string; sessions: WorkspaceSession[] }) => void;
  private onRestoreFailed?: (payload: { sessionId: string; reason: string }) => void;
  private onSessionJoined?: (payload: TerminalSessionPayload) => void;
  private onSessionRenamed?: (payload: { sessionId: string; sessionName: string }) => void;

  public get term(): XTermTerminal | null {
    if (this.activeSessionId) {
      return this.terminals.get(this.activeSessionId)?.term ?? null;
    }
    return null;
  }

  constructor(nexusUrl: string) {
    this.nexusUrl = nexusUrl;
  }

  private debugLog(...args: unknown[]) {
    if (this.debugEnabled) {
      console.warn(...args);
    }
  }

  public async initialize(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.initialized) return true;

    const startTime = performance.now();
    this.debugLog('[TerminalController] Starting initialization...');

    try {
      this.xtermModules = await loadXTermModules();
      this.initialized = true;
      this.debugLog(`[TerminalController] Total initialization: ${(performance.now() - startTime).toFixed(0)}ms`);
      return true;
    } catch (err) {
      console.error('[TerminalController] Failed to load xterm:', err);
      return false;
    }
  }

  private createTerminalInstance(sessionId: string): TerminalInstance {
    if (!this.xtermModules) {
      throw new Error('xterm globals not initialized');
    }
    const { Terminal, FitAddon, WebLinksAddon } = this.xtermModules;

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

    term.onData((data: string) => {
      if (this.socket?.connected) {
        this.socket.emit('execute', {
          sessionId,
          command: data
        });
      }
    });

    const instance: TerminalInstance = {
      term,
      fitAddon,
      container: null,
      resizeObserver: null,
      fitTimeout: null,
      fitRaf: null,
      lastFitAt: 0,
      mounted: false
    };

    this.terminals.set(sessionId, instance);
    return instance;
  }

  public getTerminalInstance(sessionId: string): TerminalInstance | null {
    if (!this.initialized) return null;

    let instance = this.terminals.get(sessionId);
    if (!instance) {
      instance = this.createTerminalInstance(sessionId);
    }
    return instance;
  }

  public mountSession(sessionId: string, container: HTMLElement): boolean {
    const instance = this.getTerminalInstance(sessionId);
    if (!instance) return false;

    const { term, fitAddon } = instance;
    const termElement = term.element as HTMLElement | undefined;
    const isAttached = termElement ? container.contains(termElement) : false;

    if (instance.mounted && instance.container === container && isAttached) {
      this.fitSession(sessionId);
      return true;
    }

    instance.container = container;

    if (instance.mounted) {
      if (termElement && !isAttached) {
        container.appendChild(termElement);
      }
    } else {
      term.open(container);
      instance.mounted = true;
    }

    // Mejora: Intentar ajustar dimensiones y refrescar inmediatamente
    // Esto ayuda a evitar artefactos visuales cuando se restaura una sesión con historial
    requestAnimationFrame(() => {
        try {
            fitAddon.fit();
            term.refresh(0, term.rows - 1);
        } catch (_e) {
            // Ignorar errores de fit si el contenedor aún no está listo
        }
    });

    setTimeout(() => {
      try {
        fitAddon.fit();
        term.focus();
        term.refresh(0, term.rows - 1);
      } catch (e) {
        console.warn('[TerminalController] Error finalizing mount:', e);
      }
    }, 100);

    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect();
    }
    instance.resizeObserver = new ResizeObserver(() => {
      this.scheduleFitSession(sessionId);
    });
    instance.resizeObserver.observe(container);

    return true;
  }

  public setWorkspaceSessionsHandler(handler: (data: { workspaceId: string; sessions: WorkspaceSession[] }) => void) {
    this.onWorkspaceSessionsChange = handler;
  }

  public setRestoreFailedHandler(handler: (payload: { sessionId: string; reason: string }) => void) {
    this.onRestoreFailed = handler;
  }

  public setSessionJoinedHandler(handler: (payload: TerminalSessionPayload) => void) {
    this.onSessionJoined = handler;
  }

  public connect(
    token: string,
    uid: string,
    sessionId: string | null,
    onStatusChange?: (status: SocketStatus) => void,
    onSessionEnded?: (payload: { sessionId: string; reason?: string }) => void,
    onWorkerStatusChange?: (status: WorkspaceWorkerStatus) => void,
    onDocChange?: (event: DocChangeEvent) => void,
    onSessionCreated?: (payload: TerminalSessionCreationPayload) => void
  ) {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.onWorkerStatusChange = onWorkerStatusChange;
    this.onDocChange = onDocChange;

    const connectStart = performance.now();
    this.debugLog('[TerminalController] Starting socket connection to:', this.nexusUrl);

    this.socket = io(this.nexusUrl, {
      auth: { type: 'client', token, uid, sessionId },
      transports: ['websocket'],
      autoConnect: false,
      timeout: 10000,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      this.debugLog(`[TerminalController] Socket connected in ${(performance.now() - connectStart).toFixed(0)}ms`);
      onStatusChange?.('hub-online');
      this.subscribedWorkspaces.forEach(workspaceId => {
        this.socket?.emit('workspace:subscribe', { workspaceId });
      });
      // Re-join cada sesión que el cliente recuerda. Si una ya no existe
      // server-side, llegará `restore-failed → session-not-found` y el handler
      // la limpia. Esto evita las terminales residuales sin output tras un
      // reconnect: o bien se reanudan, o bien se borran solas.
      this.terminals.forEach((instance, sessionId) => {
        instance.term?.writeln('\r\n\x1b[33mReconectando…\x1b[0m');
        this.socket?.emit('restore-session', { sessionId });
      });
    });

    this.socket.on('disconnect', () => {
      this.terminals.forEach((instance) => {
        instance.term?.writeln('\r\n\x1b[31mHub disconnected\x1b[0m');
      });
      onStatusChange?.('hub-offline');
    });

    this.socket.on('connect_error', (err) => {
      this.debugLog('[TerminalController] Connection error:', err.message);
      onStatusChange?.(TerminalConnectionStatus.Error);
    });

    this.socket.on('worker-status', (data: { status: WorkerStatus; workspaceId?: string }) => {
      const workspaceId = data.workspaceId;
      const status = data.status;
      this.debugLog(`[TerminalController] Received worker-status: ${status} for workspace: ${workspaceId}`);

      if (workspaceId) {
        this.workspaceStatuses.set(workspaceId, status);
        this.onWorkerStatusChange?.({ workspaceId, status });
      } else if (status === WorkerStatusValue.Online || status === WorkerStatusValue.Offline) {
        onStatusChange?.(status);
      }
    });

    this.socket.on('session-created', (data: TerminalSessionCreationPayload) => {
      this.activeSessionId = data.id;
      this.sessionOwnership.set(data.id, true);
      const instance = this.getTerminalInstance(data.id);
      if (instance) {
        instance.term.clear();
        instance.term.writeln('\x1b[32mSesion iniciada\x1b[0m');
      }
      onSessionCreated?.(data);
    });

    this.socket.on('session-ended', (payload: { sessionId: string; reason?: string }) => {
      const instance = this.terminals.get(payload.sessionId);
      if (instance) {
        const message = payload.reason ? `Sesion terminada: ${payload.reason}` : 'Sesion terminada';
        instance.term?.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      }
      onSessionEnded?.(payload);
    });

    this.socket.on('workspace-sessions', (data: { workspaceId: string; sessions: WorkspaceSession[] }) => {
      this.onWorkspaceSessionsChange?.(data);
    });

    this.socket.on('output', (data: { sessionId: string; data: string }) => {
      const instance = this.terminals.get(data.sessionId);
      if (instance && data.data) {
        instance.term?.write(data.data);
      }
    });

    this.socket.on('error', (data: { message: string; workspaceId?: string }) => {
      console.warn('[TerminalController] Error:', data.message);
    });

    this.socket.on('doc-change', (event: DocChangeEvent) => {
      this.debugLog(`[TerminalController] doc-change: ${event.action} ${event.docId} in ${event.workspaceId}`);
      this.onDocChange?.(event);
    });

    this.socket.on('restore-failed', (payload: { sessionId: string; reason: string }) => {
      console.warn(`[TerminalController] restore-failed for session ${payload.sessionId}: ${payload.reason}`);
      this.onRestoreFailed?.(payload);
    });

    this.socket.on('session-joined', (payload: TerminalSessionPayload) => {
      this.debugLog(`[TerminalController] session-joined: ${payload.id} (owner: ${payload.isOwner})`);
      this.sessionOwnership.set(payload.id, payload.isOwner);
      const instance = this.getTerminalInstance(payload.id);
      if (instance && !payload.isOwner) {
        instance.term.writeln('\x1b[36mConectado a sesión compartida\x1b[0m');
      }
      this.onSessionJoined?.(payload);
    });

    this.socket.on('join-session-failed', (payload: { sessionId: string; reason: string }) => {
      console.warn(`[TerminalController] join-session-failed: ${payload.sessionId} - ${payload.reason}`);
    });

    this.socket.on('session-renamed', (payload: { sessionId: string; sessionName: string }) => {
      this.debugLog(`[TerminalController] session-renamed: ${payload.sessionId} -> "${payload.sessionName}"`);
      this.onSessionRenamed?.(payload);
    });

    this.socket.connect();
  }

  public subscribeToWorkspace(workspaceId: string) {
    this.subscribedWorkspaces.add(workspaceId);
    if (this.socket?.connected) {
      this.socket.emit('workspace:subscribe', { workspaceId });
    }
  }

  public unsubscribeFromWorkspace(workspaceId: string) {
    this.subscribedWorkspaces.delete(workspaceId);
    if (this.socket?.connected) {
      this.socket.emit('workspace:unsubscribe', { workspaceId });
    }
  }

  public getWorkerStatus(workspaceId: string): WorkerStatus {
    return this.workspaceStatuses.get(workspaceId) || 'unknown';
  }

  public checkWorkerStatus(workspaceId: string) {
    if (this.socket?.connected) {
      this.socket.emit('workspace:check-worker', { workspaceId });
    }
  }

  public restoreSession(sessionId: string) {
    if (this.socket?.connected) {
      this.socket.emit('restore-session', { sessionId });
    }
  }

  public joinSession(sessionId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join-session', { sessionId });
    }
  }

  public startSession(payload?: { workspaceId?: string; workspaceName?: string; workspaceType?: WorkspaceTypeId }) {
    if (this.socket?.connected) {
      this.socket.emit('create-session', payload);
    }
  }

  public setActiveSession(sessionId: string) {
    this.activeSessionId = sessionId;
  }

  public killSession(sessionId: string) {
    if (this.socket?.connected) {
      this.socket.emit('kill-session', { sessionId });
    }

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.disposeSession(sessionId);
  }

  public renameSession(sessionId: string, sessionName: string) {
    if (this.socket?.connected) {
      this.socket.emit('rename-session', { sessionId, sessionName });
    }
  }

  public setSessionRenamedHandler(handler: (payload: { sessionId: string; sessionName: string }) => void) {
    this.onSessionRenamed = handler;
  }

  public disposeSession(sessionId: string) {
    const instance = this.terminals.get(sessionId);
    if (instance) {
      if (instance.fitTimeout) clearTimeout(instance.fitTimeout);
      if (instance.fitRaf !== null) cancelAnimationFrame(instance.fitRaf);
      instance.resizeObserver?.disconnect();
      instance.term?.dispose();
      this.terminals.delete(sessionId);
    }
    this.sessionOwnership.delete(sessionId);
  }

  public focusSession(sessionId: string) {
    const instance = this.terminals.get(sessionId);
    instance?.term?.focus();
  }

  public scheduleFitSession(sessionId: string) {
    const instance = this.terminals.get(sessionId);
    if (!instance) return;

    const now = Date.now();
    if (now - instance.lastFitAt < 100) return;

    if (instance.fitTimeout) clearTimeout(instance.fitTimeout);
    if (instance.fitRaf !== null) cancelAnimationFrame(instance.fitRaf);

    instance.fitTimeout = setTimeout(() => {
      instance.fitRaf = requestAnimationFrame(() => {
        instance.lastFitAt = Date.now();
        this.fitSession(sessionId);
        instance.fitRaf = null;
      });
      instance.fitTimeout = null;
    }, 50);
  }

  public fitSession(sessionId: string) {
    const instance = this.terminals.get(sessionId);
    if (!instance) return;

    try {
      instance.fitAddon.fit();
      const { cols, rows } = instance.term;
      // Forzar repintado para corregir artefactos
      instance.term.refresh(0, rows - 1);

      // tmux-like: solo el owner redimensiona el PTY del worker
      // Los viewers tienen su propio grid local via xterm.js
      const isOwner = this.sessionOwnership.get(sessionId) ?? true;
      if (isOwner && this.socket?.connected && cols > 0 && rows > 0) {
        this.socket.emit('resize', { sessionId, cols, rows });
      }
    } catch (_e) {
    }
  }

  public isSessionOwner(sessionId: string): boolean {
    return this.sessionOwnership.get(sessionId) ?? true;
  }

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
      if (instance.fitTimeout) clearTimeout(instance.fitTimeout);
      if (instance.fitRaf !== null) cancelAnimationFrame(instance.fitRaf);
      instance.resizeObserver?.disconnect();
      instance.term?.dispose();
    });
    this.terminals.clear();
    this.sessionOwnership.clear();
    this.subscribedWorkspaces.clear();
    this.workspaceStatuses.clear();
    this.socket?.disconnect();
    this.socket = null;
    this.activeSessionId = null;
  }
}
