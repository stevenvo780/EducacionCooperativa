import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { DocumentType } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

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
            workspaceId = PERSONAL_WORKSPACE_ID,
            folder = 'No estructurado'
        } = body as {
            storagePath?: string;
            fileName?: string;
            originalName?: string;
            mimeType?: string;
            workspaceId?: string;
            folder?: string;
        };

        if (!storagePath || !fileName) {
            return NextResponse.json({ error: 'storagePath and fileName required' }, { status: 400 });
        }

        // Validate storagePath prefix ownership
        if (isPersonalWorkspaceId(workspaceId)) {
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
            action: 'read' as const,
            expires: Date.now() + 60 * 60 * 1000 // 1 hour (refreshed on every GET)
        });

        const docRef = await adminDb.collection('documents').add({
            name: originalName || fileName,
            type: DocumentType.File,
            url,
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
            type: DocumentType.File,
            path: storagePath,
            storagePath,
            mimeType: mimeType || 'application/octet-stream',
            ownerId: auth.uid,
            folder,
            workspaceId,
            updatedAt: { seconds: Date.now() / 1000 }
        });

    } catch (error: unknown) {
        console.error('Register Upload Error:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
