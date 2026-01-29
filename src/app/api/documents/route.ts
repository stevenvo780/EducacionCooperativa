import { adminDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, content, type, ownerId, workspaceId, folder } = body;

        const docRef = await adminDb.collection('documents').add({
            name,
            content,
            type,
            ownerId,
            workspaceId,
            folder,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

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

        let query: FirebaseFirestore.Query = adminDb.collection('documents');

        if (ownerId) {
            query = query.where('ownerId', '==', ownerId);
        }
        if (workspaceId) {
             query = query.where('workspaceId', '==', workspaceId);
        }

        const snapshot = await query.get();
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json(docs);
    } catch (error: any) {
        console.error('Error listing documents:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
