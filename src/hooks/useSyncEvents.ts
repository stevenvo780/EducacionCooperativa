'use client';

import { useEffect, useRef, useCallback } from 'react';
import { rtdb } from '@/lib/firebase';
import { getErrorMessage } from '@/lib/error-utils';
import { ref, onChildAdded, off, onValue, push, query, orderByChild, startAt } from 'firebase/database';
import { SyncEventSource, SyncEventType, type SyncEvent } from '@/types/sync';
import { WorkspaceType, type WorkspaceTypeId } from '@/types/workspace';
import { parseSyncEventPayload } from '@agora/contracts';

interface UseSyncEventsOptions {
  workspaceId: string | null;
  userId: string | null;
  workspaceType: WorkspaceTypeId;
  onEvent?: (event: SyncEvent) => void;
  enabled?: boolean;
}

/**
 * Hook para escuchar eventos de sincronización en tiempo real desde RTDB
 */
export function useSyncEvents({
  workspaceId,
  userId,
  workspaceType,
  onEvent,
  enabled = true
}: UseSyncEventsOptions) {
  const listenerRef = useRef<(() => void) | null>(null);
  // Usar ref para el callback para evitar re-montar el listener RTDB
  // cuando la identidad del callback cambia (por ejemplo, cuando fetchDocs se re-crea)
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Construir path de RTDB según el tipo de workspace
  const getSyncPath = useCallback(() => {
    if (workspaceType === WorkspaceType.Personal && userId) {
      return `sync-events/personal_${userId}`;
    }
    if (workspaceId) {
      return `sync-events/${workspaceId}`;
    }
    return null;
  }, [workspaceId, userId, workspaceType]);

  // Publicar evento desde el frontend
  const publishEvent = useCallback(async (
    type: SyncEvent['type'],
    path: string,
    docId?: string,
    folder?: string
  ) => {
    const syncPath = getSyncPath();
    if (!syncPath) return;

    try {
      const database = rtdb();
      const eventsRef = ref(database, syncPath);
      await push(eventsRef, {
        type,
        path,
        folder: folder ?? '',
        docId: docId || null,
        timestamp: Date.now(),
        schemaVersion: 1,
        source: SyncEventSource.Frontend
      });
    } catch (error) {
      console.warn('Error publicando evento a RTDB:', getErrorMessage(error));
    }
  }, [getSyncPath]);

  // Solicitar refresh al worker
  const requestRefresh = useCallback(() => {
    publishEvent(SyncEventType.Refresh, '', undefined, undefined);
  }, [publishEvent]);

  useEffect(() => {
    if (!enabled) return;

    const syncPath = workspaceType === WorkspaceType.Personal && userId
      ? `sync-events/personal_${userId}`
      : workspaceId
        ? `sync-events/${workspaceId}`
        : null;
    if (!syncPath) return;

    const database = rtdb();
    let activeUnsubscribe: (() => void) | null = null;
    let connectedTracked = false;

    const handleEvent = (snapshot: { val: () => unknown }) => {
      const parsed = parseSyncEventPayload(snapshot.val());
      if (!parsed.ok) {
        console.warn('[useSyncEvents] payload malformado:', parsed.error);
        return;
      }
      const event = parsed.value;
      if (event.source === SyncEventSource.Frontend) return;

      const legacy: SyncEvent = {
        type: event.type,
        path: event.path,
        folder: event.folder,
        docId: event.docId ?? undefined,
        timestamp: event.timestamp,
        source: event.source === 'hub' ? SyncEventSource.Worker : event.source
      };
      onEventRef.current?.(legacy);
    };

    const handleError = (error: Error) => {
      console.error('[useSyncEvents] RTDB onChildAdded error:', getErrorMessage(error));
    };

    // Resuscribe el query con un `nowTs` recién calculado. Tras suspend
    // de laptop el startAt original quedaba stale (potencialmente horas en
    // el pasado) y al reconectar RTDB replayeaba todos los eventos del
    // canal en burst. Recalculando en cada reconexión, solo entran eventos
    // posteriores a la reanudación + un margen de 60s para clock skew.
    const subscribe = () => {
      if (activeUnsubscribe) {
        try { activeUnsubscribe(); } catch { /* ignore */ }
        activeUnsubscribe = null;
      }
      const nowTs = Date.now() - 60_000;
      const eventsRef = query(
        ref(database, syncPath),
        orderByChild('timestamp'),
        startAt(nowTs)
      );
      const unsubscribe = onChildAdded(eventsRef, handleEvent, handleError);
      activeUnsubscribe = () => {
        try { unsubscribe(); } catch { off(eventsRef, 'child_added'); }
      };
    };

    subscribe();

    const connectedRef = ref(database, '.info/connected');
    const connectedHandler = onValue(connectedRef, (snap) => {
      const connected = snap.val() === true;
      if (connected && connectedTracked) {
        // Reconexión real (la primera no cuenta — ya nos suscribimos arriba).
        subscribe();
      }
      if (connected) connectedTracked = true;
    });

    listenerRef.current = () => {
      if (activeUnsubscribe) {
        try { activeUnsubscribe(); } catch { /* ignore */ }
        activeUnsubscribe = null;
      }
      try { connectedHandler(); } catch { off(connectedRef, 'value'); }
    };

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [enabled, workspaceId, userId, workspaceType]);

  return {
    publishEvent,
    requestRefresh
  };
}

export default useSyncEvents;
