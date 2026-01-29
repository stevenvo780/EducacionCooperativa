import { adminDb } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;
    const encoder = new TextEncoder();

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
