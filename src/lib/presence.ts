/**
 * Presencia en tiempo real vía Firebase RTDB.
 *
 * Modelo de datos:
 *   /presence/<wsId>/<sessionId> = {
 *     userId, displayName, photoURL?, color, currentDocId?,
 *     joinedAt, lastSeen
 *   }
 *
 * Cleanup automático: usamos onDisconnect() de RTDB que dispara cuando el
 * WebSocket se cae (cierre de pestaña, crash, conexión perdida). Como
 * fallback adicional el cliente refresca `lastSeen` cada PRESENCE_HEARTBEAT_MS
 * y los lectores filtran entradas con `lastSeen < now - PRESENCE_TTL_MS`.
 */

import {
  off,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  ref,
  remove,
  serverTimestamp,
  set,
  update
} from 'firebase/database';
import { auth as getAuthSingleton, rtdb } from '@/lib/firebase';

/**
 * Verifica que el browser tiene un usuario autenticado y, si el wsId es
 * `personal_<uid>`, que el uid actual coincide. Las rules RTDB son:
 *   /presence/<wsId> writable if auth != null && (!wsId.startsWith('personal_')
 *                                                  || wsId === 'personal_' + auth.uid)
 * Si emitimos writes sin esto, Firebase loguea `permission_denied` aunque
 * nosotros silenciemos la rejection — la única forma de evitar la línea de
 * error en consola es no enviar el write.
 */
function canWritePresence(workspaceId: string): boolean {
  try {
    const currentUid = getAuthSingleton().currentUser?.uid;
    if (!currentUid) return false;
    if (workspaceId.startsWith('personal_')) {
      return workspaceId === `personal_${currentUid}`;
    }
    return true;
  } catch {
    return false;
  }
}

export const PRESENCE_HEARTBEAT_MS = 25_000;
export const PRESENCE_TTL_MS = 90_000;

/** Paleta de colores para distinguir usuarios visualmente. */
const PRESENCE_COLORS = [
  '#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa',
  '#fb7185', '#22d3ee', '#84cc16', '#f97316', '#c084fc'
] as const;

export interface PresenceEntry {
  sessionId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  color: string;
  currentDocId?: string;
  joinedAt: number;
  lastSeen: number;
}

interface PresenceUpdate {
  currentDocId?: string | null;
  displayName?: string;
  photoURL?: string;
}

/**
 * Asigna un color estable a partir del userId (para evitar que cambie
 * entre sesiones).
 */
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PRESENCE_COLORS.length;
  return PRESENCE_COLORS[index]!;
}

function presencePath(wsId: string, sessionId?: string): string {
  return sessionId ? `presence/${wsId}/${sessionId}` : `presence/${wsId}`;
}

export interface JoinPresenceArgs {
  workspaceId: string;
  sessionId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  currentDocId?: string;
}

/**
 * Une al usuario al canal de presencia del workspace. Devuelve helpers
 * para refrescar el doc actual y para salir explícitamente.
 */
export async function joinPresence(args: JoinPresenceArgs): Promise<{
  updateCurrentDoc: (docId: string | null) => Promise<void>;
  heartbeat: () => Promise<void>;
  leave: () => Promise<void>;
}> {
  if (!canWritePresence(args.workspaceId)) {
    // Sin auth o con uid distinto del personal workspace: no podemos escribir.
    // Devolvemos handle no-op para que el caller no rompa.
    return {
      updateCurrentDoc: async () => undefined,
      heartbeat: async () => undefined,
      leave: async () => undefined
    };
  }

  const database = rtdb();
  const myRef = ref(database, presencePath(args.workspaceId, args.sessionId));
  const color = colorForUser(args.userId);

  const initial: Omit<PresenceEntry, 'sessionId'> = {
    userId: args.userId,
    displayName: args.displayName,
    photoURL: args.photoURL,
    color,
    currentDocId: args.currentDocId,
    joinedAt: Date.now(),
    lastSeen: Date.now()
  };

  // RTDB no acepta `undefined` en valores; los limpiamos.
  const sanitized = stripUndefined(initial);
  await set(myRef, { ...sanitized, lastSeenServer: serverTimestamp() });
  await onDisconnect(myRef).remove();

  return {
    updateCurrentDoc: async (docId) => {
      if (!canWritePresence(args.workspaceId)) return;
      const patch: PresenceUpdate = { currentDocId: docId ?? undefined };
      await update(myRef, {
        ...stripUndefined(patch),
        currentDocId: docId ?? null,
        lastSeen: Date.now(),
        lastSeenServer: serverTimestamp()
      });
    },
    heartbeat: async () => {
      if (!canWritePresence(args.workspaceId)) return;
      await update(myRef, { lastSeen: Date.now(), lastSeenServer: serverTimestamp() });
    },
    leave: async () => {
      if (!canWritePresence(args.workspaceId)) return;
      try { await remove(myRef); } catch { /* ignore */ }
    }
  };
}

