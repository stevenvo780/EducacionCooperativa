import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const email = searchParams.get('email');

    if (!ownerId && !email) {
      return NextResponse.json({ error: 'ownerId or email is required' }, { status: 400 });
    }

    let workspaces: unknown[] = [];
    let invites: unknown[] = [];

    if (ownerId) {
      const snapshot = await adminDb
        .collection('workspaces')
        .where('members', 'array-contains', ownerId)
        .get();
      workspaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    if (email) {
      const inviteSnap = await adminDb
        .collection('workspaces')
        .where('pendingInvites', 'array-contains', email)
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
    const body = await req.json();
    const { name, ownerId } = body;

    if (!name || !ownerId) {
      return NextResponse.json({ error: 'name and ownerId are required' }, { status: 400 });
    }

    const workspaceData = {
      name,
      ownerId,
      members: [ownerId],
      pendingInvites: [],
      type: 'shared',
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await adminDb.collection('workspaces').add(workspaceData);

    return NextResponse.json({
      id: docRef.id,
      name,
      ownerId,
      members: [ownerId],
      pendingInvites: [],
      type: 'shared'
    });
  } catch (error: any) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
