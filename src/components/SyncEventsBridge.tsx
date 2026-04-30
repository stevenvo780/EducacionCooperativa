'use client';

/**
 * Listener RTDB global. Se monta una sola vez en el layout root (después de
 * StoreProvider + AuthProvider) y suscribe al canal personal del usuario más
 * el canal del workspace actualmente activo. Cada evento entrante se reemite
 * como `window.dispatchEvent('agora:rtdb-event')` y `agora:docs-changed`,
 * para que CUALQUIER página (dashboard, editor, workspace) escuche cambios
 * sin tener que montar su propio listener RTDB.
 *
 * Antes de esto `useSyncEvents` solo se montaba en /dashboard, así que en
 * /editor o /workspace los usuarios no se enteraban de cambios remotos
 * hasta recargar.
 */
import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppSelector } from '@/store/hooks';
import useSyncEvents from '@/hooks/useSyncEvents';
import { PERSONAL_WORKSPACE_ID, WorkspaceType } from '@/types/workspace';
import type { SyncEvent } from '@/types/sync';

export default function SyncEventsBridge() {
    const { user } = useAuth();
    const currentWorkspace = useAppSelector((s) => s.dashboard.currentWorkspace);
    const wsId = currentWorkspace?.id ?? null;
    const isPersonal = !wsId || wsId === PERSONAL_WORKSPACE_ID;

    const reemit = useCallback((event: SyncEvent) => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('agora:rtdb-event', { detail: event }));
        // Compat: el dashboard ya escuchaba este evento para refrescar la
        // jerarquía. Lo conservamos como atajo "algo cambió, refresca".
        window.dispatchEvent(new Event('agora:docs-changed'));
    }, []);

    useSyncEvents({
        workspaceId: null,
        userId: user?.uid ?? null,
        workspaceType: WorkspaceType.Personal,
        enabled: !!user,
        onEvent: reemit
    });

    useSyncEvents({
        workspaceId: !isPersonal ? wsId : null,
        userId: null,
        workspaceType: WorkspaceType.Shared,
        enabled: !!user && !isPersonal,
        onEvent: reemit
    });

    return null;
}
