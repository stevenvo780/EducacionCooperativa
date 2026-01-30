import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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
