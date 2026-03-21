import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';
import {
  EMPTY_SEMANTIC_WORKSPACE_STATE,
  normalizeSemanticWorkspaceState,
  type SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

const mockSemanticStates = new Map<string, SemanticWorkspaceState>();

const resolveWorkspaceStorageId = (workspaceId: string, uid: string) => (
  isPersonalWorkspaceId(workspaceId) ? `${PERSONAL_WORKSPACE_ID}:${uid}` : workspaceId
);

const canAccessWorkspace = async (workspaceId: string, uid: string) => {
  if (isPersonalWorkspaceId(workspaceId)) return true;
  return isWorkspaceMember(workspaceId, uid);
};

const getMockState = (storageId: string) => (
  mockSemanticStates.get(storageId) ?? EMPTY_SEMANTIC_WORKSPACE_STATE
);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || PERSONAL_WORKSPACE_ID;
    const allowed = await canAccessWorkspace(workspaceId, auth.uid);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storageId = resolveWorkspaceStorageId(workspaceId, auth.uid);

    if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
      return NextResponse.json({ state: getMockState(storageId) });
    }

    const snap = await adminDb.collection('workspaceSemanticStates').doc(storageId).get();
    if (!snap.exists) {
      return NextResponse.json({ state: EMPTY_SEMANTIC_WORKSPACE_STATE });
    }

    const state = normalizeSemanticWorkspaceState(snap.data());
    return NextResponse.json({ state });
  } catch (error: unknown) {
    console.error('GET /api/semantic error', getErrorMessage(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json() as { workspaceId?: unknown; state?: unknown };
    const workspaceId = typeof body.workspaceId === 'string' && body.workspaceId.trim()
      ? body.workspaceId.trim()
      : PERSONAL_WORKSPACE_ID;

    const allowed = await canAccessWorkspace(workspaceId, auth.uid);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const incomingState = normalizeSemanticWorkspaceState(body.state);
    const storageId = resolveWorkspaceStorageId(workspaceId, auth.uid);
    const nextUpdatedAt = Date.now();

    if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
      const mergedState = {
        ...incomingState,
        updatedAt: nextUpdatedAt
      };
      mockSemanticStates.set(storageId, mergedState);
      return NextResponse.json({ state: mergedState });
    }

    const ref = adminDb.collection('workspaceSemanticStates').doc(storageId);
    const mergedState = {
      ...incomingState,
      updatedAt: nextUpdatedAt
    };

    await ref.set({
      workspaceId,
      storageId,
      concepts: mergedState.concepts,
      fragments: mergedState.fragments,
      relations: mergedState.relations,
      updatedAt: mergedState.updatedAt,
      updatedBy: auth.uid,
      serverUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return NextResponse.json({ state: mergedState });
  } catch (error: unknown) {
    console.error('POST /api/semantic error', getErrorMessage(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
