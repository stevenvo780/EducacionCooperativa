import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { calculateOwnedStorageUsageBytes } from '@/lib/storage-usage';
import { formatStorageSize, getStorageLimitMB } from '@/types/subscription';
import { DocumentType } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';
import { getActivePlanId } from '@/app/api/payments/helpers';

export const runtime = 'nodejs';

type StoredDocumentRecord = Record<string, unknown>;
type RouteContext = { params: Promise<{ id: string }> };

const canAccessDoc = async (data: Record<string, unknown> | undefined, uid: string) => {
  const workspaceId = typeof data?.workspaceId === 'string' ? data.workspaceId : PERSONAL_WORKSPACE_ID;
  if (isPersonalWorkspaceId(workspaceId)) {
    return data?.ownerId === uid;
  }
  return isWorkspaceMember(workspaceId, uid);
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;

    const body = await req.json();
    const mimeType = typeof body.mimeType === 'string' && body.mimeType.trim()
      ? body.mimeType.trim()
      : 'application/octet-stream';
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : NaN;

    if (!Number.isFinite(fileSize) || fileSize < 0) {
      return NextResponse.json({ error: 'fileSize must be a non-negative number' }, { status: 400 });
    }

    const docRef = adminDb.collection('documents').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const data = (snap.data() ?? {}) as StoredDocumentRecord;
    if (!(await canAccessDoc(data, auth.uid))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (data.type !== DocumentType.File) {
      return NextResponse.json({ error: 'Only file documents support binary replacement' }, { status: 400 });
    }

    const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
    if (!storagePath) {
      return NextResponse.json({ error: 'Document has no storage path' }, { status: 400 });
    }

    const bucket = adminStorage.bucket();
    if (!bucket?.name) {
      throw new Error('Storage bucket not configured');
    }

    const fileRef = bucket.file(storagePath);
    const [exists] = await fileRef.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Stored file not found' }, { status: 404 });
    }

    const [metadata] = await fileRef.getMetadata();
    const currentSize = parseInt(String(metadata.size || data.size || '0'), 10) || 0;
    const ownerId = typeof data.ownerId === 'string' ? data.ownerId : auth.uid;
    const planId = await getActivePlanId(ownerId);
    const limitMB = getStorageLimitMB(planId);
    const limitBytes = limitMB * 1024 * 1024;
    const currentUsageBytes = await calculateOwnedStorageUsageBytes(ownerId);
    const projectedBytes = Math.max(0, currentUsageBytes - currentSize) + fileSize;

    if (projectedBytes > limitBytes) {
      const usedMB = Math.round((currentUsageBytes / (1024 * 1024)) * 100) / 100;
      return NextResponse.json({
        error: `Límite de almacenamiento alcanzado. Usas ${formatStorageSize(usedMB)} de ${formatStorageSize(limitMB)}. Mejora tu plan para guardar esta versión.`,
        code: 'STORAGE_LIMIT_EXCEEDED',
        usedMB,
        limitMB
      }, { status: 413 });
    }

    const [signedUrl] = await fileRef.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: mimeType
    });

    return NextResponse.json({
      signedUrl,
      storagePath,
      mimeType,
      currentSize
    });
  } catch (error: unknown) {
    console.error('Document upload URL error:', getErrorMessage(error));
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
