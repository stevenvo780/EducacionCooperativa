'use client';

/**
 * Listener RTDB global montado en el layout root. Suscribe al canal personal
 * del usuario y al del workspace activo, y reemite cada evento via
 * dispatchAgoraEvent(rtdbEvent | docsChanged) para que cualquier página
 * lo consuma.
 */
import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppSelector } from '@/store/hooks';
import useSyncEvents from '@/hooks/useSyncEvents';
import { PERSONAL_WORKSPACE_ID, WorkspaceType } from '@/types/workspace';
import type { SyncEvent } from '@/types/sync';
import { AGORA_EVENTS, dispatchAgoraEvent } from '@/lib/agora-events';

export default function SyncEventsBridge() {
    const { user } = useAuth();
    const currentWorkspace = useAppSelector((s) => s.dashboard.currentWorkspace);
    const wsId = currentWorkspace?.id ?? null;
    const isPersonal = !wsId || wsId === PERSONAL_WORKSPACE_ID;

    const reemit = useCallback((event: SyncEvent) => {
        dispatchAgoraEvent(AGORA_EVENTS.rtdbEvent, event);
        dispatchAgoraEvent(AGORA_EVENTS.docsChanged);
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
