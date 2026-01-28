import { db } from '../firebase.js';

interface Group {
  id: string;
  name: string;
  members: string[];
  invitations: string[];
  isInvite?: boolean;
}

export async function getUserGroups(uid: string, email?: string): Promise<Group[]> {
  const userGroups: Group[] = [];

  try {
    // Groups where user is member
    const memberSnapshot = await db.collection('groups')
      .where('members', 'array-contains', uid)
      .get();
    
    memberSnapshot.forEach(doc => {
      userGroups.push({ id: doc.id, ...doc.data() } as Group);
    });

    // Groups where user is invited
    if (email) {
      const inviteSnapshot = await db.collection('groups')
        .where('invitations', 'array-contains', email)
        .get();
      
      inviteSnapshot.forEach(doc => {
        if (!userGroups.find(g => g.id === doc.id)) {
          userGroups.push({ id: doc.id, ...doc.data(), isInvite: true } as Group);
        }
      });
    }
  } catch (error) {
    console.error('Error fetching groups:', error);
  }

  return userGroups;
}

export function resolveStoragePath(
  displayPath: string,
  uid: string,
  userGroups: Group[]
): string | null {
  const parts = displayPath.replace(/^\/+/, '').split('/');
  const root = parts[0];

  if (root === 'Mis Archivos') {
    return `users/${uid}/${parts.slice(1).join('/')}`;
  }

  if (root === 'Espacios de Trabajo') {
    if (parts.length < 2) return null;
    const groupName = parts[1];
    const group = userGroups.find(g => g.name === groupName);
    if (!group) return null;
    return `groups/${group.id}/${parts.slice(2).join('/')}`;
  }

  return null;
}
