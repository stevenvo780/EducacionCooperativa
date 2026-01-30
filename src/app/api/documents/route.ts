import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, content, type, ownerId, workspaceId, folder, mimeType, url, storagePath } = body;
        const normalizedFolder = typeof folder === 'string' ? folder : 'No estructurado';

        const docData: Record<string, unknown> = {
            name: name || 'Sin título',
            content: content ?? '',
            type: type || 'text',
            mimeType: mimeType || null,
            ownerId: ownerId || 'unknown',
            workspaceId: workspaceId ?? 'personal',
            folder: normalizedFolder,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        if (typeof url === 'string') {
            docData.url = url;
        }

        // Sync text documents to Storage for Worker compatibility
        if (typeof storagePath === 'string') {
            docData.storagePath = storagePath;
        } else if (!storagePath && (!type || type === 'text' || type === 'markdown')) {
             try {
                 const bucket = adminStorage.bucket();
                 if (bucket.name) {
                     const safeName = (name || 'Sin titulo').replace(/[^a-zA-Z0-9.-]/g, '_');
                     const fname = safeName.endsWith('.md') ? safeName : `${safeName}.md`;

                     let path = `users/${ownerId || 'unknown'}/${fname}`;
                     if (workspaceId && workspaceId !== 'personal') {
                         path = `workspaces/${workspaceId}/${fname}`;
                     }

                     await bucket.file(path).save(content ?? '', {
                        contentType: 'text/markdown',
                        metadata: { ownerId: ownerId || 'unknown' }
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
        const { searchParams } = new URL(req.url);
        const ownerId = searchParams.get('ownerId');
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

        if (ownerId) {
            query = query.where('ownerId', '==', ownerId);
        }
        if (workspaceId) {
             query = query.where('workspaceId', '==', workspaceId);
        }

        if (!shouldIncludeContent) {
            const defaultFields = [
                'name',
                'type',
                'mimeType',
                'folder',
                'workspaceId',
                'ownerId',
                'url',
                'storagePath',
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

        return NextResponse.json(docs);
    } catch (error: any) {
        console.error('Error listing documents:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
