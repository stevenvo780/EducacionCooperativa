import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

/* ──────────────────────────────────────────────────────────
   GET /api/snippets?workspaceId=xxx
   Devuelve los snippets de un workspace (o "personal").
   ────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || PERSONAL_WORKSPACE_ID;
    if (!isPersonalWorkspaceId(workspaceId)) {
      const member = await isWorkspaceMember(workspaceId, auth.uid);
      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let query: FirebaseFirestore.Query = adminDb
      .collection('snippets')
      .where('workspaceId', '==', workspaceId);

    if (isPersonalWorkspaceId(workspaceId)) {
      query = query.where('ownerId', '==', auth.uid);
    }

    const snap = await query.orderBy('order', 'asc').limit(500).get();

    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('GET /api/snippets error', getErrorMessage(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/snippets
   Crea un snippet nuevo.
   Body: { title, description?, markdown, workspaceId?, category?, order? }
   ────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { title, description, markdown, workspaceId, category, order } = body as Record<string, unknown>;
    const resolvedWorkspaceId = typeof workspaceId === 'string' && workspaceId ? workspaceId : PERSONAL_WORKSPACE_ID;

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (typeof markdown !== 'string') {
      return NextResponse.json({ error: 'markdown is required' }, { status: 400 });
    }
    if (!isPersonalWorkspaceId(resolvedWorkspaceId)) {
      const member = await isWorkspaceMember(resolvedWorkspaceId, auth.uid);
      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const data: Record<string, unknown> = {
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      markdown,
      workspaceId: resolvedWorkspaceId,
      category: typeof category === 'string' ? category.trim() : 'general',
      order: typeof order === 'number' ? order : 0,
      ownerId: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const ref = await adminDb.collection('snippets').add(data);
    return NextResponse.json({ id: ref.id, ...data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/snippets error', getErrorMessage(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
