export type PlanId = 'free' | 'basic' | 'pro' | 'enterprise';

export interface PlanConfig {
  id: PlanId;
  name: string;
  price: number; // COP
  currency: string;
  features: string[];
  hasTerminals: boolean;
  hasDedicatedMachine: boolean;
  contactRequired: boolean;
  storageLimitMB: number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    currency: 'COP',
    features: [
      'Acceso al editor',
      'Documentos ilimitados',
      'Workspaces personales',
      '50 MB de almacenamiento'
    ],
    hasTerminals: false,
    hasDedicatedMachine: false,
    contactRequired: false,
    storageLimitMB: 50
  },
  basic: {
    id: 'basic',
    name: 'Básico',
    price: 30000,
    currency: 'COP',
    features: [
      'Todo lo del plan Gratuito',
      'Workspaces colaborativos',
      'Tableros Kanban',
      'Soporte por email',
      '1 GB de almacenamiento'
    ],
    hasTerminals: false,
    hasDedicatedMachine: false,
    contactRequired: false,
    storageLimitMB: 1024
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 50000,
    currency: 'COP',
    features: [
      'Todo lo del plan Básico',
      'Terminales ilimitadas',
      'Acceso completo a workers',
      'Soporte prioritario',
      '1 GB de almacenamiento'
    ],
    hasTerminals: true,
    hasDedicatedMachine: false,
    contactRequired: false,
    storageLimitMB: 1024
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 150000,
    currency: 'COP',
    features: [
      'Todo lo del plan Pro',
      'Máquina dedicada',
      'Terminal dedicada',
      'Soporte personalizado',
      'Configuración a medida',
      '10 GB de almacenamiento'
    ],
    hasTerminals: true,
    hasDedicatedMachine: true,
    contactRequired: true,
    storageLimitMB: 10240
  }
};

export interface UserSubscription {
  id?: string;
  userId: string;
  planId: PlanId;
  status: 'active' | 'pending' | 'cancelled' | 'expired' | 'free';
  mpPaymentId?: string;
  mpPreferenceId?: string;
  mpMerchantOrderId?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export function canAccessTerminals(planId: PlanId): boolean {
  return PLANS[planId]?.hasTerminals ?? false;
}

export function getPlanById(planId: PlanId): PlanConfig {
  return PLANS[planId] ?? PLANS.free;
}

export function getStorageLimitMB(planId: PlanId): number {
  return PLANS[planId]?.storageLimitMB ?? PLANS.free.storageLimitMB;
}

export function formatStorageSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
}
