import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  email: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
  invitedBy: string;
}

// List invitations (sent and received)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid || !email) return res.status(401).json({ error: 'No autorizado' });

    const sent: Invitation[] = [];
    const received: Invitation[] = [];

    // Invitations I sent (groups I own/admin)
    const myGroupsSnapshot = await db.collection('groups')
      .where('members', 'array-contains', uid)
      .get();

    for (const groupDoc of myGroupsSnapshot.docs) {
      const groupData = groupDoc.data();
      const invitationsSnapshot = await db.collection('invitations')
        .where('groupId', '==', groupDoc.id)
        .where('invitedBy', '==', uid)
        .get();
      
      invitationsSnapshot.forEach(doc => {
        sent.push({ 
          id: doc.id, 
          groupName: groupData.name,
          ...doc.data() 
        } as Invitation);
      });
    }

    // Invitations I received
    const receivedSnapshot = await db.collection('invitations')
      .where('email', '==', email.toLowerCase())
      .get();

    for (const doc of receivedSnapshot.docs) {
      const data = doc.data();
      const groupDoc = await db.collection('groups').doc(data.groupId).get();
      const groupName = groupDoc.exists ? groupDoc.data()?.name : 'Grupo desconocido';
      
      received.push({
        id: doc.id,
        groupName,
        ...data
      } as Invitation);
    }

    res.json({ sent, received });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Send invitation
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });

    const { groupId, email } = req.body;
    if (!groupId || !email) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    // Verify user is member of group
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const groupData = groupDoc.data()!;
    if (!groupData.members.includes(uid)) {
      return res.status(403).json({ error: 'No eres miembro de este grupo' });
    }

    // Check if already invited
    const existingInvite = await db.collection('invitations')
      .where('groupId', '==', groupId)
      .where('email', '==', email.toLowerCase())
      .where('status', '==', 'pending')
      .get();

    if (!existingInvite.empty) {
      return res.status(409).json({ error: 'Ya existe una invitación pendiente' });
    }

    // Create invitation
    const inviteRef = await db.collection('invitations').add({
      groupId,
      email: email.toLowerCase(),
      status: 'pending',
      invitedBy: uid,
      createdAt: FieldValue.serverTimestamp()
    });

    // Also add to group's invitations array
    await db.collection('groups').doc(groupId).update({
      invitations: FieldValue.arrayUnion(email.toLowerCase())
    });

    res.json({ success: true, invitationId: inviteRef.id });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Accept/Reject invitation
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid || !email) return res.status(401).json({ error: 'No autorizado' });

    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida' });
    }

    const inviteDoc = await db.collection('invitations').doc(id).get();
    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    const inviteData = inviteDoc.data()!;
    
    // Verify this invitation is for current user
    if (inviteData.email !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Esta invitación no es para ti' });
    }

    if (inviteData.status !== 'pending') {
      return res.status(409).json({ error: 'Invitación ya procesada' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    
    await db.collection('invitations').doc(id).update({
      status: newStatus,
      respondedAt: FieldValue.serverTimestamp()
    });

    if (action === 'accept') {
      // Add user to group members
      await db.collection('groups').doc(inviteData.groupId).update({
        members: FieldValue.arrayUnion(uid),
        invitations: FieldValue.arrayRemove(email.toLowerCase())
      });
    } else {
      // Remove from invitations array
      await db.collection('groups').doc(inviteData.groupId).update({
        invitations: FieldValue.arrayRemove(email.toLowerCase())
      });
    }

    res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Error processing invitation:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
