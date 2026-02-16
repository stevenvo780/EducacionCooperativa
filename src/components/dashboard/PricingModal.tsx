'use client';

import { useState, useEffect } from 'react';
import { X, Check, Loader2, ExternalLink, MessageCircle, HardDrive } from 'lucide-react';
import { PLANS, type PlanId, type PlanConfig, formatStorageSize } from '@/types/subscription';
import { authFetch } from '@/services/apiClient';
import { fetchStorageUsage, type StorageUsage } from '@/services/subscriptionApi';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanId;
  userEmail?: string | null;
}

const WHATSAPP_ENTERPRISE_URL = 'https://wa.me/573246780067?text=Hola%2C%20me%20interesa%20el%20plan%20Enterprise%20de%20Agora';

export default function PricingModal({ isOpen, onClose, currentPlan, userEmail }: PricingModalProps) {
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchStorageUsage()
        .then(setStorageUsage)
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === currentPlan) return;
    if (planId === 'free') return;

    if (planId === 'enterprise') {
      window.open(WHATSAPP_ENTERPRISE_URL, '_blank');
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      const res = await authFetch('/api/payments/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear preferencia de pago');
      }

      // Redirigir al checkout de MercadoPago (sandbox si disponible, sino producción)
      const checkoutUrl = data.sandboxInitPoint || data.initPoint;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No se recibió URL de checkout');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago');
      setLoading(null);
    }
  };

  const planOrder: PlanId[] = ['free', 'basic', 'pro', 'enterprise'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e1e2e] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-700/50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div>
            <h2 className="text-2xl font-bold text-white">Planes y Precios</h2>
            <p className="text-gray-400 mt-1">Elige el plan que mejor se ajuste a tus necesidades</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Storage Usage Bar */}
        {storageUsage && (
          <div className="mx-6 mt-4 p-4 bg-[#252535] rounded-lg border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <HardDrive size={16} className="text-blue-400" />
                <span>Almacenamiento usado</span>
              </div>
              <span className="text-sm text-gray-400">
                {formatStorageSize(storageUsage.usedMB)} de {formatStorageSize(storageUsage.limitMB)}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  storageUsage.percentage >= 90 ? 'bg-red-500' :
                  storageUsage.percentage >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
              />
            </div>
            {storageUsage.percentage >= 90 && (
              <p className="text-xs text-red-400 mt-1">
                ⚠️ Tu almacenamiento está casi lleno. Mejora tu plan para obtener más espacio.
              </p>
            )}
          </div>
        )}

        {/* Plans Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {planOrder.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = planId === currentPlan;
            const isPopular = planId === 'pro';

            return (
              <PlanCard
                key={planId}
                plan={plan}
                isCurrent={isCurrent}
                isPopular={isPopular}
                isLoading={loading === planId}
                onSelect={() => handleSelectPlan(planId)}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 text-center">
          <p className="text-gray-500 text-xs">
            Los pagos son procesados de forma segura por MercadoPago.
            Puedes cancelar tu suscripción en cualquier momento.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  isPopular,
  isLoading,
  onSelect
}: {
  plan: PlanConfig;
  isCurrent: boolean;
  isPopular: boolean;
  isLoading: boolean;
  onSelect: () => void;
}) {
  const borderColor = isPopular
    ? 'border-blue-500/50 ring-1 ring-blue-500/20'
    : isCurrent
    ? 'border-green-500/50'
    : 'border-gray-700/50';

  return (
    <div className={`relative flex flex-col rounded-xl border ${borderColor} bg-[#252535] p-5 transition-all hover:border-gray-500/50`}>
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
          Popular
        </div>
      )}

      {/* Current badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
          Plan actual
        </div>
      )}

      {/* Plan name */}
      <h3 className="text-lg font-bold text-white mt-2">{plan.name}</h3>

      {/* Price */}
      <div className="mt-3 mb-2">
        {plan.price === 0 ? (
          <span className="text-3xl font-bold text-white">Gratis</span>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">
              ${plan.price.toLocaleString('es-CO')}
            </span>
            <span className="text-gray-400 text-sm">/mes</span>
          </div>
        )}
      </div>

      {/* Storage */}
      <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-400">
        <HardDrive size={12} />
        <span>{formatStorageSize(plan.storageLimitMB)} de almacenamiento</span>
      </div>

      {/* Features */}
      <ul className="flex-1 space-y-2 mb-5">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
            <Check size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {plan.contactRequired ? (
        <a
          href={WHATSAPP_ENTERPRISE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors text-sm"
        >
          <MessageCircle size={16} />
          Contactar por WhatsApp
        </a>
      ) : isCurrent ? (
        <button
          disabled
          className="w-full py-2.5 px-4 rounded-lg bg-gray-700 text-gray-400 font-medium text-sm cursor-not-allowed"
        >
          Plan actual
        </button>
      ) : plan.price === 0 ? (
        <button
          disabled
          className="w-full py-2.5 px-4 rounded-lg bg-gray-700/50 text-gray-500 font-medium text-sm cursor-not-allowed"
        >
          Plan incluido
        </button>
      ) : (
        <button
          onClick={onSelect}
          disabled={isLoading}
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
            isPopular
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <ExternalLink size={16} />
              Suscribirse
            </>
          )}
        </button>
      )}
    </div>
  );
}
