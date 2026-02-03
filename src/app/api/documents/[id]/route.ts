import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';

const canAccessDoc = async (data: Record<string, unknown> | undefined, uid: string) => {
    const workspaceId = typeof data?.workspaceId === 'string' ? data.workspaceId : null;
    if (!workspaceId || workspaceId === 'personal') {
        return data?.ownerId === uid;
    }
    return isWorkspaceMember(workspaceId, uid);
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id } = params;
        const body = await req.json();

        const docRef = adminDb.collection('documents').doc(id);
        const snap = await docRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const existingData = snap.data();
        if (!(await canAccessDoc(existingData as Record<string, unknown> | undefined, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        let storagePath = existingData?.storagePath;

        if (body.content !== undefined && existingData?.type !== 'file') {
             const bucket = adminStorage.bucket();
             if (bucket.name) {
                 if (!storagePath) {
                     const ownerId = existingData?.ownerId || 'unknown';
                     const safeName = (existingData?.name || 'Sin titulo').replace(/[^a-zA-Z0-9.-]/g, '_');
                     const fname = safeName.endsWith('.md') ? safeName : `${safeName}.md`;
                     const wsId = existingData?.workspaceId;

                     storagePath = `users/${ownerId}/${fname}`;
                     if (wsId && wsId !== 'personal') {
                         storagePath = `workspaces/${wsId}/${fname}`;
                     }
                 }

                 try {
                     await bucket.file(storagePath).save(body.content, {
                        contentType: 'text/markdown',
                        metadata: { ownerId: existingData?.ownerId }
                     });
                 } catch (e) {
                     console.warn('Failed to update storage backing:', e);
                 }
             }
        }

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp()
        };

        if (body.content !== undefined && existingData?.type !== 'file') {
            updateData.content = body.content;
            updateData.lastUpdatedBy = auth.uid;
        }
        if (typeof body.name === 'string') updateData.name = body.name;
        if (typeof body.type === 'string') updateData.type = body.type;
        if (typeof body.mimeType === 'string' || body.mimeType === null) updateData.mimeType = body.mimeType ?? null;
        if (typeof body.folder === 'string') updateData.folder = body.folder;
        if (typeof body.size === 'number') updateData.size = body.size;
        if (typeof body.order === 'number') updateData.order = body.order;

        if (storagePath && !existingData?.storagePath) {
            updateData.storagePath = storagePath;
        }

        await docRef.update(updateData);

        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
        console.error('Error updating document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
            const mockDoc = {
                id: params.id,
                name: 'Documento de Prueba.md',
                content: 'Este es un texto de prueba para la busqueda. La busqueda debe funcionar.',
                type: 'text',
                workspaceId: 'personal',
                folder: 'No estructurado',
                updatedAt: { seconds: Date.now() / 1000 },
                createdAt: { seconds: Date.now() / 1000 },
                ownerId: auth.uid
            };
            return NextResponse.json(mockDoc);
        }

        const { id } = params;
        const docSnap = await adminDb.collection('documents').doc(id).get();
        if (!docSnap.exists) {
             return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        const data = docSnap.data();
        if (!(await canAccessDoc(data as Record<string, unknown> | undefined, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.json({ id: docSnap.id, ...data });
    } catch (error: any) {
        console.error('Error fetching document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id } = params;
        const docRef = adminDb.collection('documents').doc(id);
        const snap = await docRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const data = snap.data() as any;
        if (!(await canAccessDoc(data as Record<string, unknown> | undefined, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const storagePath = data?.storagePath as string | undefined;

        // Borrar archivo de Storage si existe (tanto para files como para documentos markdown)
        if (storagePath) {
            const existing = await adminDb.collection('documents').where('storagePath', '==', storagePath).get();
            const hasOtherReferences = existing.docs.some(docItem => docItem.id !== id);
            if (!hasOtherReferences) {
                const bucket = adminStorage.bucket();
                if (bucket?.name) {
                    await bucket.file(storagePath).delete().catch((e) => console.warn('Storage delete failed', e));
                }
            }
        }

        await docRef.delete();
        return NextResponse.json({ status: 'deleted' });
    } catch (error: any) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