/**
 * Suscribe al canal de presencia y emite el snapshot completo cada vez
 * que cambia. Devuelve función de unsubscribe.
 *
 * Implementación per-child (onChildAdded/Changed/Removed) en lugar de
 * onValue: cada cambio paga O(1) en serialización y costo de red, en
 * lugar de O(N) por evento. En aulas grandes (>20 conectados) onValue
 * generaba O(N²) tráfico — cada heartbeat retransmitía el snapshot
 * completo a todos los clientes.
 */
export function subscribePresence(
  workspaceId: string,
  callback: (entries: PresenceEntry[]) => void
): () => void {
  if (!canWritePresence(workspaceId)) {
    // No-op: sin auth o sin uid coincidente para personal_<uid> el listener
    // fallaría con permission_denied en cuanto el server emita el primer event.
    return () => undefined;
  }
  const database = rtdb();
  const channelRef = ref(database, presencePath(workspaceId));

  // Estado local: mantenemos un Map<sessionId, PresenceEntry> que se actualiza
  // incrementalmente con los eventos por hijo. Cada cambio re-emite el snapshot
  // filtrado/ordenado al callback.
  const entriesBySession = new Map<string, PresenceEntry>();

  const emitSnapshot = () => {
    const now = Date.now();
    const entries: PresenceEntry[] = [];
    for (const entry of entriesBySession.values()) {
      if (now - entry.lastSeen > PRESENCE_TTL_MS) continue;
      entries.push(entry);
    }
    entries.sort((a, b) => a.joinedAt - b.joinedAt);
    callback(entries);
  };

  const upsert = (snapshot: { key: string | null; val: () => unknown }) => {
    const key = snapshot.key;
    if (!key) return;
    const parsed = parsePresenceEntry(key, snapshot.val());
    if (!parsed) {
      entriesBySession.delete(key);
    } else {
      entriesBySession.set(key, parsed);
    }
    emitSnapshot();
  };

  const removeKey = (snapshot: { key: string | null }) => {
    const key = snapshot.key;
    if (!key) return;
    if (entriesBySession.delete(key)) emitSnapshot();
  };

  const addedHandler = onChildAdded(channelRef, upsert);
  const changedHandler = onChildChanged(channelRef, upsert);
  const removedHandler = onChildRemoved(channelRef, removeKey);

  return () => {
    try { addedHandler(); } catch { off(channelRef, 'child_added'); }
    try { changedHandler(); } catch { off(channelRef, 'child_changed'); }
    try { removedHandler(); } catch { off(channelRef, 'child_removed'); }
    entriesBySession.clear();
  };
}

function parsePresenceEntry(sessionId: string, value: unknown): PresenceEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.userId !== 'string' || typeof v.displayName !== 'string') return null;
  if (typeof v.color !== 'string' || typeof v.lastSeen !== 'number') return null;
  return {
    sessionId,
    userId: v.userId,
    displayName: v.displayName,
    photoURL: typeof v.photoURL === 'string' ? v.photoURL : undefined,
    color: v.color,
    currentDocId: typeof v.currentDocId === 'string' ? v.currentDocId : undefined,
    joinedAt: typeof v.joinedAt === 'number' ? v.joinedAt : v.lastSeen,
    lastSeen: v.lastSeen
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/**
 * Agrupa entries por userId. Útil para no mostrar la misma persona
 * dos veces si tiene varias pestañas abiertas. Conserva el currentDocId
 * más reciente.
 */
export function deduplicateByUser(entries: PresenceEntry[]): PresenceEntry[] {
  const byUser = new Map<string, PresenceEntry>();
  for (const entry of entries) {
    const existing = byUser.get(entry.userId);
    if (!existing || entry.lastSeen > existing.lastSeen) {
      byUser.set(entry.userId, entry);
    }
  }
  return Array.from(byUser.values());
}

/**
 * Devuelve los IDs de los usuarios que están viendo un doc específico
 * en este momento. Excluye el `excludeSessionId` (usualmente la propia
 * sesión).
 */
export function viewersOfDoc(
  entries: PresenceEntry[],
  docId: string,
  excludeSessionId?: string
): PresenceEntry[] {
  return entries.filter(
    (e) => e.currentDocId === docId && e.sessionId !== excludeSessionId
  );
}
