'use client';

/**
 * Firebase RTDB provider para Yjs.
 *
 * Modelo de datos:
 *   /collab/<wsId>/<docId>/updates/<pushKey> = { data: <base64>, clientId, ts }
 *   /collab/<wsId>/<docId>/awareness/<clientId> = { state: <base64>, ts }
 *   /collab/<wsId>/<docId>/seedLock = <clientId>  (mutex para seed inicial)
 *
 * Yjs (CRDT) garantiza convergencia eventual. Firebase es solo el broker.
 */

import {
  get,
  off,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref as rtdbRef,
  remove,
  runTransaction,
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
const FLUSH_DEBOUNCE_MS = 80;
const FLUSH_MAX_UPDATES = 50;
const FLUSH_MAX_BYTES = 64 * 1024;

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
  private unsubscribeFns: Array<() => void> = [];
  private destroyed = false;
  private updateCount = 0;
  private pendingUpdates: Uint8Array[] = [];
  private pendingBytes = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

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

    opts.onStatusChange?.('connecting');

    this.bootstrapInitialState()
      .then(() => {
        if (this.destroyed) return;
        this.subscribeToUpdates();
        if (this.awareness) this.subscribeToAwareness();
        this.bindLocalUpdates();
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
      if (this.pendingUpdates.length >= FLUSH_MAX_UPDATES || this.pendingBytes >= FLUSH_MAX_BYTES) {
        this.flushUpdates();
        return;
      }
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flushUpdates(), FLUSH_DEBOUNCE_MS);
    };
    this.ydoc.on('update', onUpdate);
    this.unsubscribeFns.push(() => this.ydoc.off('update', onUpdate));
  }

  private flushUpdates(): void {
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
    push(this.updatesRef, record).catch((err) =>
      console.warn('[yjs-firebase] push update failed', err)
    );
    this.updateCount += 1;
    void this.maybeCompact();
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

    const valueHandler = onValue(this.awarenessRef, (snapshot) => {
      const all = (snapshot.val() ?? {}) as Record<string, AwarenessRecord>;
      for (const [clientIdStr, rec] of Object.entries(all)) {
        const clientId = Number(clientIdStr);
        if (!Number.isFinite(clientId) || clientId === this.ydoc.clientID) continue;
        try {
          applyAwarenessForClient(awareness, base64ToBytes(rec.state));
        } catch (e) {
          console.warn('[yjs-firebase] awareness apply failed', e);
        }
      }
    });
    this.unsubscribeFns.push(() => {
      try { valueHandler(); } catch { off(this.awarenessRef, 'value'); }
    });

    localHandler();
  }

  /**
   * Mutex distribuido para sembrar el contenido inicial. El primer cliente
   * que reclame el lock devuelve true; los demás devuelven false y deben
   * esperar las updates remotas.
   */
  async claimSeedLock(): Promise<boolean> {
    try {
      const result = await runTransaction(this.seedLockRef, (current) => {
        if (current === null || current === undefined) {
          return this.ydoc.clientID;
        }
        return undefined;
      });
      return result.committed && result.snapshot.val() === this.ydoc.clientID;
    } catch (e) {
      console.warn('[yjs-firebase] seed lock failed', e);
      return false;
    }
  }

  private async maybeCompact(): Promise<void> {
    if (this.updateCount < COMPACTION_THRESHOLD || this.destroyed) return;
    const localCount = this.updateCount;
    this.updateCount = 0;
    try {
      const cutoff = Date.now();
      const stateVector = Y.encodeStateAsUpdate(this.ydoc);
      const compactRecord: UpdateRecord = {
        data: bytesToBase64(stateVector),
        clientId: this.ydoc.clientID,
        ts: cutoff
      };

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
    } catch (e) {
      console.warn('[yjs-firebase] compaction failed', e);
      this.updateCount = localCount;
    }
  }

  destroy(): void {
    this.destroyed = true;
    try { this.flushUpdates(); } catch { /* ignore */ }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    for (const fn of this.unsubscribeFns) {
      try { fn(); } catch { /* ignore */ }
    }
    this.unsubscribeFns = [];
    if (this.awareness) {
      try { void remove(this.myAwarenessRef); } catch { /* ignore */ }
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
    a.states.set(decoded.clientId, decoded.state);
    a.meta.set(decoded.clientId, { clock: Date.now(), lastUpdated: Date.now() });
    a.emit('change', [{ added: [], updated: [decoded.clientId], removed: [] }, 'firebase']);
    a.emit('update', [{ added: [], updated: [decoded.clientId], removed: [] }, 'firebase']);
  } catch (e) {
    console.warn('[yjs-firebase] awareness decode failed', e);
  }
}
