import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyPassword } from '@/lib/crypto';

// In-memory rate limiter (simple implementation)
const rateLimit = new Map<string, { count: number; expires: number }>();
const LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;

const checkRateLimit = (ip: string) => {
    const record = rateLimit.get(ip);
    if (record) {
        if (Date.now() > record.expires) {
            rateLimit.delete(ip);
        } else if (record.count >= MAX_ATTEMPTS) {
            return false;
        } else {
            record.count++;
            return true;
        }
    }
    rateLimit.set(ip, { count: 1, expires: Date.now() + LIMIT_WINDOW });
    return true;
};

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(ip)) {
            return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
        }

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

        const verification = await verifyPassword(password, userData?.passwordHash);

        if (!verification.ok) {
             return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        if (verification.needsUpgrade && verification.newHash) {
            await userDoc.ref.update({
                passwordHash: verification.newHash,
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        const customToken = await adminAuth.createCustomToken(userDoc.id, {
            userEmail: userData.email
        });

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
