import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, sanitizeFileName } from '@/lib/storage-path';
import { DocumentType } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

// Limit uploads to 50 MB and force Node runtime (edge has smaller limits)
export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const formData = await req.formData();
        const fileEntry = formData.get('file');
        const ownerId = auth.uid;
        const workspaceIdEntry = formData.get('workspaceId');
        const workspaceId = typeof workspaceIdEntry === 'string' && workspaceIdEntry.trim()
            ? workspaceIdEntry
            : PERSONAL_WORKSPACE_ID;
        const folderField = formData.get('folder');
        const folder = normalizeFolderPath(typeof folderField === 'string' ? folderField : undefined);

        if (!(fileEntry instanceof File)) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        const file = fileEntry;

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'El archivo supera el límite de 50MB' }, { status: 413 });
        }

        if (!isPersonalWorkspaceId(workspaceId)) {
            const member = await isWorkspaceMember(workspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const safeName = sanitizeFileName(file.name);
        const filename = buildStoragePath({
            workspaceId,
            ownerId,
            folder,
            fileName: safeName
        });

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
            action: 'read' as const,
            expires: Date.now() + 60 * 60 * 1000 // 1 hour (refreshed on every GET)
        });

        const docRef = await adminDb.collection('documents').add({
            name: file.name,
            type: 'file',
            url,
            mimeType: file.type,
            storagePath: filename,
            size: file.size,
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
            type: DocumentType.File,
            path: filename,
            storagePath: filename,
            mimeType: file.type,
            ownerId,
            folder,
            size: file.size,
            updatedAt: { seconds: Date.now() / 1000 }
        });

    } catch (error: unknown) {
        console.error('Upload Error:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
