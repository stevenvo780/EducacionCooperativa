import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, ensureTextFileName } from '@/lib/storage-path';
import { DocumentType } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';
import { mockCreateDoc, mockListDocs } from '@/lib/insecure-mock-store';

const isInsecure = process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (isInsecure) {
            const body = (await req.json()) as Record<string, unknown>;
            const folder = normalizeFolderPath(typeof body.folder === 'string' ? body.folder : undefined);
            const doc = mockCreateDoc({
                name: typeof body.name === 'string' && body.name.trim() ? body.name : 'Sin titulo',
                content: typeof body.content === 'string' ? body.content : '',
                type: typeof body.type === 'string' ? body.type : DocumentType.Text,
                workspaceId: typeof body.workspaceId === 'string' && body.workspaceId ? body.workspaceId : PERSONAL_WORKSPACE_ID,
                folder,
                ownerId: auth.uid,
                mimeType: typeof body.mimeType === 'string' ? body.mimeType : null,
                order: typeof body.order === 'number' ? body.order : undefined
            });
            return NextResponse.json({ id: doc.id, status: 'success' });
        }

        const body = (await req.json()) as Record<string, unknown>;
        const { name, content, type, workspaceId, folder, mimeType, url, storagePath, order } = body;
        const normalizedFolder = normalizeFolderPath(typeof folder === 'string' ? folder : undefined);
        const resolvedWorkspaceId = typeof workspaceId === 'string' && workspaceId ? workspaceId : PERSONAL_WORKSPACE_ID;
        const ownerId = auth.uid;
        const docName = typeof name === 'string' && name.trim() ? name : 'Sin titulo';
        const docContent = typeof content === 'string' ? content : '';
        const docType = typeof type === 'string' ? type : DocumentType.Text;

        if (!isPersonalWorkspaceId(resolvedWorkspaceId)) {
            const member = await isWorkspaceMember(resolvedWorkspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const docData: Record<string, unknown> = {
            name: docName,
            content: docContent,
            type: docType,
            mimeType: mimeType || null,
            ownerId,
            workspaceId: resolvedWorkspaceId,
            folder: normalizedFolder,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };
        if (typeof order === 'number') {
            docData.order = order;
        }

        const allowedPrefix = isPersonalWorkspaceId(resolvedWorkspaceId)
            ? `users/${ownerId}/`
            : `workspaces/${resolvedWorkspaceId}/`;

        if (typeof storagePath === 'string') {
            if (!storagePath.startsWith(allowedPrefix)) {
                return NextResponse.json({ error: 'Invalid storagePath' }, { status: 403 });
            }
            docData.storagePath = storagePath;
        }

        if (typeof url === 'string' && docData.storagePath) {
            docData.url = url;
        } else if (!storagePath && (docType === DocumentType.Text || docType === 'markdown')) {
             try {
                 const bucket = adminStorage.bucket();
                 if (bucket.name) {
                     const fname = ensureTextFileName(docName);
                     const storagePath_ = buildStoragePath({
                        workspaceId: resolvedWorkspaceId,
                        ownerId,
                        folder: normalizedFolder,
                        fileName: fname
                     });

                     // Determinar contentType según extensión real
                     const storageExt = (fname.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase();
                     const isMarkdownStorage = storageExt === '.md' || storageExt === '.markdown';
                     const storageContentType = isMarkdownStorage ? 'text/markdown' : (
                        typeof mimeType === 'string' && mimeType ? mimeType : 'text/plain'
                     );

                     await bucket.file(storagePath_).save(docContent, {
                        contentType: storageContentType,
                        metadata: { ownerId }
                     });

                     docData.storagePath = storagePath_;
                 }
             } catch (error) {
                 console.warn('Failed to sync document to storage:', getErrorMessage(error));
             }
        }

        const docRef = await adminDb.collection('documents').add(docData);

        return NextResponse.json({ id: docRef.id, status: 'success' });
    } catch (error: unknown) {
        console.error('Error creating document:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (isInsecure) {
            const { searchParams } = new URL(req.url);
            const workspaceId = searchParams.get('workspaceId') || undefined;
            const all = mockListDocs({
                workspaceId: workspaceId || undefined,
                ownerId: auth.uid
            });
            return NextResponse.json(all, {
                headers: { 'Cache-Control': 'no-store' }
            });
        }

        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');
        const view = searchParams.get('view');
        const includeContentParam = searchParams.get('includeContent');
        const excludeContentParam = searchParams.get('excludeContent');
        const fieldsParam = searchParams.get('fields');

        const parseBoolean = (value: string | null) => value === '1' || value === 'true' || value === 'yes';
        const shouldIncludeContent = (() => {
            if (excludeContentParam && parseBoolean(excludeContentParam)) return false;
            if (view === 'metadata' || view === 'list') return false;
            if (includeContentParam !== null) return parseBoolean(includeContentParam);
            if (view === 'full') return true;
            return true;
        })();

        let query: FirebaseFirestore.Query = adminDb.collection('documents');

        if (workspaceId && !isPersonalWorkspaceId(workspaceId)) {
            const member = await isWorkspaceMember(workspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            query = query.where('workspaceId', '==', workspaceId);
        } else {
            query = query.where('ownerId', '==', auth.uid);
            if (workspaceId === PERSONAL_WORKSPACE_ID) {
                query = query.where('workspaceId', '==', PERSONAL_WORKSPACE_ID);
            }
        }

        if (!shouldIncludeContent) {
            const defaultFields = [
                'name',
                'type',
                'mimeType',
                'folder',
                'workspaceId',
                'ownerId',
                'order',
                'url',
                'storagePath',
                'sourceName',
                'sourceMimeType',
                'sourceStoragePath',
                'sourceUrl',
                'sourceFormat',
                'updatedAt',
                'createdAt',
                'size'
            ];
            const fields = fieldsParam
                ? fieldsParam.split(',').map(part => part.trim()).filter(Boolean)
                : defaultFields;
            const uniqueFields = Array.from(new Set(fields));
            if (uniqueFields.length > 0) {
                query = query.select(...uniqueFields);
            }
        }

        const limitParam = searchParams.get('limit');
        const offsetParam = searchParams.get('offset');
        const limitVal = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 1000) : 1000;
        const snapshot = await query.limit(limitVal).get();
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
        if (offsetParam) {
            const offsetVal = Math.max(0, parseInt(offsetParam, 10));
            docs = docs.slice(offsetVal);
        }

        // Para vistas de solo metadatos, permitir stale-while-revalidate para reducir
        // lecturas de Firestore. Para vistas con contenido, mantener sin cache.
        const cacheControl = (view === 'metadata' || view === 'list')
            ? 'private, max-age=0, stale-while-revalidate=5'
            : 'no-store, no-cache, must-revalidate, proxy-revalidate';

        return NextResponse.json(docs, {
            headers: { 'Cache-Control': cacheControl }
        });
    } catch (error: unknown) {
        console.error('Error listing documents:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
