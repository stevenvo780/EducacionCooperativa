import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid;
  try {
     const decoded = await adminAuth?.verifyIdToken(token);
     uid = decoded?.uid;
  } catch (e) {
     return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!uid || !db) return NextResponse.json({ error: 'Service Unavailable' }, { status: 503 });

  try {
    const { groupId, email } = await req.json();
    
    if (!groupId || !email) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Check group membership
    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const groupData = groupSnap.data();
    if (!groupData?.members.includes(uid)) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    // Check duplicate invites
    const existingInvite = await db.collection('invitations')
      .where('groupId', '==', groupId)
      .where('email', '==', email.toLowerCase())
      .where('status', '==', 'pending')
      .get();

    if (!existingInvite.empty) {
      return NextResponse.json({ error: 'Invite already pending' }, { status: 409 });
    }

    // Create invite
    const inviteRef = await db.collection('invitations').add({
      groupId,
      email: email.toLowerCase(),
      status: 'pending',
      invitedBy: uid,
      createdAt: FieldValue.serverTimestamp()
    });

    // Update group
    await groupRef.update({
      invitations: FieldValue.arrayUnion(email.toLowerCase())
    });

    return NextResponse.json({ success: true, invitationId: inviteRef.id });

  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
