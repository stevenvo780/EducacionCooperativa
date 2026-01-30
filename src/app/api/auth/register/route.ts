import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { hashPassword } from '@/lib/crypto';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
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
            displayName: email.split('@')[0],
            createdAt: FieldValue.serverTimestamp(),
            role: 'user',
        };

        const userDocRef = await usersRef.add(newUser);
        const userId = userDocRef.id;

        // Create default personal workspace for the user
        const workspaceData = {
            name: 'Mi Espacio',
            ownerId: userId,
            members: [userId],
            pendingInvites: [],
            type: 'personal',
            createdAt: FieldValue.serverTimestamp(),
        };

        await adminDb.collection('workspaces').add(workspaceData);

        return NextResponse.json({ uid: userId, email: email }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating user (custom auth):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
