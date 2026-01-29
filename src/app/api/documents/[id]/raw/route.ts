import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const docSnap = await adminDb.collection('documents').doc(id).get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const data = docSnap.data() as any;
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
