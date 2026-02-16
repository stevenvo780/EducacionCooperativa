import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { adminDb } from '@/lib/firebase-admin';
import type { PlanId } from '@/types/subscription';
import { calculateSmartEndDate } from '@/app/api/payments/helpers';

/* eslint-disable no-console */

const mpAccessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // MercadoPago envía el tipo de notificación y el data.id
    const { type, data } = body;

    if (type === 'payment') {
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

      if (payment.status === 'approved') {
        // Deduplicación: si ya se activó con este mismo paymentId, no extender de nuevo
        if (existingData?.status === 'active' && existingData?.mpPaymentId === String(paymentId)) {
          console.log(`[Webhook] ⏭️ Payment ${paymentId} already processed for user ${userId}, skipping`);
        } else {
          const endDate = await calculateSmartEndDate(userId);

          await adminDb.collection('subscriptions').doc(userId).set({
            userId,
            planId: planId as PlanId,
            status: 'active',
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
              status: 'active',
              startDate: now.toISOString(),
              endDate: endDate.toISOString()
            }
          }, { merge: true });

          console.log(`✅ Subscription activated for user ${userId}, plan: ${planId}`);
        }
      } else if (payment.status === 'pending' || payment.status === 'in_process') {
        // Solo poner pending si NO tiene ya una suscripción activa
        if (existingData?.status === 'active') {
          console.log(`[Webhook] ⏭️ User ${userId} already has active sub, ignoring pending status for payment ${paymentId}`);
        } else {
          await adminDb.collection('subscriptions').doc(userId).set({
            userId,
            planId: planId as PlanId,
            status: 'pending',
            mpPaymentId: String(paymentId),
            updatedAt: now.toISOString()
          }, { merge: true });

          console.log(`⏳ Payment pending for user ${userId}, plan: ${planId}`);
        }
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        // Solo cancelar si el pago rechazado corresponde al pago ACTUAL
        // No cancelar si tiene un plan activo con otro paymentId
        if (existingData?.status === 'active' && existingData?.mpPaymentId !== String(paymentId)) {
          console.log(`[Webhook] ⚠️ Rejected payment ${paymentId} ignored — user ${userId} has active sub with different payment`);
        } else {
          await adminDb.collection('subscriptions').doc(userId).set({
            userId,
            status: 'cancelled',
            mpPaymentId: String(paymentId),
            updatedAt: now.toISOString()
          }, { merge: true });

          console.log(`❌ Payment rejected/cancelled for user ${userId}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    // Siempre responder 200 para que MP no reintente
    return NextResponse.json({ received: true, error: error.message });
  }
}

// MP también puede enviar GET para verificar el endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
