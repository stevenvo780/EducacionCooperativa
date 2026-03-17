import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

/* ──────────────────────────────────────────────────────────
   GET /api/snippets?workspaceId=xxx
   Devuelve los snippets de un workspace (o "personal").
   ────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'personal';

    const snap = await adminDb
      .collection('snippets')
      .where('workspaceId', '==', workspaceId)
      .orderBy('order', 'asc')
      .limit(500)
      .get();

    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/snippets error', err);
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

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (typeof markdown !== 'string') {
      return NextResponse.json({ error: 'markdown is required' }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      markdown,
      workspaceId: typeof workspaceId === 'string' && workspaceId ? workspaceId : 'personal',
      category: typeof category === 'string' ? category.trim() : 'general',
      order: typeof order === 'number' ? order : 0,
      ownerId: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const ref = await adminDb.collection('snippets').add(data);
    return NextResponse.json({ id: ref.id, ...data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/snippets error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
