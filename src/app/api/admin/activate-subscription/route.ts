import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { PlanId } from '@/types/subscription';

/* eslint-disable no-console */

const ADMIN_PASSWORD = process.env.APP_PASSWORD || '';
const ENABLE_ADMIN_ENDPOINTS = process.env.ENABLE_ADMIN_ENDPOINTS === 'true';

/**
 * POST /api/admin/activate-subscription
 * Admin endpoint to manually activate a subscription for a user.
 * DISABLED in production unless ENABLE_ADMIN_ENDPOINTS=true.
 * Requires APP_PASSWORD header for authentication.
 *
 * Body: { userId: string, planId: 'basic' | 'pro' | 'enterprise', durationMonths?: number }
 */
export async function POST(req: NextRequest) {
  // Block in production unless explicitly enabled
  if (!ENABLE_ADMIN_ENDPOINTS) {
    return NextResponse.json({ error: 'Endpoint deshabilitado' }, { status: 403 });
  }

  try {
    const authHeader = req.headers.get('x-admin-password') || '';
    if (!ADMIN_PASSWORD || authHeader !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, planId, durationMonths = 1 } = body;

    if (!userId || !planId) {
      return NextResponse.json({ error: 'userId y planId son requeridos' }, { status: 400 });
    }

    const validPlans: string[] = ['free', 'basic', 'pro', 'enterprise'];
    if (!validPlans.includes(planId)) {
      return NextResponse.json({ error: `Plan inválido. Usar: ${validPlans.join(', ')}` }, { status: 400 });
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    if (planId === 'free') {
      // Reset to free plan
      await adminDb.collection('subscriptions').doc(userId).delete();
      await adminDb.collection('users').doc(userId).set({
        subscription: {
          planId: 'free',
          status: 'free'
        }
      }, { merge: true });

      console.log(`[Admin] ✅ Subscription reset to free for user ${userId}`);
      return NextResponse.json({
        success: true,
        userId,
        planId: 'free',
        status: 'free',
        message: 'Suscripción reseteada a plan gratuito'
      });
    }

    // Update subscription
    await adminDb.collection('subscriptions').doc(userId).set({
      userId,
      planId: planId as PlanId,
      status: 'active',
      mpPaymentId: `admin-manual-${Date.now()}`,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      updatedAt: now.toISOString(),
      activatedBy: 'admin'
    }, { merge: true });

    // Update user document
    await adminDb.collection('users').doc(userId).set({
      subscription: {
        planId: planId as PlanId,
        status: 'active',
        startDate: now.toISOString(),
        endDate: endDate.toISOString()
      }
    }, { merge: true });

    console.log(`[Admin] ✅ Subscription manually activated for user ${userId}, plan: ${planId}, duration: ${durationMonths} month(s)`);

    return NextResponse.json({
      success: true,
      userId,
      planId,
      status: 'active',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      message: `Suscripción al plan ${planId} activada manualmente por ${durationMonths} mes(es)`
    });
  } catch (error: any) {
    console.error('[Admin] Error activating subscription:', error?.message || error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
