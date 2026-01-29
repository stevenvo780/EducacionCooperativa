import { adminDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const body = await req.json();
        
        // Remove undefined fields if necessary, but JSON updates usually are explicit
        const updateData = {
            ...body,
            updatedAt: new Date(),
        };

        // If serverTimestamp was anticipated, use new Date() as firebase-admin deals well with Dates or field values
        // For simplicity, new Date() is fine.

        await adminDb.collection('documents').doc(id).update(updateData);

        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
        console.error('Error updating document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const docSnap = await adminDb.collection('documents').doc(id).get();
        if (!docSnap.exists) {
             return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
    } catch (error: any) {
        console.error('Error fetching document:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
