import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { adminDb } from '@/lib/firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';
import { SubscriptionStatus, type PlanId } from '@/types/subscription';
import { calculateSmartEndDate } from '@/app/api/payments/helpers';
import {
  MercadoPagoPaymentStatus,
  PaymentRedirectStatus,
  isPendingMercadoPagoPaymentStatus
} from '@/types/payments';

const mpAccessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const externalReference = searchParams.get('external_reference') || '';
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id') || '';
  const collectionStatus = searchParams.get('collection_status') || searchParams.get('status') || '';
  const [userId, planId] = externalReference.split('|');

  const appUrl = 'https://agora.humanizar.cloud';
  const redirectUrl = new URL(`${appUrl}/dashboard`);
  redirectUrl.searchParams.set('payment', PaymentRedirectStatus.Success);
  if (planId) redirectUrl.searchParams.set('plan', planId);

  // Verify payment and activate subscription immediately
  try {
    if (paymentId && paymentId !== 'null' && userId && planId) {
      console.debug(`[Callback/Success] Processing payment ${paymentId} for user ${userId}, plan: ${planId}, status: ${collectionStatus}`);

      const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
      const paymentClient = new Payment(client);
      const payment = await paymentClient.get({ id: Number(paymentId) });

      const now = new Date();

      // Leer suscripción actual para deduplicación
      const existingSub = await adminDb.collection('subscriptions').doc(userId).get();
      const existingData = existingSub.exists ? existingSub.data() : null;

      if (payment.status === MercadoPagoPaymentStatus.Approved) {
        // Deduplicación: si ya se activó con este mismo paymentId, no extender de nuevo
        if (existingData?.status === SubscriptionStatus.Active && existingData?.mpPaymentId === String(paymentId)) {
          console.debug(`[Callback/Success] Payment ${paymentId} already processed for user ${userId}, skipping`);
        } else {
          const endDate = await calculateSmartEndDate(userId);

          await adminDb.collection('subscriptions').doc(userId).set({
            userId,
            planId: planId as PlanId,
            status: SubscriptionStatus.Active,
            mpPaymentId: String(paymentId),
            mpMerchantOrderId: payment.order?.id ? String(payment.order.id) : null,
            startDate: now.toISOString(),
            endDate: endDate.toISOString(),
            pendingPlanId: null,
            updatedAt: now.toISOString()
          }, { merge: true });

          await adminDb.collection('users').doc(userId).set({
            subscription: {
              planId: planId as PlanId,
              status: SubscriptionStatus.Active,
              startDate: now.toISOString(),
              endDate: endDate.toISOString()
            }
          }, { merge: true });

          console.debug(`[Callback/Success] Subscription activated for user ${userId}, plan: ${planId}`);
        }
      } else if (isPendingMercadoPagoPaymentStatus(payment.status)) {
        await adminDb.collection('subscriptions').doc(userId).set({
          userId,
          planId: planId as PlanId,
          status: SubscriptionStatus.Pending,
          mpPaymentId: String(paymentId),
          updatedAt: now.toISOString()
        }, { merge: true });

        console.debug(`[Callback/Success] Payment still pending for user ${userId}`);
        redirectUrl.searchParams.set('payment', PaymentRedirectStatus.Pending);
      } else {
        console.warn(`[Callback/Success] Unexpected status: ${payment.status} for user ${userId}`);
      }
    } else {
      console.debug(`[Callback/Success] Missing data - paymentId: ${paymentId}, userId: ${userId}, planId: ${planId}`);
    }
  } catch (error: unknown) {
    console.error('[Callback/Success] Error verifying payment:', getErrorMessage(error));
  }

  return NextResponse.redirect(redirectUrl.toString());
}
