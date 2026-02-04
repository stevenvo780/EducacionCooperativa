import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

/**
 * Registers a document in Firestore after successful direct upload to Storage
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const {
            storagePath,
            fileName,
            originalName,
            mimeType,
            workspaceId = 'personal',
            folder = 'No estructurado'
        } = body;

        if (!storagePath || !fileName) {
            return NextResponse.json({ error: 'storagePath and fileName required' }, { status: 400 });
        }

        // Validate storagePath prefix ownership
        if (workspaceId === 'personal') {
          if (!storagePath.startsWith(`users/${auth.uid}/`)) {
            return NextResponse.json({ error: 'Access denied: Invalid storage path' }, { status: 403 });
          }
        } else {
            const member = await isWorkspaceMember(workspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (!storagePath.startsWith(`workspaces/${workspaceId}/`)) {
               return NextResponse.json({ error: 'Access denied: Invalid storage path' }, { status: 403 });
            }
        }

        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(storagePath);

        // Verify the file exists
        const [exists] = await fileRef.exists();
        if (!exists) {
            return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
        }

        // Generate permanent signed URL
        const [url] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000 // 15 mins (Fixed from permanent)
        });

        const docRef = await adminDb.collection('documents').add({
            name: originalName || fileName,
            type: 'file',
            url: url,
            mimeType: mimeType || 'application/octet-stream',
            storagePath,
            ownerId: auth.uid,
            workspaceId,
            folder,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            id: docRef.id,
            url,
            name: originalName || fileName,
            type: 'file',
            path: storagePath,
            storagePath,
            mimeType: mimeType || 'application/octet-stream',
            ownerId: auth.uid,
            folder,
            workspaceId,
            updatedAt: { seconds: Date.now() / 1000 }
        });

    } catch (error: any) {
        console.error('Register Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
