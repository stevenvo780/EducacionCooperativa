import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, ensureMarkdownFileName } from '@/lib/storage-path';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
             const body = await req.json();
             return NextResponse.json({ id: 'mock-doc-' + Date.now(), status: 'success' });
        }

        const body = await req.json();
        const { name, content, type, workspaceId, folder, mimeType, url, storagePath, order } = body;
        const normalizedFolder = normalizeFolderPath(typeof folder === 'string' ? folder : undefined);
        const resolvedWorkspaceId = typeof workspaceId === 'string' && workspaceId ? workspaceId : 'personal';
        const ownerId = auth.uid;

        if (resolvedWorkspaceId !== 'personal') {
            const member = await isWorkspaceMember(resolvedWorkspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const docData: Record<string, unknown> = {
            name: name || 'Sin título',
            content: content ?? '',
            type: type || 'text',
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

        const allowedPrefix = resolvedWorkspaceId === 'personal'
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
        } else if (!storagePath && (!type || type === 'text' || type === 'markdown')) {
             try {
                 const bucket = adminStorage.bucket();
                 if (bucket.name) {
                     const fname = ensureMarkdownFileName(name || 'Sin titulo');
                     const path = buildStoragePath({
                        workspaceId: resolvedWorkspaceId,
                        ownerId,
                        folder: normalizedFolder,
                        fileName: fname
                     });

                     await bucket.file(path).save(content ?? '', {
                        contentType: 'text/markdown',
                        metadata: { ownerId }
                     });

                     docData.storagePath = path;
                 }
             } catch (err) {
                 console.warn('Failed to sync document to storage:', err);
             }
        }

        const docRef = await adminDb.collection('documents').add(docData);

        return NextResponse.json({ id: docRef.id, status: 'success' });
    } catch (error: any) {
        console.error('Error creating document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
             return NextResponse.json([{
                     id: 'mock-doc-1',
                     name: 'Documento de Prueba.md',
                     content: 'Este es un texto de prueba para la busqueda. La busqueda debe funcionar.',
                     type: 'text',
                     workspaceId: 'personal',
                     folder: 'No estructurado',
                     updatedAt: { seconds: Date.now() / 1000 },
                     createdAt: { seconds: Date.now() / 1000 },
                     ownerId: auth.uid
             }]);
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

        if (workspaceId && workspaceId !== 'personal') {
            const member = await isWorkspaceMember(workspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            query = query.where('workspaceId', '==', workspaceId);
        } else {
            query = query.where('ownerId', '==', auth.uid);
            if (workspaceId === 'personal') {
                query = query.where('workspaceId', '==', 'personal');
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

        const snapshot = await query.get();
        const docs = snapshot.docs.map(doc => {
            const data = doc.data() as Record<string, unknown>;
            if (!shouldIncludeContent && Object.prototype.hasOwnProperty.call(data, 'content')) {
                delete data.content;
            }
            return { id: doc.id, ...data };
        });

        return NextResponse.json(docs, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
            }
        });
    } catch (error: any) {
        console.error('Error listing documents:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
