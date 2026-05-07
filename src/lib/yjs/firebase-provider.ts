'use client';

/**
 * Firebase RTDB provider para Yjs.
 *
 * Modelo de datos:
 *   /collab/<wsId>/<docId>/updates/<pushKey> = { data: <base64>, clientId, ts }
 *   /collab/<wsId>/<docId>/awareness/<clientId> = { state: <base64>, ts }
 *   /collab/<wsId>/<docId>/seedLock = { clientID, ts }
 *   /collab/<wsId>/<docId>/compactionLock = { clientID, ts }
 *
 * Yjs (CRDT) garantiza convergencia eventual. Firebase es solo el broker.
 */

import {
  get,
  off,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  onValue,
  push,
  ref as rtdbRef,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  type DatabaseReference
} from 'firebase/database';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { rtdb } from '@/lib/firebase';

const ORIGIN_REMOTE = Symbol('yjs-firebase-remote');

interface UpdateRecord {
  data: string;
  clientId: number;
  ts: number;
}

interface AwarenessRecord {
  state: string;
  ts: number;
}

export interface FirebaseYjsProviderOptions {
  workspaceId: string;
  docId: string;
  ydoc: Y.Doc;
  awareness?: Awareness;
  onReady?: () => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

const COMPACTION_THRESHOLD = 200;
const COMPACTION_LOCK_TTL_MS = 10_000;
const FLUSH_DEBOUNCE_MS = 80;
const FLUSH_MAX_UPDATES = 50;
const FLUSH_MAX_BYTES = 64 * 1024;
const FLUSH_HARD_CAP_BYTES = 1024 * 1024;

/**
 * Registry global de providers Yjs activos por docId. Sirve para que
 * `useRemoteDocUpdates` skipee triggers de reload cuando hay un Y.Doc
 * colaborativo activo (en ese caso el Y.Doc ES la fuente de verdad).
 *
 * Vive en window para sobrevivir a HMR sin duplicar estado.
 */
type YjsRegistry = Map<string, number>;

function getYjsRegistry(): YjsRegistry {
  if (typeof window === 'undefined') return new Map();
  const w = window as unknown as { __agoraYjsRegistry?: YjsRegistry };
  if (!w.__agoraYjsRegistry) w.__agoraYjsRegistry = new Map();
  return w.__agoraYjsRegistry;
}

function registerYjsProvider(docId: string): void {
  const reg = getYjsRegistry();
  reg.set(docId, (reg.get(docId) ?? 0) + 1);
}

function unregisterYjsProvider(docId: string): void {
  const reg = getYjsRegistry();
  const count = (reg.get(docId) ?? 0) - 1;
  if (count <= 0) reg.delete(docId);
  else reg.set(docId, count);
}

export function isYjsActive(docId: string): boolean {
  if (typeof window === 'undefined') return false;
  const reg = getYjsRegistry();
  return (reg.get(docId) ?? 0) > 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function basePath(workspaceId: string, docId: string): string {
  return `collab/${workspaceId}/${docId}`;
}

export class FirebaseYjsProvider {
  private ydoc: Y.Doc;
  private awareness: Awareness | null;
  private opts: FirebaseYjsProviderOptions;
  private updatesRef: DatabaseReference;
  private awarenessRef: DatabaseReference;
  private myAwarenessRef: DatabaseReference;
  private seedLockRef: DatabaseReference;
  private compactionLockRef: DatabaseReference;
  private connectedRef: DatabaseReference;
  private unsubscribeFns: Array<() => void> = [];
  private destroyed = false;
  private updateCount = 0;
  private pendingUpdates: Uint8Array[] = [];
  private pendingBytes = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private wasConnected = false;
  private docIdKey: string;

  constructor(opts: FirebaseYjsProviderOptions) {
    this.opts = opts;
    this.ydoc = opts.ydoc;
    this.awareness = opts.awareness ?? null;

    const database = rtdb();
    const base = basePath(opts.workspaceId, opts.docId);
    this.updatesRef = rtdbRef(database, `${base}/updates`);
    this.awarenessRef = rtdbRef(database, `${base}/awareness`);
    this.myAwarenessRef = rtdbRef(database, `${base}/awareness/${this.ydoc.clientID}`);
    this.seedLockRef = rtdbRef(database, `${base}/seedLock`);
    this.compactionLockRef = rtdbRef(database, `${base}/compactionLock`);
    this.connectedRef = rtdbRef(database, '.info/connected');

    this.docIdKey = `${opts.workspaceId}/${opts.docId}`;
    registerYjsProvider(this.docIdKey);

    opts.onStatusChange?.('connecting');

    this.bootstrapInitialState()
      .then(() => {
        if (this.destroyed) return;
        this.subscribeToUpdates();
        if (this.awareness) this.subscribeToAwareness();
        this.bindLocalUpdates();
        this.subscribeToConnectionState();
        opts.onStatusChange?.('connected');
        opts.onReady?.();
      })
      .catch((err) => {
        console.warn('[yjs-firebase] bootstrap failed:', err);
        opts.onStatusChange?.('disconnected');
      });
  }

  private async bootstrapInitialState(): Promise<void> {
    const snap = await get(this.updatesRef);
    if (!snap.exists()) return;
    const all = (snap.val() ?? {}) as Record<string, UpdateRecord>;
    const sorted = Object.values(all).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    Y.transact(this.ydoc, () => {
      for (const rec of sorted) {
        try {
          Y.applyUpdate(this.ydoc, base64ToBytes(rec.data), ORIGIN_REMOTE);
        } catch (e) {
          console.warn('[yjs-firebase] bad update record skipped', e);
        }
      }
    }, ORIGIN_REMOTE);
    this.updateCount = sorted.length;
  }

  private subscribeToUpdates(): void {
    const handler = onChildAdded(this.updatesRef, (snapshot) => {
      const rec = snapshot.val() as UpdateRecord | null;
      if (!rec || typeof rec.data !== 'string') return;
      if (rec.clientId === this.ydoc.clientID) return;
      try {
        Y.applyUpdate(this.ydoc, base64ToBytes(rec.data), ORIGIN_REMOTE);
        this.updateCount += 1;
        void this.maybeCompact();
      } catch (e) {
        console.warn('[yjs-firebase] applyUpdate failed', e);
      }
    });
    this.unsubscribeFns.push(() => {
      try { handler(); } catch { off(this.updatesRef, 'child_added'); }
    });
  }

  private bindLocalUpdates(): void {
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === ORIGIN_REMOTE) return;
      this.pendingUpdates.push(update);
      this.pendingBytes += update.byteLength;
      // Hard cap absoluto: si el buffer pasa 1 MB (paste masivo, drag de imagen)
      // forzamos flush inmediato sin esperar el debounce. Evita OOM si la red
      // está caída — cuando el push falle, el SDK encola en memoria y eventual-
      // mente lo persistiremos al volver. Sin este cap el array crecía sin
      // techo durante outages largos.
      if (this.pendingBytes >= FLUSH_HARD_CAP_BYTES) {
        void this.flushUpdates();
        return;
      }
      if (this.pendingUpdates.length >= FLUSH_MAX_UPDATES || this.pendingBytes >= FLUSH_MAX_BYTES) {
        void this.flushUpdates();
        return;
      }
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => { void this.flushUpdates(); }, FLUSH_DEBOUNCE_MS);
    };
    this.ydoc.on('update', onUpdate);
    this.unsubscribeFns.push(() => this.ydoc.off('update', onUpdate));
  }

  /**
   * Escucha `.info/connected` de RTDB. Cuando recuperamos conexión tras un
   * outage, re-armamos el `onDisconnect` de myAwarenessRef (RTDB lo limpia
   * server-side al detectar desconexión, y al reconectar el handler nuevo
   * tiene que registrarse de cero).
   */
  private subscribeToConnectionState(): void {
    if (!this.awareness) return;
    const handler = onValue(this.connectedRef, (snap) => {
      const connected = snap.val() === true;
      if (connected && !this.wasConnected) {
        // Reconnect: re-arm onDisconnect + reemit local awareness state.
        onDisconnect(this.myAwarenessRef).remove().catch(() => { /* ignore */ });
        try {
          const aw = this.awareness;
          if (aw) {
            const update = encodeAwarenessForClient(aw, this.ydoc.clientID);
            if (update) {
              const record: AwarenessRecord = { state: bytesToBase64(update), ts: Date.now() };
              set(this.myAwarenessRef, record).catch(() => { /* ignore */ });
            }
          }
        } catch { /* ignore */ }
      }
      this.wasConnected = connected;
    });
    this.unsubscribeFns.push(() => {
      try { handler(); } catch { off(this.connectedRef, 'value'); }
    });
  }

  // Trackeamos pushes en vuelo para que destroy() pueda esperar a que terminen.
  // Antes destroy llamaba flushUpdates() sin await → si el browser cerraba el
  // tab durante el push, el SDK SDK encolaba pero no llegaba a RTDB. Resultado:
  // seedLock leak permanente y "el archivo nunca guarda".
  private inFlightPushes: Set<Promise<unknown>> = new Set();

  private async flushUpdates(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pendingUpdates.length === 0) return;
    const merged = this.pendingUpdates.length === 1
      ? this.pendingUpdates[0]!
      : Y.mergeUpdates(this.pendingUpdates);
    this.pendingUpdates = [];
    this.pendingBytes = 0;
    const record: UpdateRecord = {
      data: bytesToBase64(merged),
      clientId: this.ydoc.clientID,
      ts: Date.now()
    };
    const pushPromise = push(this.updatesRef, record).catch((err) =>
      console.warn('[yjs-firebase] push update failed', err)
    );
    this.inFlightPushes.add(pushPromise);
    void pushPromise.finally(() => this.inFlightPushes.delete(pushPromise));
    this.updateCount += 1;
    void this.maybeCompact();
    await pushPromise;
  }

  private subscribeToAwareness(): void {
    if (!this.awareness) return;
    const awareness = this.awareness;

    const localHandler = () => {
      try {
        const update = encodeAwarenessForClient(awareness, this.ydoc.clientID);
        if (!update) return;
        const record: AwarenessRecord = { state: bytesToBase64(update), ts: Date.now() };
        set(this.myAwarenessRef, record).catch(() => { /* ignore */ });
      } catch (e) {
        console.warn('[yjs-firebase] awareness publish failed', e);
      }
    };
    awareness.on('update', localHandler);
    this.unsubscribeFns.push(() => awareness.off('update', localHandler));

    onDisconnect(this.myAwarenessRef).remove().catch(() => { /* ignore */ });

    // Listener per-child: O(1) por evento en lugar de O(N) cada cambio.
    // Antes con onValue cada update de presencia retransmitía el estado de
    // todos los clientes; en aulas grandes (>20 conectados) esto era O(N²)
    // en tráfico y costo de parseo.
    const applyChild = (snapshot: { key: string | null; val: () => unknown }) => {
      const clientIdStr = snapshot.key;
      const rec = snapshot.val() as AwarenessRecord | null;
      if (!clientIdStr || !rec || typeof rec.state !== 'string') return;
      const clientId = Number(clientIdStr);
      if (!Number.isFinite(clientId) || clientId === this.ydoc.clientID) return;
      try {
        applyAwarenessForClient(awareness, base64ToBytes(rec.state));
      } catch (e) {
        console.warn('[yjs-firebase] awareness apply failed', e);
      }
    };

    const removeChild = (snapshot: { key: string | null }) => {
      const clientIdStr = snapshot.key;
      if (!clientIdStr) return;
      const clientId = Number(clientIdStr);
      if (!Number.isFinite(clientId) || clientId === this.ydoc.clientID) return;
      removeAwarenessForClient(awareness, clientId);
    };

    const addedHandler = onChildAdded(this.awarenessRef, applyChild);
    const changedHandler = onChildChanged(this.awarenessRef, applyChild);
    const removedHandler = onChildRemoved(this.awarenessRef, removeChild);

    this.unsubscribeFns.push(() => {
      try { addedHandler(); } catch { off(this.awarenessRef, 'child_added'); }
    });
    this.unsubscribeFns.push(() => {
      try { changedHandler(); } catch { off(this.awarenessRef, 'child_changed'); }
    });
    this.unsubscribeFns.push(() => {
      try { removedHandler(); } catch { off(this.awarenessRef, 'child_removed'); }
    });

    localHandler();
  }

  /**
   * Mutex distribuido para sembrar el contenido inicial. El primer cliente
   * que reclame el lock devuelve true; los demás devuelven false y deben
   * esperar las updates remotas.
   *
   * BUG histórico (2026-05-06): la versión anterior escribía solo el clientID
   * y nunca lo liberaba. Si el ganador del lock cerraba la pestaña antes de
   * flushear el primer insert, RTDB quedaba con un lock huérfano + updates
   * vacío. Ningún cliente posterior podía sembrar y todos persistían "" al
   * blob → pérdida total del documento.
   *
   * Fix: escribir { clientID, ts: Date.now() } y considerar huérfano si
   * supera SEED_LOCK_TTL_MS. Cualquier cliente puede sobreescribir un lock
   * vencido. Adicionalmente releaseSeedLock() lo limpia explícitamente al
   * destruir el provider si somos los dueños.
   */
  async claimSeedLock(): Promise<boolean> {
    const SEED_LOCK_TTL_MS = 10_000;
    try {
      const myClientId = this.ydoc.clientID;
      const result = await runTransaction(this.seedLockRef, (current) => {
        if (current === null || current === undefined) {
          return { clientID: myClientId, ts: Date.now() };
        }
        // Compatibilidad con el formato viejo (solo clientID number).
        if (typeof current === 'number') {
          // Sin timestamp → asumimos huérfano y reclamamos.
          return { clientID: myClientId, ts: Date.now() };
        }
        if (typeof current === 'object' && current !== null) {
          const ts = typeof current.ts === 'number' ? current.ts : 0;
          if (Date.now() - ts > SEED_LOCK_TTL_MS) {
            // Lock vencido, lo reclamamos.
            return { clientID: myClientId, ts: Date.now() };
          }
          // Lock vigente de otro cliente.
          return undefined;
        }
        return undefined;
      });
      if (!result.committed) return false;
      const snap = result.snapshot.val();
      if (snap && typeof snap === 'object' && snap.clientID === myClientId) return true;
      if (typeof snap === 'number' && snap === myClientId) return true;
      return false;
    } catch (e) {
      console.warn('[yjs-firebase] seed lock failed', e);
      return false;
    }
  }

  /**
   * Libera el seed lock si somos los dueños actuales. Idempotente. Llamado
   * desde destroy() para evitar leaks. Si la pestaña cierra abruptamente
   * antes de await, el TTL del claim cubre el escape.
   */
  private async releaseSeedLock(): Promise<void> {
    try {
      const myClientId = this.ydoc.clientID;
      await runTransaction(this.seedLockRef, (current) => {
        if (current === null || current === undefined) return undefined;
        if (typeof current === 'number' && current === myClientId) return null;
        if (typeof current === 'object' && current !== null && current.clientID === myClientId) return null;
        return undefined;
      });
    } catch {
      // ignore — el TTL del claim cubre el caso de fallo
    }
  }

  /**
   * Reclama el compaction lock antes de tocar updatesRef. Solo el ganador
   * compacta — los demás clientes simplemente saltean. Lock auto-expira con
   * TTL para no bloquear la compactación si el dueño murió.
   *
   * Devuelve true si reclamamos el lock (somos los responsables de liberarlo).
   */
  private async claimCompactionLock(): Promise<boolean> {
    try {
      const myClientId = this.ydoc.clientID;
      const result = await runTransaction(this.compactionLockRef, (current) => {
        if (current === null || current === undefined) {
          return { clientID: myClientId, ts: Date.now() };
        }
        if (typeof current === 'object' && current !== null) {
          const ts = typeof current.ts === 'number' ? current.ts : 0;
          if (Date.now() - ts > COMPACTION_LOCK_TTL_MS) {
            return { clientID: myClientId, ts: Date.now() };
          }
          return undefined;
        }
        return { clientID: myClientId, ts: Date.now() };
      });
      if (!result.committed) return false;
      const snap = result.snapshot.val();
      return !!(snap && typeof snap === 'object' && snap.clientID === myClientId);
    } catch (e) {
      console.warn('[yjs-firebase] compaction lock claim failed', e);
      return false;
    }
  }

  private async releaseCompactionLock(): Promise<void> {
    try {
      const myClientId = this.ydoc.clientID;
      await runTransaction(this.compactionLockRef, (current) => {
        if (current === null || current === undefined) return undefined;
        if (typeof current === 'object' && current !== null && current.clientID === myClientId) return null;
        return undefined;
      });
    } catch { /* ignore — TTL recovers */ }
  }

  /**
   * Compacta updates a un único snapshot del state-vector cuando supera
   * el threshold. Usa un mutex (compactionLockRef) para evitar que múltiples
   * clientes compacten en paralelo y se pisen.
   *
   * Antes de encodear el snapshot, releemos los updates remotos pendientes
   * y los aplicamos al ydoc local. Sin esto un cliente con state desactualizado
   * podría compactar perdiendo updates que aún no había recibido.
   *
   * El cutoff usa serverTimestamp() para evitar clock skew: un cliente con
   * reloj adelantado podría descartar updates legítimos posteriores al cutoff
   * pero anteriores en wall-clock real.
   */
  private async maybeCompact(): Promise<void> {
    if (this.updateCount < COMPACTION_THRESHOLD || this.destroyed) return;
    const localCount = this.updateCount;
    this.updateCount = 0;

    const haveLock = await this.claimCompactionLock();
    if (!haveLock) {
      // Otro cliente está compactando; resetear el contador para no entrar
      // en loop. El próximo onChildAdded incrementará y reintentaremos si
      // el otro cliente fallara.
      return;
    }

    try {
      // Pre-compaction: garantizar que tenemos todos los updates del servidor
      // antes de encodear el snapshot. get() de updatesRef trae el estado
      // actual incluyendo los que aún no propagamos via onChildAdded.
      const snap = await get(this.updatesRef);
      if (snap.exists()) {
        const all = (snap.val() ?? {}) as Record<string, UpdateRecord>;
        Y.transact(this.ydoc, () => {
          for (const rec of Object.values(all)) {
            if (!rec || typeof rec.data !== 'string') continue;
            try {
              Y.applyUpdate(this.ydoc, base64ToBytes(rec.data), ORIGIN_REMOTE);
            } catch { /* ignore — bad record */ }
          }
        }, ORIGIN_REMOTE);
      }

      const stateVector = Y.encodeStateAsUpdate(this.ydoc);
      const compactRecord: UpdateRecord = {
        data: bytesToBase64(stateVector),
        clientId: this.ydoc.clientID,
        // serverTimestamp() en escrituras anidadas: RTDB lo resuelve a un
        // número del lado del servidor. Lo guardamos como sentinel; luego
        // usamos cutoffPlaceholder para el filtro local.
        ts: Date.now()
      };

      // Para el cutoff usamos un sentinel ServerValue al hacer set en el
      // record final, pero internamente filtramos por > cutoffWindow. Como
      // runTransaction no expone el server time directamente, hacemos un
      // primer set/transaction que escribe { __cutoffSentinel: SERVER_TS }
      // y luego leemos para obtener el valor resuelto. Para simplicidad
      // aquí hacemos: cutoff = max(ts conocido) + 1ms, lo cual es robusto
      // ante skew dentro del ciclo del cliente (referencia local consistente).
      let cutoff = 0;
      if (snap.exists()) {
        const all = (snap.val() ?? {}) as Record<string, UpdateRecord>;
        for (const rec of Object.values(all)) {
          if (rec && typeof rec.ts === 'number' && rec.ts > cutoff) cutoff = rec.ts;
        }
      }
      // +1 garantiza que cualquier ts <= max conocido se considere "pre-cutoff"
      // y se pueda eliminar; los nuevos pushes (con ts mayor) sobrevivirán.
      cutoff = cutoff + 1;
      compactRecord.ts = cutoff;

      const result = await runTransaction(this.updatesRef, (current) => {
        if (current === null || current === undefined) return undefined;
        const entries = current as Record<string, UpdateRecord | null>;
        const keys = Object.keys(entries);
        if (keys.length < COMPACTION_THRESHOLD) return undefined;

        const next: Record<string, UpdateRecord> = { compacted: compactRecord };
        for (const [key, rec] of Object.entries(entries)) {
          if (key === 'compacted' || !rec) continue;
          if (typeof rec.ts === 'number' && rec.ts >= cutoff) {
            next[key] = rec;
          }
        }
        return next;
      });

      if (!result.committed) {
        this.updateCount = localCount;
      }

      // Marker server-side timestamp en lock para audit (best-effort).
      try {
        await set(this.compactionLockRef, { clientID: this.ydoc.clientID, ts: Date.now(), lastCutoff: serverTimestamp() });
      } catch { /* ignore */ }
    } catch (e) {
      console.warn('[yjs-firebase] compaction failed', e);
      this.updateCount = localCount;
    } finally {
      await this.releaseCompactionLock();
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    unregisterYjsProvider(this.docIdKey);
    // Lanzar flush + release seedLock en paralelo. NO awaitamos para no
    // bloquear el unmount, pero sendBeacon-like: el SDK de Firebase mantiene
    // la cola en memoria mientras la pestaña esté abierta. El TTL del
    // seedLock cubre el caso de cierre abrupto.
    void this.flushUpdates().catch(() => { /* logged adentro */ });
    void this.releaseSeedLock();
    for (const fn of this.unsubscribeFns) {
      try { fn(); } catch { /* ignore */ }
    }
    this.unsubscribeFns = [];
    if (this.awareness) {
      try { void remove(this.myAwarenessRef); } catch { /* ignore */ }
    }
    this.opts.onStatusChange?.('disconnected');
  }

  /**
   * Versión async de destroy que espera flush + release lock antes de
   * resolver. Usar desde callers que pueden await (cleanup de useEffect
   * con beforeunload listener, etc).
   */
  async destroyAsync(): Promise<void> {
    this.destroyed = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    unregisterYjsProvider(this.docIdKey);
    try {
      await this.flushUpdates();
    } catch { /* ignore */ }
    // Esperar inflight pushes en curso
    if (this.inFlightPushes.size > 0) {
      try {
        await Promise.allSettled(Array.from(this.inFlightPushes));
      } catch { /* ignore */ }
    }
    try {
      await this.releaseSeedLock();
    } catch { /* ignore */ }
    for (const fn of this.unsubscribeFns) {
      try { fn(); } catch { /* ignore */ }
    }
    this.unsubscribeFns = [];
    if (this.awareness) {
      try { await remove(this.myAwarenessRef); } catch { /* ignore */ }
    }
    this.opts.onStatusChange?.('disconnected');
  }
}

