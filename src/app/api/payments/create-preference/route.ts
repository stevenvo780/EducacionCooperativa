import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { requireAuth } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { PLANS, type PlanId } from '@/types/subscription';

const mpAccessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
const isSandbox = process.env.MERCADOPAGO_SANDBOX === 'true';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const planId = body.planId as PlanId;

    if (!planId || !PLANS[planId]) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
    }

    const plan = PLANS[planId];

    if (plan.price === 0) {
      return NextResponse.json({ error: 'El plan gratuito no requiere pago' }, { status: 400 });
    }

    if (plan.contactRequired) {
      return NextResponse.json({
        error: 'Este plan requiere contacto directo',
        contactUrl: 'https://wa.me/573246780067?text=Hola%2C%20me%20interesa%20el%20plan%20Enterprise%20de%20Agora'
      }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const preferenceClient = new Preference(client);

    const appUrl = 'https://agora.humanizar.cloud';

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: `plan-${planId}`,
            title: `Agora - Plan ${plan.name}`,
            description: `Suscripcion mensual al plan ${plan.name}`,
            quantity: 1,
            unit_price: plan.price,
            currency_id: 'COP'
          }
        ],
        payer: {
          email: auth.email || undefined
        },
        back_urls: {
          success: `${appUrl}/api/payments/callback/success`,
          failure: `${appUrl}/api/payments/callback/failure`,
          pending: `${appUrl}/api/payments/callback/pending`
        },
        auto_return: 'approved',
        external_reference: `${auth.uid}|${planId}`,
        notification_url: `${appUrl}/api/payments/webhook`,
        metadata: {
          user_id: auth.uid,
          plan_id: planId,
          user_email: auth.email || ''
        }
      }
    });

    // Guardar preferencia pendiente en Firestore
    // IMPORTANTE: Si ya tiene suscripción activa, NO cambiar status/planId
    // para no perder el acceso si el usuario no completa el pago
    const existingSub = await adminDb.collection('subscriptions').doc(auth.uid).get();
    const existingData = existingSub.exists ? existingSub.data() : null;

    if (existingData?.status === 'active') {
      // Tiene plan activo — solo guardar referencia de nueva preferencia
      await adminDb.collection('subscriptions').doc(auth.uid).set({
        mpPreferenceId: preference.id,
        pendingPlanId: planId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      // No tiene plan activo — OK poner pending
      await adminDb.collection('subscriptions').doc(auth.uid).set({
        userId: auth.uid,
        planId: planId,
        status: 'pending',
        mpPreferenceId: preference.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    const checkoutUrl = isSandbox
      ? preference.sandbox_init_point
      : preference.init_point;

    return NextResponse.json({
      preferenceId: preference.id,
      checkoutUrl
    });
  } catch (error: any) {
    console.error('Error creating payment preference:', error?.cause || error?.message);
    const mpMessage = error?.cause?.message || error?.message || '';
    const safeMessage = (mpMessage || 'Error al crear preferencia de pago')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/TEST-[\w-]+/gi, '[REDACTED]')
      .replace(/APP_USR-[\w-]+/gi, '[REDACTED]');
    return NextResponse.json(
      { error: safeMessage, detail: error?.cause || error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
