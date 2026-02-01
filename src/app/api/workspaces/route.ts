import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let workspaces: unknown[] = [];
    let invites: unknown[] = [];

    const snapshot = await adminDb
      .collection('workspaces')
      .where('members', 'array-contains', auth.uid)
      .get();
    workspaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (auth.email) {
      const inviteSnap = await adminDb
        .collection('workspaces')
        .where('pendingInvites', 'array-contains', auth.email)
        .get();
      invites = inviteSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    return NextResponse.json({ workspaces, invites });
  } catch (error: any) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const workspaceData = {
      name,
      ownerId: auth.uid,
      members: [auth.uid],
      pendingInvites: [],
      type: 'shared',
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await adminDb.collection('workspaces').add(workspaceData);

    return NextResponse.json({
      id: docRef.id,
      name,
      ownerId: auth.uid,
      members: [auth.uid],
      pendingInvites: [],
      type: 'shared'
    });
  } catch (error: any) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
