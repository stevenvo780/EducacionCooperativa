import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const ownerId = (formData.get('ownerId') as string) || 'unknown';
        const workspaceId = (formData.get('workspaceId') as string) || 'personal';
        const folderField = formData.get('folder');
        const folder = typeof folderField === 'string' ? folderField : 'No estructurado';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        let filename = `users/${ownerId}/${safeName}`;

        if (workspaceId && workspaceId !== 'personal') {
             filename = `workspaces/${workspaceId}/${safeName}`;
        }

        const bucket = adminStorage.bucket();
        if (!bucket?.name) {
            throw new Error('Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID');
        }
        const fileRef = bucket.file(filename);

        await fileRef.save(buffer, {
            contentType: file.type,
            metadata: {
                metadata: {
                    originalName: file.name,
                    ownerId
                }
            }
        });

        const [url] = await fileRef.getSignedUrl({
            action: 'read',
            expires: '03-01-2500'
        });

        const docRef = await adminDb.collection('documents').add({
            name: file.name,
            type: 'file',
            url: url,
            mimeType: file.type,
            storagePath: filename,
            ownerId,
            workspaceId,
            folder,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            id: docRef.id,
            url,
            name: file.name,
            type: 'file',
            path: filename,
            storagePath: filename,
            mimeType: file.type,
            ownerId: ownerId,
            folder,
            updatedAt: { seconds: Date.now() / 1000 }
        });

    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
