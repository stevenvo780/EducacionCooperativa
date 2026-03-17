import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, sanitizeFileName } from '@/lib/storage-path';
import { formatStorageSize, getStorageLimitMB, type PlanId } from '@/types/subscription';

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

        // Check storage limit for the user's plan
        const subSnap = await adminDb.collection('subscriptions').doc(auth.uid).get();
        let planId: PlanId = 'free';
        if (subSnap.exists) {
            const subData = subSnap.data();
            if (subData?.status === 'active' && subData?.planId) {
                planId = subData.planId as PlanId;
            }
        }
        const limitMB = getStorageLimitMB(planId);
        const limitBytes = limitMB * 1024 * 1024;

        // Calculate current usage
        const bucket = adminStorage.bucket();
        const userPrefix = `users/${auth.uid}/`;
        const [existingFiles] = await bucket.getFiles({ prefix: userPrefix });
        let totalBytes = 0;
        for (const f of existingFiles) {
            const [meta] = await f.getMetadata();
            totalBytes += parseInt(meta.size as string, 10) || 0;
        }

        // Estimate new file size from Content-Length hint (client should send fileSize)
        const fileSize = body.fileSize || 0;
        if (totalBytes + fileSize > limitBytes) {
            const usedMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
            return NextResponse.json({
                error: `Límite de almacenamiento alcanzado. Usas ${formatStorageSize(usedMB)} de ${formatStorageSize(limitMB)}. Mejora tu plan para subir más archivos.`,
                code: 'STORAGE_LIMIT_EXCEEDED',
                usedMB,
                limitMB
            }, { status: 413 });
        }

        const safeName = sanitizeFileName(fileName);
        const normalizedFolder = normalizeFolderPath(folder);
        const storagePath = buildStoragePath({
            workspaceId,
            ownerId: auth.uid,
            folder: normalizedFolder,
            fileName: safeName
        });

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
