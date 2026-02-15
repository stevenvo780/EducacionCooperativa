import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { adminDb } from '@/lib/firebase-admin';
import type { PlanId } from '@/types/subscription';

/* eslint-disable no-console */

const mpAccessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const externalReference = searchParams.get('external_reference') || '';
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id') || '';
  const [userId, planId] = externalReference.split('|');

  const appUrl = 'https://agora.humanizar.cloud';
  const redirectUrl = new URL(`${appUrl}/dashboard`);
  redirectUrl.searchParams.set('payment', 'pending');
  if (planId) redirectUrl.searchParams.set('plan', planId);

  // Verify payment - it might already be approved by the time callback fires
  try {
    if (paymentId && paymentId !== 'null' && userId && planId) {
      console.log(`[Callback/Pending] Processing payment ${paymentId} for user ${userId}, plan: ${planId}`);

      const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
      const paymentClient = new Payment(client);
      const payment = await paymentClient.get({ id: Number(paymentId) });

      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      if (payment.status === 'approved') {
        // Payment was actually approved! Activate it
        await adminDb.collection('subscriptions').doc(userId).set({
          userId,
          planId: planId as PlanId,
          status: 'active',
          mpPaymentId: String(paymentId),
          mpMerchantOrderId: payment.order?.id ? String(payment.order.id) : null,
          startDate: now.toISOString(),
          endDate: endDate.toISOString(),
          updatedAt: now.toISOString()
        }, { merge: true });

        await adminDb.collection('users').doc(userId).set({
          subscription: {
            planId: planId as PlanId,
            status: 'active',
            startDate: now.toISOString(),
            endDate: endDate.toISOString()
          }
        }, { merge: true });

        console.log(`[Callback/Pending] ✅ Payment was actually approved! Activated for user ${userId}`);
        redirectUrl.searchParams.set('payment', 'success');
      } else {
        await adminDb.collection('subscriptions').doc(userId).set({
          userId,
          planId: planId as PlanId,
          status: 'pending',
          mpPaymentId: String(paymentId),
          updatedAt: now.toISOString()
        }, { merge: true });

        console.log(`[Callback/Pending] ⏳ Payment pending for user ${userId}`);
      }
    }
  } catch (error: any) {
    console.error('[Callback/Pending] Error verifying payment:', error?.message || error);
  }

  return NextResponse.redirect(redirectUrl.toString());
}
