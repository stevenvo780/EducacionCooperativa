import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
            const mockContent = 'Este es un texto de prueba para la busqueda. La busqueda debe funcionar.';
            return new Response(mockContent, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        const { id } = params;
        const docSnap = await adminDb.collection('documents').doc(id).get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const data = docSnap.data() as any;
        const workspaceId = data?.workspaceId;
        if (!workspaceId || workspaceId === 'personal') {
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

        const storagePath = data?.storagePath as string | undefined;
        const url = data?.url as string | undefined;

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
    } catch (error: any) {
        console.error('Error fetching raw document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
