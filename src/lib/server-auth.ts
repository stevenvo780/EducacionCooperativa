import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export type AuthContext = {
  uid: string;
  email?: string | null;
};

const getTokenFromRequest = (req: NextRequest) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (header) {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (token) {
      return token;
    }
  } catch {
  }

  return null;
};

export const requireAuth = async (req: NextRequest): Promise<AuthContext | null> => {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email ?? (decoded as { userEmail?: string }).userEmail ?? null;
    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
};

export const isWorkspaceMember = async (workspaceId: string, uid: string): Promise<boolean> => {
  if (!workspaceId || workspaceId === 'personal') return false;
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!snap.exists) return false;
  const data = snap.data() as { members?: string[] } | undefined;
  const members = Array.isArray(data?.members) ? data?.members : [];
  return members.includes(uid);
};
