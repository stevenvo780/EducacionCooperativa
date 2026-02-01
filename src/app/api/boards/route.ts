import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, type CollectionReference, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_COLUMNS = ['Por hacer', 'En progreso', 'Hecho'];

const ensureBoard = async (workspaceId: string) => {
  const boardRef = adminDb.collection('boards').doc(workspaceId);
  const snap = await boardRef.get();
  if (!snap.exists) {
    await boardRef.set({
      workspaceId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  return boardRef;
};

const seedDefaultColumns = async (columnsRef: CollectionReference) => {
  const batch = adminDb.batch();
  DEFAULT_COLUMNS.forEach((name, index) => {
    const ref = columnsRef.doc();
    batch.set(ref, {
      name,
      order: (index + 1) * 1000,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
};

const touchBoard = (boardRef: DocumentReference) => {
  return boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
};

const deleteCardsByColumn = async (boardRef: DocumentReference, columnId: string) => {
  const batchLimit = 400;
  let lastDoc: QueryDocumentSnapshot | null = null;

  while (true) {
    let query = boardRef
      .collection('cards')
      .where('columnId', '==', columnId)
      .orderBy('__name__')
      .limit(batchLimit);

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const boardRef = await ensureBoard(workspaceId);
    const columnsRef = boardRef.collection('columns');

    let columnsSnap = await columnsRef.orderBy('order').get();
    if (columnsSnap.empty) {
      await seedDefaultColumns(columnsRef);
      columnsSnap = await columnsRef.orderBy('order').get();
    }

    const columns = columnsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const cardsSnap = await boardRef.collection('cards').orderBy('order').get();
    const cards = cardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      boardId: boardRef.id,
      workspaceId,
      columns,
      cards
    });
  } catch (error: any) {
    console.error('Error fetching board:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, type } = body as { workspaceId?: string; type?: string };

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const boardRef = await ensureBoard(workspaceId);

    if (type === 'column') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const columnRef = boardRef.collection('columns').doc();
      const data = {
        name: name || 'Sin titulo',
        order: typeof body.order === 'number' ? body.order : Date.now(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await columnRef.set(data);
      await touchBoard(boardRef);
      return NextResponse.json({ id: columnRef.id, ...data });
    }

    if (type === 'card') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const columnId = typeof body.columnId === 'string' ? body.columnId.trim() : '';
      if (!columnId) {
        return NextResponse.json({ error: 'columnId is required' }, { status: 400 });
      }
      const cardRef = boardRef.collection('cards').doc();
      const data = {
        title: title || 'Nueva tarjeta',
        description: typeof body.description === 'string' ? body.description : undefined,
        columnId,
        order: typeof body.order === 'number' ? body.order : Date.now(),
        ownerId: typeof body.ownerId === 'string' ? body.ownerId : undefined,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await cardRef.set(data);
      await touchBoard(boardRef);
      return NextResponse.json({ id: cardRef.id, ...data });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error creating board item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, type, id, data } = body as {
      workspaceId?: string;
      type?: string;
      id?: string;
      data?: Record<string, unknown>;
    };

    if (!workspaceId || !id) {
      return NextResponse.json({ error: 'workspaceId and id are required' }, { status: 400 });
    }

    const boardRef = await ensureBoard(workspaceId);
    const updateData: Record<string, unknown> = {};

    if (type === 'column') {
      if (typeof data?.name === 'string') updateData.name = data.name.trim();
      if (typeof data?.order === 'number') updateData.order = data.order;
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No data to update' }, { status: 400 });
      }
      updateData.updatedAt = FieldValue.serverTimestamp();
      await boardRef.collection('columns').doc(id).update(updateData);
      await touchBoard(boardRef);
      return NextResponse.json({ status: 'updated' });
    }

    if (type === 'card') {
      if (typeof data?.title === 'string') updateData.title = data.title.trim();
      if (typeof data?.description === 'string') updateData.description = data.description;
      if (typeof data?.columnId === 'string') updateData.columnId = data.columnId.trim();
      if (typeof data?.order === 'number') updateData.order = data.order;
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No data to update' }, { status: 400 });
      }
      updateData.updatedAt = FieldValue.serverTimestamp();
      await boardRef.collection('cards').doc(id).update(updateData);
      await touchBoard(boardRef);
      return NextResponse.json({ status: 'updated' });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating board item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, type, id } = body as { workspaceId?: string; type?: string; id?: string };

    if (!workspaceId || !id) {
      return NextResponse.json({ error: 'workspaceId and id are required' }, { status: 400 });
    }

    const boardRef = await ensureBoard(workspaceId);

    if (type === 'column') {
      await deleteCardsByColumn(boardRef, id);
      await boardRef.collection('columns').doc(id).delete();
      await touchBoard(boardRef);
      return NextResponse.json({ status: 'deleted' });
    }

    if (type === 'card') {
      await boardRef.collection('cards').doc(id).delete();
      await touchBoard(boardRef);
      return NextResponse.json({ status: 'deleted' });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error deleting board item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
