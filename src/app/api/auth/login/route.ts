import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyPassword } from '@/lib/crypto';
import { getErrorMessage } from '@/lib/error-utils';

// In-memory rate limiter
const rateLimit = new Map<string, { count: number; expires: number }>();
const LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;
const MAX_RATE_LIMIT_ENTRIES = 10_000; // prevent unbounded growth under DDoS

// Periodically evict expired entries to prevent unbounded Map growth
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimit) {
        if (now > record.expires) rateLimit.delete(ip);
    }
}, LIMIT_WINDOW);

const checkRateLimit = (ip: string) => {
    const now = Date.now();
    const record = rateLimit.get(ip);
    if (record) {
        if (now > record.expires) {
            rateLimit.delete(ip);
        } else if (record.count >= MAX_ATTEMPTS) {
            return false;
        } else {
            record.count++;
            return true;
        }
    }
    // Evict oldest entries if the map is too large (DDoS protection)
    if (rateLimit.size >= MAX_RATE_LIMIT_ENTRIES) {
        const firstKey = rateLimit.keys().next().value;
        if (firstKey !== undefined) rateLimit.delete(firstKey);
    }
    rateLimit.set(ip, { count: 1, expires: now + LIMIT_WINDOW });
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

    } catch (error: unknown) {
        console.error('Error login (custom auth):', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
