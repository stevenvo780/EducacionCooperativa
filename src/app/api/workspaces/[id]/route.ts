import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue, type CollectionReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { isAdminUser, requireAuth } from '@/lib/server-auth';
import { WorkspaceType } from '@/types/workspace';

const deleteCollectionInBatches = async (collectionRef: CollectionReference, batchLimit = 400) => {
  let lastDoc: QueryDocumentSnapshot | null = null;

  while (true) {
    let query = collectionRef.orderBy('__name__').limit(batchLimit);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    if (snapshot.size < batchLimit) break;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
};

const deleteBoardData = async (workspaceId: string) => {
  const boardRef = adminDb.collection('boards').doc(workspaceId);
  const snap = await boardRef.get();
  if (!snap.exists) return false;

  // Delete columns and cards in parallel — they are independent
  await Promise.all([
    deleteCollectionInBatches(boardRef.collection('columns')),
    deleteCollectionInBatches(boardRef.collection('cards'))
  ]);
  await boardRef.delete();
  return true;
};

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { action, email } = body;

    if (!id) {
      return NextResponse.json({ error: 'workspace id is required' }, { status: 400 });
    }

    const wsRef = adminDb.collection('workspaces').doc(id);
    const snap = await wsRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    const wsData = snap.data() as { ownerId?: string; pendingInvites?: string[] } | undefined;

    if (action === 'invite') {
      if (!email) {
        return NextResponse.json({ error: 'email is required' }, { status: 400 });
      }
      if (wsData?.ownerId !== auth.uid) {
        return NextResponse.json({ error: 'Only workspace owner can invite' }, { status: 403 });
      }
      const normalizedEmail = email.toLowerCase().trim();
      await wsRef.update({ pendingInvites: FieldValue.arrayUnion(normalizedEmail) });
      return NextResponse.json({ status: 'invited' });
    }

    if (action === 'accept') {
      const normalizedEmail = email?.toLowerCase().trim();
      const normalizedAuthEmail = auth.email?.toLowerCase().trim();
      if (!normalizedEmail || !normalizedAuthEmail || normalizedEmail !== normalizedAuthEmail) {
        return NextResponse.json({ error: 'email mismatch' }, { status: 400 });
      }
      const pending = Array.isArray(wsData?.pendingInvites) ? wsData.pendingInvites.map((e: string) => e.toLowerCase().trim()) : [];
      if (!pending.includes(normalizedEmail)) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 400 });
      }
      await wsRef.update({
        members: FieldValue.arrayUnion(auth.uid),
        pendingInvites: FieldValue.arrayRemove(normalizedEmail)
      });
      return NextResponse.json({ status: 'accepted' });
    }

    if (action === 'remove_member') {
        const { userId } = body;
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }
        if (wsData?.ownerId !== auth.uid) {
            return NextResponse.json({ error: 'Only workspace owner can remove members' }, { status: 403 });
        }
        if (userId === wsData.ownerId) {
            return NextResponse.json({ error: 'Cannot remove workspace owner' }, { status: 400 });
        }
        await wsRef.update({
            members: FieldValue.arrayRemove(userId)
        });
        return NextResponse.json({ status: 'removed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error updating workspace:', getErrorMessage(error));
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'workspace id is required' }, { status: 400 });
    }

    const wsRef = adminDb.collection('workspaces').doc(id);
    const snap = await wsRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const data = snap.data() as { ownerId?: string; type?: string } | undefined;
    if (data?.type === WorkspaceType.Personal) {
      return NextResponse.json({ error: 'Personal workspace cannot be deleted' }, { status: 400 });
    }

    const isAdmin = await isAdminUser(auth.uid);
    if (data?.ownerId && auth.uid !== data.ownerId && !isAdmin) {
      return NextResponse.json({ error: 'Only workspace owner or admin can delete' }, { status: 403 });
    }

    // Delete documents, board data, and storage files in parallel
    const [deletedDocs, boardResult, storageResult] = await Promise.allSettled([
      (async () => {
        const batchLimit = 400;
        let count = 0;
        let lastDoc: QueryDocumentSnapshot | null = null;
        while (true) {
          let q = adminDb.collection('documents').where('workspaceId', '==', id).orderBy('__name__').limit(batchLimit);
          if (lastDoc) q = q.startAfter(lastDoc);
          const snap = await q.get();
          if (snap.empty) break;
          const batch = adminDb.batch();
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          count += snap.size;
          if (snap.size < batchLimit) break;
          lastDoc = snap.docs[snap.docs.length - 1];
        }
        return count;
      })(),
      deleteBoardData(id).catch(error => { console.warn('Board cleanup failed for workspace', id, getErrorMessage(error)); return false; }),
      (async () => {
        const bucket = adminStorage.bucket();
        if (!bucket?.name) return false;
        await bucket.deleteFiles({ prefix: `workspaces/${id}/` });
        return true;
      })().catch(error => { console.warn('Storage cleanup failed for workspace', id, getErrorMessage(error)); return false; })
    ]);

    const deletedDocsCount = deletedDocs.status === 'fulfilled' ? deletedDocs.value : 0;
    const boardDeleted = boardResult.status === 'fulfilled' ? boardResult.value : false;
    const storageDeleted = storageResult.status === 'fulfilled' ? storageResult.value : false;

    await wsRef.delete();

    return NextResponse.json({
      status: 'deleted',
      documentsDeleted: deletedDocsCount,
      storageDeleted,
      boardDeleted
    });
  } catch (error: unknown) {
    console.error('Error deleting workspace:', getErrorMessage(error));
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
