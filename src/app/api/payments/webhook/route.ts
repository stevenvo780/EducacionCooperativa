import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { adminDb } from '@/lib/firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';
import { SubscriptionStatus, type PlanId } from '@/types/subscription';
import { calculateSmartEndDate } from '@/app/api/payments/helpers';
import {
  MercadoPagoNotificationType,
  MercadoPagoPaymentStatus,
  isCancelledMercadoPagoPaymentStatus,
  isPendingMercadoPagoPaymentStatus
} from '@/types/payments';

const mpAccessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // MercadoPago envía el tipo de notificación y el data.id
    const { type, data } = body;

    if (type === MercadoPagoNotificationType.Payment) {
      const paymentId = data?.id;
      if (!paymentId) {
        return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
      }

      const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
      const paymentClient = new Payment(client);

      const payment = await paymentClient.get({ id: paymentId });

      if (!payment || !payment.external_reference) {
        console.warn('Payment not found or missing external_reference:', paymentId);
        return NextResponse.json({ received: true });
      }

      const [userId, planId] = payment.external_reference.split('|');

      if (!userId || !planId) {
        console.warn('Invalid external_reference:', payment.external_reference);
        return NextResponse.json({ received: true });
      }

      const now = new Date();

      // Leer suscripción actual para deduplicación y protección
      const existingSub = await adminDb.collection('subscriptions').doc(userId).get();
      const existingData = existingSub.exists ? existingSub.data() : null;

      if (payment.status === MercadoPagoPaymentStatus.Approved) {
        // Deduplicación: si ya se activó con este mismo paymentId, no extender de nuevo
        if (existingData?.status === SubscriptionStatus.Active && existingData?.mpPaymentId === String(paymentId)) {
          console.debug(`[Webhook] Payment ${paymentId} already processed for user ${userId}, skipping`);
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

          console.debug(`[Webhook] Subscription activated for user ${userId}, plan: ${planId}`);
        }
      } else if (isPendingMercadoPagoPaymentStatus(payment.status)) {
        // Solo poner pending si NO tiene ya una suscripción activa
        if (existingData?.status === SubscriptionStatus.Active) {
          console.debug(`[Webhook] User ${userId} already has active sub, ignoring pending status for payment ${paymentId}`);
        } else {
          await adminDb.collection('subscriptions').doc(userId).set({
            userId,
            planId: planId as PlanId,
            status: SubscriptionStatus.Pending,
            mpPaymentId: String(paymentId),
            updatedAt: now.toISOString()
          }, { merge: true });

          console.debug(`[Webhook] Payment pending for user ${userId}, plan: ${planId}`);
        }
      } else if (isCancelledMercadoPagoPaymentStatus(payment.status)) {
        // Solo cancelar si el pago rechazado corresponde al pago ACTUAL
        // No cancelar si tiene un plan activo con otro paymentId
        if (existingData?.status === SubscriptionStatus.Active && existingData?.mpPaymentId !== String(paymentId)) {
          console.warn(`[Webhook] Rejected payment ${paymentId} ignored for user ${userId}; active subscription uses a different payment`);
        } else {
          await adminDb.collection('subscriptions').doc(userId).set({
            userId,
            status: SubscriptionStatus.Cancelled,
            mpPaymentId: String(paymentId),
            updatedAt: now.toISOString()
          }, { merge: true });

          console.debug(`[Webhook] Payment rejected/cancelled for user ${userId}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook error:', getErrorMessage(error));
    // Siempre responder 200 para que MP no reintente
    return NextResponse.json({ received: true, error: getErrorMessage(error) });
  }
}

// MP también puede enviar GET para verificar el endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
