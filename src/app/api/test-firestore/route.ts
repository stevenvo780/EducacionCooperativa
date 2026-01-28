import { adminDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
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
