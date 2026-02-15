import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import type { UserSubscription } from '@/types/subscription';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const snap = await adminDb.collection('subscriptions').doc(auth.uid).get();

    if (!snap.exists) {
      return NextResponse.json({
        subscription: {
          userId: auth.uid,
          planId: 'free',
          status: 'free',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as UserSubscription
      });
    }

    const data = snap.data() as UserSubscription;

    // Verificar si la suscripción ha expirado
    if (data.status === 'active' && data.endDate) {
      const endDate = new Date(data.endDate);
      if (endDate < new Date()) {
        // Suscripción expirada
        await adminDb.collection('subscriptions').doc(auth.uid).update({
          status: 'expired',
          updatedAt: new Date().toISOString()
        });
        data.status = 'expired';
      }
    }

    return NextResponse.json({ subscription: data });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener suscripción' },
      { status: 500 }
    );
  }
}
