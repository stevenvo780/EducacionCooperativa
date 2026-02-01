export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

const hasFirestoreCredentials = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_PROJECT_ID
);

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (!auth) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasFirestoreCredentials) {
        return NextResponse.json(
            { error: 'Firestore credentials are not configured' },
            { status: 503 }
        );
    }

    try {
        await adminDb.collection('test_connection').add({
            timestamp: new Date(),
            msg: 'Hello Firestore'
        });
        return NextResponse.json({ status: 'ok', msg: 'Firestore write success' });
    } catch (error: any) {
        console.error('Firestore Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
