import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { action, email, userId } = body;

    if (!id) {
      return NextResponse.json({ error: 'workspace id is required' }, { status: 400 });
    }

    const wsRef = adminDb.collection('workspaces').doc(id);
    const snap = await wsRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (action === 'invite') {
      if (!email) {
        return NextResponse.json({ error: 'email is required' }, { status: 400 });
      }
      await wsRef.update({ pendingInvites: FieldValue.arrayUnion(email) });
      return NextResponse.json({ status: 'invited' });
    }

    if (action === 'accept') {
      if (!email || !userId) {
        return NextResponse.json({ error: 'email and userId are required' }, { status: 400 });
      }
      await wsRef.update({
        members: FieldValue.arrayUnion(userId),
        pendingInvites: FieldValue.arrayRemove(email)
      });
      return NextResponse.json({ status: 'accepted' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating workspace:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'workspace id is required' }, { status: 400 });
    }

    const wsRef = adminDb.collection('workspaces').doc(id);
    const snap = await wsRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const data = snap.data() as { ownerId?: string; type?: string } | undefined;
    if (data?.type === 'personal') {
      return NextResponse.json({ error: 'Personal workspace cannot be deleted' }, { status: 400 });
    }

    let requesterId: string | undefined;
    try {
      const body = await req.json();
      requesterId = body?.ownerId || body?.userId;
    } catch {
      requesterId = undefined;
    }

    if (!requesterId) {
      return NextResponse.json({ error: 'ownerId is required' }, { status: 400 });
    }

    if (data?.ownerId && requesterId !== data.ownerId) {
      return NextResponse.json({ error: 'Only workspace owner can delete' }, { status: 403 });
    }

    const batchLimit = 400;
    let deletedDocs = 0;
    let lastDoc: QueryDocumentSnapshot | null = null;

    while (true) {
      let query = adminDb
        .collection('documents')
        .where('workspaceId', '==', id)
        .orderBy('__name__')
        .limit(batchLimit);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const docsSnap = await query.get();
      if (docsSnap.empty) break;

      const batch = adminDb.batch();
      docsSnap.docs.forEach(docRef => {
        batch.delete(docRef.ref);
      });
      await batch.commit();

      deletedDocs += docsSnap.size;
      lastDoc = docsSnap.docs[docsSnap.docs.length - 1];

      if (docsSnap.size < batchLimit) break;
    }

    let storageDeleted = false;
    const bucket = adminStorage.bucket();
    if (bucket?.name) {
      try {
        await bucket.deleteFiles({ prefix: `workspaces/${id}/` });
        storageDeleted = true;
      } catch (err) {
        console.warn('Storage cleanup failed for workspace', id, err);
      }
    }

    await wsRef.delete();

    return NextResponse.json({
      status: 'deleted',
      documentsDeleted: deletedDocs,
      storageDeleted
    });
  } catch (error: any) {
    console.error('Error deleting workspace:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
