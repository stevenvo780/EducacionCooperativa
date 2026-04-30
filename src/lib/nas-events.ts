/**
 * RTDB-only event emitter. Payload mínimo: ping con metadata para que el suscriptor
 * decida si hace pull. El contenido vive en MinIO, la metadata en Firestore.
 *
 * Outbox: collection `syncEventsOutbox` en Firestore (auditoría + replay).
 */
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

export interface SyncPing {
  scope: 'document' | 'workspace' | 'user' | 'snippet' | 'board' | 'subscription';
  workspaceId?: string | null;
  userId?: string | null;
  docId?: string | null;
  path?: string | null;
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

const channelFor = (ping: SyncPing): string => {
  if (ping.workspaceId) return `sync-events/${ping.workspaceId}`;
  if (ping.userId) return `sync-events/personal_${ping.userId}`;
  return 'sync-events/global';
};

export const emitPing = async (ping: SyncPing): Promise<{ outboxId: string; rtdbPath: string }> => {
  const ts = Date.now();
  const rtdbPath = channelFor(ping);
  const payload = {
    scope: ping.scope,
    workspaceId: ping.workspaceId ?? null,
    userId: ping.userId ?? null,
    docId: ping.docId ?? null,
    path: ping.path ?? null,
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
