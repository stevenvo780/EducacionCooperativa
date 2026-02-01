import { adminDb } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAuth(req);
    if (!auth) {
        return new Response('No autorizado', { status: 401 });
    }

    const { id } = params;
    const encoder = new TextEncoder();

    const docSnap = await adminDb.collection('documents').doc(id).get();
    if (!docSnap.exists) {
        return new Response('Document not found', { status: 404 });
    }
    const data = docSnap.data() as Record<string, unknown>;
    const workspaceId = typeof data?.workspaceId === 'string' ? data.workspaceId : null;
    if (!workspaceId || workspaceId === 'personal') {
        if (data?.ownerId !== auth.uid) {
            return new Response('Forbidden', { status: 403 });
        }
    } else {
        const member = await isWorkspaceMember(workspaceId, auth.uid);
        if (!member) {
            return new Response('Forbidden', { status: 403 });
        }
    }

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (payload: unknown) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            };

            const keepAlive = setInterval(() => {
                controller.enqueue(encoder.encode(': keep-alive\n\n'));
            }, 15000);

            send({ type: 'connected' });

            const docRef = adminDb.collection('documents').doc(id);
            const unsubscribe = docRef.onSnapshot((snap) => {
                if (!snap.exists) {
                    send({ type: 'deleted' });
                    return;
                }
                send({ type: 'snapshot', data: { id: snap.id, ...snap.data() } });
            }, (error) => {
                send({ type: 'error', error: error.message });
            });

            const close = () => {
                clearInterval(keepAlive);
                unsubscribe();
                controller.close();
            };

            req.signal.addEventListener('abort', close);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive'
        }
    });
}
