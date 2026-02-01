import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { requireAuth } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await req.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Se requieren todos los campos' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'La nueva contraseña debe tener al menos 6 caracteres' },
                { status: 400 }
            );
        }

        const userDoc = await adminDb.collection('users').doc(auth.uid).get();

        if (!userDoc.exists) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        const userData = userDoc.data();

        const verification = await verifyPassword(currentPassword, userData?.passwordHash);
        if (!verification.ok) {
            return NextResponse.json(
                { error: 'Contraseña actual incorrecta' },
                { status: 401 }
            );
        }

        const newPasswordHash = await hashPassword(newPassword);

        await adminDb.collection('users').doc(auth.uid).update({
            passwordHash: newPasswordHash,
            updatedAt: new Date()
        });

        return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error: any) {
        console.error('Error changing password:', error);
        return NextResponse.json(
            { error: error.message || 'Error al cambiar la contraseña' },
            { status: 500 }
        );
    }
}
