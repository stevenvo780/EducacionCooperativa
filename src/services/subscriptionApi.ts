import { authFetch } from '@/services/apiClient';
import type { UserSubscription, PlanId } from '@/types/subscription';

export interface StorageUsage {
  usedMB: number;
  limitMB: number;
  planId: PlanId;
  usedBytes: number;
  limitBytes: number;
  percentage: number;
}

export async function fetchSubscriptionStatus(): Promise<UserSubscription> {
  const res = await authFetch('/api/payments/subscription-status');
  if (!res.ok) {
    throw new Error('Error al obtener estado de suscripción');
  }
  const data = await res.json();
  return data.subscription;
}

export async function createPaymentPreference(planId: PlanId): Promise<{
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}> {
  const res = await authFetch('/api/payments/create-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Error al crear preferencia de pago');
  }

  return res.json();
}

export async function fetchStorageUsage(): Promise<StorageUsage> {
  const res = await authFetch('/api/payments/storage-usage');
  if (!res.ok) {
    throw new Error('Error al obtener uso de almacenamiento');
  }
  return res.json();
}

export async function verifyPayment(): Promise<{
  status: string;
  planId?: PlanId;
  message: string;
}> {
  const res = await authFetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}
