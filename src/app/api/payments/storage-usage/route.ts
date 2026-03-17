import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';
import { Plan, SubscriptionStatus, getStorageLimitMB, type PlanId } from '@/types/subscription';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Get user's current plan
    const subSnap = await adminDb.collection('subscriptions').doc(auth.uid).get();
    let planId: PlanId = Plan.Free;
    if (subSnap.exists) {
      const subData = subSnap.data();
      if (subData?.status === SubscriptionStatus.Active && subData?.planId) {
        planId = subData.planId as PlanId;
      }
    }

    const limitMB = getStorageLimitMB(planId);

    // Calculate total storage used by listing files in user's prefix
    const bucket = adminStorage.bucket();
    const prefix = `users/${auth.uid}/`;
    const [files] = await bucket.getFiles({ prefix });

    let totalBytes = 0;
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      totalBytes += parseInt(metadata.size as string, 10) || 0;
    }

    const usedMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

    return NextResponse.json({
      usedMB,
      limitMB,
      planId,
      usedBytes: totalBytes,
      limitBytes: limitMB * 1024 * 1024,
      percentage: limitMB > 0 ? Math.round((usedMB / limitMB) * 100) : 0
    });
  } catch (error: unknown) {
    console.error('Error fetching storage usage:', getErrorMessage(error));
    return NextResponse.json(
      { error: getErrorMessage(error, 'Error al obtener uso de almacenamiento') },
      { status: 500 }
    );
  }
}
