import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { hashPassword } from '@/lib/crypto';
import { ensureFirebaseAuthUser, normalizeEmailAddress } from '@/lib/custom-auth';
import { getErrorMessage } from '@/lib/error-utils';

// In-memory rate limiter (simple implementation)
const rateLimit = new Map<string, { count: number; expires: number }>();
const LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 3; // Stricter for register

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
        const rawEmail = typeof email === 'string' ? email.trim() : '';
        const normalizedEmail = rawEmail ? normalizeEmailAddress(rawEmail) : '';

        if (!normalizedEmail || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const usersRef = adminDb.collection('users');
        const emailIndexRef = adminDb.collection('userEmails').doc(normalizedEmail);

        const hashedPassword = await hashPassword(password);

        const newUser = {
            email: normalizedEmail,
            emailNormalized: normalizedEmail,
            passwordHash: hashedPassword,
            displayName: normalizedEmail.split('@')[0],
            createdAt: FieldValue.serverTimestamp(),
            role: 'user'
        };

        const userDocRef = usersRef.doc();
        const userId = userDocRef.id;

        try {
            await adminDb.runTransaction(async (transaction) => {
                const indexedEmailSnap = await transaction.get(emailIndexRef);
                if (indexedEmailSnap.exists) {
                    const indexedData = indexedEmailSnap.data() as { uid?: unknown } | undefined;
                    if (typeof indexedData?.uid === 'string' && indexedData.uid.trim()) {
                        const indexedUserSnap = await transaction.get(usersRef.doc(indexedData.uid));
                        if (indexedUserSnap.exists) {
                            throw new Error('USER_ALREADY_EXISTS');
                        }
                    }
                }

                const normalizedMatches = await transaction.get(usersRef.where('emailNormalized', '==', normalizedEmail).limit(1));
                if (!normalizedMatches.empty) {
                    throw new Error('USER_ALREADY_EXISTS');
                }

                if (rawEmail && rawEmail !== normalizedEmail) {
                    const rawMatches = await transaction.get(usersRef.where('email', '==', rawEmail).limit(1));
                    if (!rawMatches.empty) {
                        throw new Error('USER_ALREADY_EXISTS');
                    }
                }

                transaction.set(userDocRef, newUser);
                transaction.set(emailIndexRef, {
                    uid: userId,
                    email: normalizedEmail,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            });
        } catch (error: unknown) {
            if (getErrorMessage(error) === 'USER_ALREADY_EXISTS') {
                return NextResponse.json({ error: 'User already exists' }, { status: 409 });
            }
            throw error;
        }

        // Personal workspace se gestiona en el cliente; evitamos duplicados en Firestore.

        try {
            await ensureFirebaseAuthUser({
                uid: userId,
                email: normalizedEmail,
                password
            });
        } catch (error) {
            await Promise.allSettled([
                userDocRef.delete(),
                emailIndexRef.delete()
            ]);
            throw error;
        }

        const customToken = await adminAuth.createCustomToken(userId, {
            userEmail: normalizedEmail
        });

        return NextResponse.json({ uid: userId, email: normalizedEmail, customToken }, { status: 201 });

    } catch (error: unknown) {
        console.error('Error creating user (custom auth):', getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
