/**
 * Emisor de pings RTDB. El payload sólo lleva metadata; el contenido vive en
 * MinIO y la metadata canónica en Firestore. El cliente (`useSyncEvents`)
 * filtra por `orderByChild('timestamp') + startAt(now-5s)`, por lo que el
 * payload debe traer `timestamp`, `type` y `source` con esos nombres.
 *
 * Outbox `syncEventsOutbox` queda como auditoría/replay si la publicación a
 * RTDB falla.
 */
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { isPersonalWorkspaceId, PERSONAL_WORKSPACE_ID } from '@/types/workspace';

export type SyncPingOp = 'created' | 'updated' | 'deleted' | 'refresh';

export interface SyncPing {
  scope: 'document' | 'workspace' | 'user' | 'snippet' | 'board' | 'subscription';
  /** Operación lógica — se traduce a `type` para el cliente. */
  op?: SyncPingOp;
  workspaceId?: string | null;
  userId?: string | null;
  docId?: string | null;
  path?: string | null;
  folder?: string | null;
  version?: number | null;
  contentHash?: string | null;
  sender?: string | null;
}

let _rtdb: ReturnType<typeof getDatabase> | null = null;
const getRtdb = () => {
  if (_rtdb) return _rtdb;
  void adminDb; // forces firebase-admin app init
  _rtdb = getDatabase();
  return _rtdb;
};

/**
 * Resuelve el canal RTDB. Para workspace personal el cliente escucha
 * `sync-events/personal_<uid>`; reescribimos cuando llega un ping con
 * `workspaceId` en forma `personal` o `personal:<uid>`.
 */
const channelFor = (ping: SyncPing): string => {
  const ws = ping.workspaceId ?? null;
  if (ws && isPersonalWorkspaceId(ws)) {
    // Aceptamos tanto '__personal__' como 'personal:<uid>'.
    const uid = ws === PERSONAL_WORKSPACE_ID ? ping.userId : ws.replace(/^personal:/, '');
    if (uid) return `sync-events/personal_${uid}`;
  }
  if (ws) return `sync-events/${ws}`;
  if (ping.userId) return `sync-events/personal_${ping.userId}`;
  return 'sync-events/global';
};

export const emitPing = async (ping: SyncPing): Promise<{ outboxId: string; rtdbPath: string }> => {
  const ts = Date.now();
  const rtdbPath = channelFor(ping);
  const type: SyncPingOp = ping.op ?? 'updated';
  const payload = {
    type,
    path: ping.path ?? '',
    folder: ping.folder ?? 'No estructurado',
    docId: ping.docId ?? null,
    timestamp: ts,
    source: 'worker',
    scope: ping.scope,
    workspaceId: ping.workspaceId ?? null,
    userId: ping.userId ?? null,
    version: ping.version ?? null,
    contentHash: ping.contentHash ?? null,
    sender: ping.sender ?? 'hub',
    ts
  };

  const outboxRef = await adminDb.collection('syncEventsOutbox').add({
    ...payload,
    rtdbPath,
    published: false,
    createdAt: FieldValue.serverTimestamp()
  });

  try {
    await getRtdb().ref(rtdbPath).push().set(payload);
    await outboxRef.update({ published: true, publishedAt: FieldValue.serverTimestamp() });
  } catch (err) {
    console.warn('[nas-events] rtdb push failed, outbox kept', (err as Error).message);
  }

  return { outboxId: outboxRef.id, rtdbPath };
};
