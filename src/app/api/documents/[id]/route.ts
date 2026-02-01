import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const body = await req.json();

        const docRef = adminDb.collection('documents').doc(id);
        const snap = await docRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const existingData = snap.data();
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

        const updateData: any = {
            ...body,
            updatedAt: FieldValue.serverTimestamp()
        };

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
        const { id } = params;
        const docSnap = await adminDb.collection('documents').doc(id).get();
        if (!docSnap.exists) {
             return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
    } catch (error: any) {
        console.error('Error fetching document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const docRef = adminDb.collection('documents').doc(id);
        const snap = await docRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const data = snap.data() as any;
        const storagePath = data?.storagePath as string | undefined;
        if (data?.type === 'file' && storagePath) {
            const existing = await adminDb.collection('documents').where('storagePath', '==', storagePath).get();
            const hasOtherReferences = existing.docs.some(docItem => docItem.id !== id);
            if (!hasOtherReferences) {
                const bucket = adminStorage.bucket();
                if (!bucket?.name) {
                    throw new Error('Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID');
                }
                await bucket.file(storagePath).delete().catch((e) => console.warn('Storage delete failed', e));
            }
        }

        await docRef.delete();
        return NextResponse.json({ status: 'deleted' });
    } catch (error: any) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
