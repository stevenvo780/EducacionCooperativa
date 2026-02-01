import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { hashPassword } from '@/lib/crypto';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (snapshot.empty) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        const hashedPassword = hashPassword(password);

        if (userData.passwordHash !== hashedPassword) {
             return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Generate a custom token for the user to authenticate with the Hub
        const customToken = await adminAuth.createCustomToken(userDoc.id);

        return NextResponse.json({
            uid: userDoc.id,
            email: userData.email,
            displayName: userData.displayName || 'User',
            photoURL: userData.photoURL || null,
            customToken
        }, { status: 200 });

    } catch (error: any) {
        console.error('Error login (custom auth):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
