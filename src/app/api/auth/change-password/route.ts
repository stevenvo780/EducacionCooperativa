import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { hashPassword } from '@/lib/crypto';

export async function POST(req: NextRequest) {
    try {
        const { uid, currentPassword, newPassword } = await req.json();

        if (!uid || !currentPassword || !newPassword) {
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

        const userDoc = await adminDb.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        const userData = userDoc.data();

        // Verificar contraseña actual
        const currentHash = hashPassword(currentPassword);
        if (currentHash !== userData?.passwordHash) {
            return NextResponse.json(
                { error: 'Contraseña actual incorrecta' },
                { status: 401 }
            );
        }

        // Hash de la nueva contraseña
        const newPasswordHash = hashPassword(newPassword);

        // Actualizar en Firestore
        await adminDb.collection('users').doc(uid).update({
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
