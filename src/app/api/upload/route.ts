import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const ownerId = formData.get('ownerId') as string;
        const workspaceId = formData.get('workspaceId') as string;
        const folder = formData.get('folder') as string;
        
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(filename);

        await fileRef.save(buffer, {
            contentType: file.type,
            metadata: {
                metadata: {
                    originalName: file.name,
                    ownerId,
                }
            }
        });

        const [url] = await fileRef.getSignedUrl({
            action: 'read',
            expires: '03-01-2500', 
        });

        // Create document in Firestore via Admin SDK
        const docRef = await adminDb.collection('documents').add({
            name: file.name,
            type: 'file',
            url: url,
            mimeType: file.type,
            storagePath: filename,
            ownerId: ownerId || 'unknown',
            workspaceId: workspaceId || 'personal',
            folder: folder || 'No estructurado',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        
        return NextResponse.json({ 
            id: docRef.id,
            url, 
            name: file.name, 
            type: 'file', 
            path: filename,
            mimeType: file.type,
            ownerId: ownerId,
            updatedAt: { seconds: Date.now() / 1000 } // Approximation
        });

    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