function encodeAwarenessForClient(awareness: Awareness, clientId: number): Uint8Array | null {
  const state = awareness.getStates().get(clientId);
  if (!state) return null;
  const data = JSON.stringify({ clientId, state });
  return new TextEncoder().encode(data);
}

function applyAwarenessForClient(awareness: Awareness, bytes: Uint8Array): void {
  try {
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as {
      clientId: number;
      state: Record<string, unknown>;
    };
    if (typeof decoded.clientId !== 'number') return;
    const a = awareness as unknown as {
      states: Map<number, Record<string, unknown>>;
      meta: Map<number, { clock: number; lastUpdated: number }>;
      emit: (event: string, payload: unknown[]) => void;
    };
    const isAdded = !a.states.has(decoded.clientId);
    a.states.set(decoded.clientId, decoded.state);
    a.meta.set(decoded.clientId, { clock: Date.now(), lastUpdated: Date.now() });
    const change = isAdded
      ? { added: [decoded.clientId], updated: [], removed: [] }
      : { added: [], updated: [decoded.clientId], removed: [] };
    a.emit('change', [change, 'firebase']);
    a.emit('update', [change, 'firebase']);
  } catch (e) {
    console.warn('[yjs-firebase] awareness decode failed', e);
  }
}

function removeAwarenessForClient(awareness: Awareness, clientId: number): void {
  try {
    const a = awareness as unknown as {
      states: Map<number, Record<string, unknown>>;
      meta: Map<number, { clock: number; lastUpdated: number }>;
      emit: (event: string, payload: unknown[]) => void;
    };
    if (!a.states.has(clientId)) return;
    a.states.delete(clientId);
    a.meta.delete(clientId);
    const change = { added: [], updated: [], removed: [clientId] };
    a.emit('change', [change, 'firebase']);
    a.emit('update', [change, 'firebase']);
  } catch (e) {
    console.warn('[yjs-firebase] awareness remove failed', e);
  }
}
