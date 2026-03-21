import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';
import { mockGetDoc } from '@/lib/insecure-mock-store';

type StoredDocumentRecord = Record<string, unknown>;
const isInsecure = process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true';
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id } = await context.params;

        if (isInsecure) {
            const doc = mockGetDoc(id);
            const content = doc?.content ?? '';
            return new Response(content, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        const docSnap = await adminDb.collection('documents').doc(id).get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const data = (docSnap.data() ?? {}) as StoredDocumentRecord;
        const workspaceId = data?.workspaceId;
        if (typeof workspaceId !== 'string' || isPersonalWorkspaceId(workspaceId)) {
            if (data?.ownerId !== auth.uid) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else {
            const member = await isWorkspaceMember(workspaceId, auth.uid);
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }
        if (typeof data?.content === 'string' && data.content.length > 0) {
            return new Response(data.content, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        const storagePath = typeof data.storagePath === 'string' ? data.storagePath : undefined;
        const url = typeof data.url === 'string' ? data.url : undefined;

        if (storagePath) {
            const bucket = adminStorage.bucket();
            if (!bucket?.name) {
                throw new Error('Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID');
            }
            const file = bucket.file(storagePath);
            const [buffer] = await file.download();
            const mimeType = data?.mimeType || 'text/plain';
            const body = new Uint8Array(buffer);
            return new Response(body, {
                headers: { 'Content-Type': `${mimeType}; charset=utf-8` }
            });
        }

        if (url) {
            let parsed: URL;
            try {
                parsed = new URL(url);
            } catch {
                return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
            }

            const host = parsed.host.toLowerCase();
            const isAllowedHost = host === 'firebasestorage.googleapis.com' || host.endsWith('.storage.googleapis.com');
            if (parsed.protocol !== 'https:' || !isAllowedHost) {
                return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
            }

            const upstream = await fetch(url);
            if (!upstream.ok) {
                return NextResponse.json({ error: 'Failed to fetch file' }, { status: 502 });
            }
            const text = await upstream.text();
            const mimeType = data?.mimeType || 'text/plain';
            return new Response(text, {
                headers: { 'Content-Type': `${mimeType}; charset=utf-8` }
            });
        }

        return NextResponse.json({ error: 'No content available' }, { status: 404 });
    } catch (error: unknown) {
        console.error('Error fetching raw document:', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
