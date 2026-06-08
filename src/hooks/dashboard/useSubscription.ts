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
    showPricingModal: boolean;
    setShowPricingModal: (value: boolean) => void;
}

export function useSubscription(
    user: User | null,
    searchParams: ReadonlyURLSearchParams | null
): UseSubscriptionResult {
    const [currentPlan, setCurrentPlan] = useState<PlanId>(Plan.Free);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
    const [showPricingModal, setShowPricingModal] = useState(false);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        fetchSubscriptionStatus()
            .then((sub) => {
                if (!cancelled && sub?.planId) {
                    setCurrentPlan(sub.status === SubscriptionStatus.Active ? sub.planId : Plan.Free);
                    setSubscriptionEndDate(sub.status === SubscriptionStatus.Active && sub.endDate ? sub.endDate : null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCurrentPlan(Plan.Free);
                    setSubscriptionEndDate(null);
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
                    if (paymentStatus === PaymentRedirectStatus.Success) {
                        toast.success('¡Suscripción activada! Tu plan ya está activo.');
                    }
                    return undefined;
                }
                return fetchSubscriptionStatus();
            })
            .then((sub) => {
                if (sub && 'planId' in sub) {
                    setCurrentPlan(sub.status === SubscriptionStatus.Active ? sub.planId : Plan.Free);
                    setSubscriptionEndDate(sub.status === SubscriptionStatus.Active && sub.endDate ? sub.endDate : null);
                }
            })
            .catch(() => {
                fetchSubscriptionStatus()
                    .then((sub) => {
                        if (sub?.planId) {
                            setCurrentPlan(sub.status === SubscriptionStatus.Active ? sub.planId : Plan.Free);
                            setSubscriptionEndDate(sub.status === SubscriptionStatus.Active && sub.endDate ? sub.endDate : null);
                        }
                    })
                    .catch(() => {});
            })
            .finally(() => {
                cleanPaymentParam();
            });
    }, [searchParams]);

    return { currentPlan, subscriptionEndDate, showPricingModal, setShowPricingModal };
}
