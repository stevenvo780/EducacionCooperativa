import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, sanitizeFileName } from '@/lib/storage-path';

export const runtime = 'nodejs';

/**
 * Generates a signed URL for direct client-side upload to Firebase Storage
 * This bypasses Vercel's 4.5MB body limit by uploading directly to GCS
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { fileName, mimeType, workspaceId = 'personal', folder = 'No estructurado' } = body;

        if (!fileName || !mimeType) {
            return NextResponse.json({ error: 'fileName and mimeType required' }, { status: 400 });
        }

        if (workspaceId !== 'personal') {
            const member = await isWorkspaceMember(workspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const safeName = sanitizeFileName(fileName);
        const normalizedFolder = normalizeFolderPath(folder);
        const storagePath = buildStoragePath({
            workspaceId,
            ownerId: auth.uid,
            folder: normalizedFolder,
            fileName: safeName
        });

        const bucket = adminStorage.bucket();
        if (!bucket?.name) {
            throw new Error('Storage bucket not configured');
        }

        const fileRef = bucket.file(storagePath);

        // Generate signed URL for resumable upload (supports large files)
        const [signedUrl] = await fileRef.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType: mimeType
        });

        return NextResponse.json({
            signedUrl,
            storagePath,
            fileName: safeName,
            originalName: fileName,
            mimeType,
            workspaceId,
            folder: normalizedFolder,
            ownerId: auth.uid
        });

    } catch (error: any) {
        console.error('Signed URL Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
