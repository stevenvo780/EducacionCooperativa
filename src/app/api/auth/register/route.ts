import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        // Check if user exists in Firestore
        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (!snapshot.empty) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        const hashedPassword = hashPassword(password);
        
        // Create new user document
        const newUser = {
            email,
            passwordHash: hashedPassword,
            createdAt: new Date(),
            role: 'user',
        };

        const docRef = await usersRef.add(newUser);

        return NextResponse.json({ uid: docRef.id, email: email }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating user (custom auth):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
