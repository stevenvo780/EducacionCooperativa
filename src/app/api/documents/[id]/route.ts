import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, buildStoragePrefix, ensureMarkdownFileName, sanitizeFileName, getStorageBaseName } from '@/lib/storage-path';
import { DocumentType } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

// Throttle Firestore URL updates: max once per 50 minutes per document
const urlRefreshThrottle = new Map<string, number>();
const URL_REFRESH_THROTTLE_MS = 50 * 60 * 1000;
type StoredDocumentRecord = Record<string, unknown>;

const canAccessDoc = async (data: Record<string, unknown> | undefined, uid: string) => {
    const workspaceId = typeof data?.workspaceId === 'string' ? data.workspaceId : null;
    if (isPersonalWorkspaceId(workspaceId)) {
        return data?.ownerId === uid;
    }
    if (!workspaceId) {
        return false;
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

        const existingData = snap.data() as StoredDocumentRecord | undefined;
        if (!(await canAccessDoc(existingData, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const existingWorkspaceId = typeof existingData?.workspaceId === 'string' ? existingData.workspaceId : PERSONAL_WORKSPACE_ID;
        const existingOwnerId = typeof existingData?.ownerId === 'string' ? existingData.ownerId : auth.uid;
        const existingFolder = typeof existingData?.folder === 'string' ? existingData.folder : undefined;
        const existingStoragePath = typeof existingData?.storagePath === 'string' ? existingData.storagePath : undefined;
        const isFileDoc = existingData?.type === DocumentType.File;

        const normalizedFolder = typeof body.folder === 'string'
            ? normalizeFolderPath(body.folder)
            : normalizeFolderPath(existingFolder);
        const existingName = typeof existingData?.name === 'string' ? existingData.name : undefined;
        const nextName = typeof body.name === 'string' ? body.name : existingName;
        const nextFileName = isFileDoc
            ? sanitizeFileName(nextName || 'archivo')
            : ensureMarkdownFileName(nextName || 'Sin titulo');

        let storagePath = existingStoragePath;
        let targetStoragePath = storagePath;
        if (storagePath) {
            const baseName = typeof body.name === 'string' ? nextFileName : getStorageBaseName(storagePath);
            const prefix = buildStoragePrefix(existingWorkspaceId, existingOwnerId);
            targetStoragePath = `${prefix}/${normalizedFolder}/${baseName}`;
        } else if (body.content !== undefined && !isFileDoc) {
            targetStoragePath = buildStoragePath({
                workspaceId: existingWorkspaceId,
                ownerId: existingOwnerId,
                folder: normalizedFolder,
                fileName: nextFileName
            });
        }

        const moveStorageObject = async (fromPath: string, toPath: string) => {
            const bucket = adminStorage.bucket();
            if (!bucket?.name) {
                throw new Error('Storage bucket not configured');
            }
            const sourceRef = bucket.file(fromPath);
            const targetRef = bucket.file(toPath);
            const [sourceExists] = await sourceRef.exists();
            const [targetExists] = await targetRef.exists();

            if (!sourceExists && targetExists) {
                return { moved: true, usedTarget: true };
            }
            if (!sourceExists && !targetExists) {
                return { moved: false, missing: true };
            }
            if (targetExists) {
                const [srcMeta] = await sourceRef.getMetadata();
                const [dstMeta] = await targetRef.getMetadata();
                const hasHash = Boolean(srcMeta.md5Hash && dstMeta.md5Hash);
                if (hasHash && srcMeta.md5Hash !== dstMeta.md5Hash) {
                    return { moved: false, conflict: true };
                }
                const hasSize = Boolean(srcMeta.size && dstMeta.size);
                if (!hasHash && hasSize && srcMeta.size !== dstMeta.size) {
                    return { moved: false, conflict: true };
                }
                await sourceRef.delete().catch(() => {});
                return { moved: true, deduped: true };
            }

            await sourceRef.copy(targetRef);
            const [afterExists] = await targetRef.exists();
            if (!afterExists) {
                return { moved: false, missing: true };
            }
            await sourceRef.delete().catch(() => {});
            return { moved: true };
        };

        if (storagePath && targetStoragePath && storagePath !== targetStoragePath) {
            const moveResult = await moveStorageObject(storagePath, targetStoragePath);
            if (moveResult.conflict) {
                return NextResponse.json({ error: 'Storage target already exists' }, { status: 409 });
            }
            if (moveResult.moved) {
                storagePath = targetStoragePath;
            }
        } else if (!storagePath && targetStoragePath) {
            storagePath = targetStoragePath;
        }

        if (body.content !== undefined && existingData?.type !== DocumentType.File) {
            const bucket = adminStorage.bucket();
            if (bucket.name && storagePath) {
                try {
                    await bucket.file(storagePath).save(body.content, {
                        contentType: 'text/markdown',
                        metadata: { ownerId: existingOwnerId }
                    });
                } catch (error) {
                    console.warn('Failed to update storage backing:', getErrorMessage(error));
                }
            }
        }

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp()
        };

        if (body.content !== undefined && existingData?.type !== DocumentType.File) {
            updateData.content = body.content;
            updateData.lastUpdatedBy = auth.uid;
        }
        if (typeof body.name === 'string') updateData.name = body.name;
        if (typeof body.type === 'string') updateData.type = body.type;
        if (typeof body.mimeType === 'string' || body.mimeType === null) updateData.mimeType = body.mimeType ?? null;
        if (typeof body.folder === 'string') updateData.folder = normalizeFolderPath(body.folder);
        if (typeof body.size === 'number') updateData.size = body.size;
        if (typeof body.order === 'number') updateData.order = body.order;

        if (storagePath && storagePath !== existingData?.storagePath) {
            updateData.storagePath = storagePath;
        }

        const shouldRefreshFileUrl = Boolean(
            storagePath
            && isFileDoc
            && (
                storagePath !== existingData?.storagePath
                || body.refreshUrl === true
                || typeof body.mimeType === 'string'
                || typeof body.size === 'number'
            )
        );

        if (storagePath && shouldRefreshFileUrl) {
            try {
                const bucket = adminStorage.bucket();
                if (bucket?.name) {
                    const [url] = await bucket.file(storagePath).getSignedUrl({
                        action: 'read' as const,
                        expires: Date.now() + 60 * 60 * 1000 // 1 hour
                    });
                    updateData.url = url;
                }
            } catch (error) {
                console.warn('Failed to refresh file URL:', getErrorMessage(error));
            }
        }

        await docRef.update(updateData);

        return NextResponse.json({ status: 'success' });
    } catch (error: unknown) {
        console.error('Error updating document:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
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
                type: DocumentType.Text,
                workspaceId: PERSONAL_WORKSPACE_ID,
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
        const data = (docSnap.data() ?? {}) as StoredDocumentRecord;
        if (!(await canAccessDoc(data, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Refresh signed URL for file-type documents so viewers never get ExpiredToken errors.
        // Throttle Firestore writes to at most once per 50 min per document.
        if (data.type === DocumentType.File && typeof data.storagePath === 'string') {
            try {
                const bucket = adminStorage.bucket();
                if (bucket?.name) {
                    const [freshUrl] = await bucket.file(data.storagePath).getSignedUrl({
                        action: 'read' as const,
                        expires: Date.now() + 60 * 60 * 1000 // 1 hour
                    });
                    data.url = freshUrl;
                    const lastRefresh = urlRefreshThrottle.get(id) ?? 0;
                    if (Date.now() - lastRefresh > URL_REFRESH_THROTTLE_MS) {
                        urlRefreshThrottle.set(id, Date.now());
                        adminDb.collection('documents').doc(id).update({ url: freshUrl }).catch(() => {});
                    }
                }
            } catch (error) {
                console.warn('Failed to refresh signed URL on GET:', getErrorMessage(error));
            }
        }

        return NextResponse.json({ id: docSnap.id, ...data });
    } catch (error: unknown) {
        console.error('Error fetching document:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
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

        const data = snap.data() as StoredDocumentRecord | undefined;
        if (!(await canAccessDoc(data, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const storagePath = typeof data?.storagePath === 'string' ? data.storagePath : undefined;

        // Borrar archivo de Storage si existe (tanto para files como para documentos markdown)
        if (storagePath) {
            // count() evita cargar documentos en memoria — solo verifica si hay referencias adicionales
            const countSnap = await adminDb.collection('documents')
                .where('storagePath', '==', storagePath)
                .where(FieldPath.documentId(), '!=', id)
                .count()
                .get();
            const hasOtherReferences = countSnap.data().count > 0;
            if (!hasOtherReferences) {
                const bucket = adminStorage.bucket();
                if (bucket?.name) {
                    await bucket.file(storagePath).delete().catch((error) => console.warn('Storage delete failed', getErrorMessage(error)));
                }
            }
        }

        await docRef.delete();
        return NextResponse.json({ status: 'deleted' });
    } catch (error: unknown) {
        console.error('Error deleting document:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
