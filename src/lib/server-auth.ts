import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyLocalDevAuthToken } from '@/lib/local-dev-auth';
import { isPersonalWorkspaceId } from '@/types/workspace';

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

  return null;
};

const allowInsecureAuth = process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true';
const INSECURE_UID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;

export const requireAuth = async (req: NextRequest): Promise<AuthContext | null> => {
  const token = getTokenFromRequest(req);

  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email ?? (decoded as { userEmail?: string }).userEmail ?? null;
    return { uid: decoded.uid, email };
  } catch {
    const localDevAuth = verifyLocalDevAuthToken(token);
    if (localDevAuth) {
      return localDevAuth;
    }
    if (allowInsecureAuth && INSECURE_UID_PATTERN.test(token)) {
      return { uid: token, email: null };
    }
    return null;
  }
};

export const isWorkspaceMember = async (workspaceId: string, uid: string): Promise<boolean> => {
  if (isPersonalWorkspaceId(workspaceId)) return false;
  if (allowInsecureAuth) return true;
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!snap.exists) return false;
  const data = snap.data() as { members?: string[] } | undefined;
  const members = Array.isArray(data?.members) ? data?.members : [];
  return members.includes(uid);
};

export const getUserRole = async (uid: string): Promise<string | null> => {
  if (!uid) return null;
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() as { role?: string } | undefined;
    if (typeof data?.role === 'string' && data.role.trim()) {
      return data.role.trim();
    }
  } catch (error) {
    console.warn('Failed to load user role:', error);
  }
  return null;
};

export const isAdminUser = async (uid: string): Promise<boolean> => {
  const role = await getUserRole(uid);
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === 'admin' || normalized === 'superadmin';
};
