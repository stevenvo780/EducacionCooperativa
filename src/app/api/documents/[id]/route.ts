import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, buildStoragePrefix, ensureMarkdownFileName, sanitizeFileName, getStorageBaseName } from '@/lib/storage-path';

const canAccessDoc = async (data: Record<string, unknown> | undefined, uid: string) => {
    const workspaceId = typeof data?.workspaceId === 'string' ? data.workspaceId : null;
    if (!workspaceId || workspaceId === 'personal') {
        return data?.ownerId === uid;
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

        const existingData = snap.data();
        if (!(await canAccessDoc(existingData as Record<string, unknown> | undefined, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const existingWorkspaceId = typeof existingData?.workspaceId === 'string' ? existingData.workspaceId : 'personal';
        const existingOwnerId = typeof existingData?.ownerId === 'string' ? existingData.ownerId : auth.uid;
        const existingFolder = typeof existingData?.folder === 'string' ? existingData.folder : undefined;
        const existingStoragePath = typeof existingData?.storagePath === 'string' ? existingData.storagePath : undefined;
        const isFileDoc = existingData?.type === 'file';

        const normalizedFolder = typeof body.folder === 'string'
            ? normalizeFolderPath(body.folder)
            : normalizeFolderPath(existingFolder);
        const nextName = typeof body.name === 'string' ? body.name : (existingData?.name as string | undefined);
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

        if (body.content !== undefined && existingData?.type !== 'file') {
            const bucket = adminStorage.bucket();
            if (bucket.name && storagePath) {
                try {
                    await bucket.file(storagePath).save(body.content, {
                        contentType: 'text/markdown',
                        metadata: { ownerId: existingOwnerId }
                    });
                } catch (e) {
                    console.warn('Failed to update storage backing:', e);
                }
            }
        }

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp()
        };

        if (body.content !== undefined && existingData?.type !== 'file') {
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

        if (storagePath && isFileDoc && storagePath !== existingData?.storagePath) {
            try {
                const bucket = adminStorage.bucket();
                if (bucket?.name) {
                    const [url] = await bucket.file(storagePath).getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 15 * 60 * 1000
                    });
                    updateData.url = url;
                }
            } catch (e) {
                console.warn('Failed to refresh file URL:', e);
            }
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
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
            const mockDoc = {
                id: params.id,
                name: 'Documento de Prueba.md',
                content: 'Este es un texto de prueba para la busqueda. La busqueda debe funcionar.',
                type: 'text',
                workspaceId: 'personal',
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
        const data = docSnap.data();
        if (!(await canAccessDoc(data as Record<string, unknown> | undefined, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.json({ id: docSnap.id, ...data });
    } catch (error: any) {
        console.error('Error fetching document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
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

        const data = snap.data() as any;
        if (!(await canAccessDoc(data as Record<string, unknown> | undefined, auth.uid))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const storagePath = data?.storagePath as string | undefined;

        // Borrar archivo de Storage si existe (tanto para files como para documentos markdown)
        if (storagePath) {
            const existing = await adminDb.collection('documents').where('storagePath', '==', storagePath).get();
            const hasOtherReferences = existing.docs.some(docItem => docItem.id !== id);
            if (!hasOtherReferences) {
                const bucket = adminStorage.bucket();
                if (bucket?.name) {
                    await bucket.file(storagePath).delete().catch((e) => console.warn('Storage delete failed', e));
                }
            }
        }

        await docRef.delete();
        return NextResponse.json({ status: 'deleted' });
    } catch (error: any) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
