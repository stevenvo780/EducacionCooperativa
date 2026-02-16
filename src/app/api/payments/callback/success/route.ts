import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { adminDb } from '@/lib/firebase-admin';
import type { PlanId } from '@/types/subscription';
import { calculateSmartEndDate } from '@/app/api/payments/helpers';

/* eslint-disable no-console */

const mpAccessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const externalReference = searchParams.get('external_reference') || '';
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id') || '';
  const collectionStatus = searchParams.get('collection_status') || searchParams.get('status') || '';
  const [userId, planId] = externalReference.split('|');

  const appUrl = 'https://agora.humanizar.cloud';
  const redirectUrl = new URL(`${appUrl}/dashboard`);
  redirectUrl.searchParams.set('payment', 'success');
  if (planId) redirectUrl.searchParams.set('plan', planId);

  // Verify payment and activate subscription immediately
  try {
    if (paymentId && paymentId !== 'null' && userId && planId) {
      console.log(`[Callback/Success] Processing payment ${paymentId} for user ${userId}, plan: ${planId}, status: ${collectionStatus}`);

      const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
      const paymentClient = new Payment(client);
      const payment = await paymentClient.get({ id: Number(paymentId) });

      const now = new Date();
      const endDate = await calculateSmartEndDate(userId);

      if (payment.status === 'approved') {
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

        console.log(`[Callback/Success] ✅ Subscription activated for user ${userId}, plan: ${planId}`);
      } else if (payment.status === 'pending' || payment.status === 'in_process') {
        await adminDb.collection('subscriptions').doc(userId).set({
          userId,
          planId: planId as PlanId,
          status: 'pending',
          mpPaymentId: String(paymentId),
          updatedAt: now.toISOString()
        }, { merge: true });

        console.log(`[Callback/Success] ⏳ Payment still pending for user ${userId}`);
        redirectUrl.searchParams.set('payment', 'pending');
      } else {
        console.log(`[Callback/Success] ⚠️ Unexpected status: ${payment.status} for user ${userId}`);
      }
    } else {
      console.log(`[Callback/Success] Missing data - paymentId: ${paymentId}, userId: ${userId}, planId: ${planId}`);
    }
  } catch (error: any) {
    console.error('[Callback/Success] Error verifying payment:', error?.message || error);
  }

  return NextResponse.redirect(redirectUrl.toString());
}
