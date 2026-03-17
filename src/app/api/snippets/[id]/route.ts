import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

/* ──────────────────────────────────────────────────────────
   PUT /api/snippets/[id]
   Actualiza un snippet existente.
   ────────────────────────────────────────────────────────── */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = params;
    const body = await req.json();
    const allowed = ['title', 'description', 'markdown', 'category', 'order'] as const;

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    await adminDb.collection('snippets').doc(id).update(updates);
    return NextResponse.json({ id, ...updates });
  } catch (err) {
    console.error('PUT /api/snippets/[id] error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/* ──────────────────────────────────────────────────────────
   DELETE /api/snippets/[id]
   Elimina un snippet.
   ────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = params;
    await adminDb.collection('snippets').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/snippets/[id] error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
