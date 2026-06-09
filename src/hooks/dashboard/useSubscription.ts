'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { fetchSubscriptionStatus, verifyPayment } from '@/services/subscriptionApi';
import { Plan, SubscriptionStatus, type PlanId } from '@/types/subscription';
import { PaymentRedirectStatus } from '@/types/payments';

interface UseSubscriptionResult {
    currentPlan: PlanId;
    subscriptionEndDate: string | null;
    cancelAtPeriodEnd: boolean;
    showPricingModal: boolean;
    setShowPricingModal: (value: boolean) => void;
}

export function useSubscription(
    user: User | null,
    searchParams: ReadonlyURLSearchParams | null
): UseSubscriptionResult {
    const [currentPlan, setCurrentPlan] = useState<PlanId>(Plan.Free);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
    const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        fetchSubscriptionStatus()
            .then((sub) => {
                if (!cancelled && sub?.planId) {
                    const isActive = sub.status === SubscriptionStatus.Active;
                    setCurrentPlan(isActive ? sub.planId : Plan.Free);
                    setSubscriptionEndDate(isActive && sub.endDate ? sub.endDate : null);
                    setCancelAtPeriodEnd(isActive ? (sub.cancelAtPeriodEnd ?? false) : false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCurrentPlan(Plan.Free);
                    setSubscriptionEndDate(null);
                    setCancelAtPeriodEnd(false);
                }
            });
        return () => { cancelled = true; };
    }, [user]);

    useEffect(() => {
        const paymentStatus = searchParams?.get('payment');
        if (!paymentStatus) return;

        const cleanPaymentParam = () => {
            if (typeof window === 'undefined') return;
            const url = new URL(window.location.href);
            url.searchParams.delete('payment');
            window.history.replaceState(null, '', url.toString());
        };

        if (paymentStatus === PaymentRedirectStatus.Failure) {
            toast.error('El pago no se completó o fue rechazado. No se realizó ningún cargo.');
            cleanPaymentParam();
            return;
        }

        if (paymentStatus === PaymentRedirectStatus.Pending) {
            toast.info('Tu pago está en proceso. Te notificaremos cuando se confirme.');
        }

        verifyPayment()
            .then((result) => {
                if (result.status === SubscriptionStatus.Active && result.planId) {
                    setCurrentPlan(result.planId);
                    setCancelAtPeriodEnd(false);
                    if (paymentStatus === PaymentRedirectStatus.Success) {
                        toast.success('¡Suscripción activada! Tu plan ya está activo.');
                    }
                    return undefined;
                }
                return fetchSubscriptionStatus();
            })
            .then((sub) => {
                if (sub && 'planId' in sub) {
                    const isActive = sub.status === SubscriptionStatus.Active;
                    setCurrentPlan(isActive ? sub.planId : Plan.Free);
                    setSubscriptionEndDate(isActive && sub.endDate ? sub.endDate : null);
                    setCancelAtPeriodEnd(isActive ? (sub.cancelAtPeriodEnd ?? false) : false);
                }
            })
            .catch(() => {
                fetchSubscriptionStatus()
                    .then((sub) => {
                        if (sub?.planId) {
                            const isActive = sub.status === SubscriptionStatus.Active;
                            setCurrentPlan(isActive ? sub.planId : Plan.Free);
                            setSubscriptionEndDate(isActive && sub.endDate ? sub.endDate : null);
                            setCancelAtPeriodEnd(isActive ? (sub.cancelAtPeriodEnd ?? false) : false);
                        }
                    })
                    .catch(() => {});
            })
            .finally(() => {
                cleanPaymentParam();
            });
    }, [searchParams]);

    return { currentPlan, subscriptionEndDate, cancelAtPeriodEnd, showPricingModal, setShowPricingModal };
}
