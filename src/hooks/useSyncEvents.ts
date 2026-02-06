'use client';

import { useEffect, useRef, useCallback } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, onChildAdded, off, push, query, orderByChild, startAt } from 'firebase/database';

export interface SyncEvent {
  type: 'created' | 'updated' | 'deleted' | 'refresh';
  path: string;
  folder?: string;
  docId?: string;
  timestamp: number;
  source: 'worker' | 'frontend';
}

interface UseSyncEventsOptions {
  workspaceId: string | null;
  userId: string | null;
  workspaceType: 'personal' | 'shared';
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
    if (workspaceType === 'personal' && userId) {
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
        folder: folder || 'No estructurado',
        docId: docId || null,
        timestamp: Date.now(),
        source: 'frontend'
      });
    } catch (err) {
      console.warn('Error publicando evento a RTDB:', err);
    }
  }, [getSyncPath]);

  // Solicitar refresh al worker
  const requestRefresh = useCallback(() => {
    publishEvent('refresh', '', undefined, undefined);
  }, [publishEvent]);

  useEffect(() => {
    if (!enabled) return;

    const syncPath = getSyncPath();
    if (!syncPath) return;

    const database = rtdb();
    // Usar orderByChild + startAt(now - margen) para SOLO recibir eventos nuevos
    // Margen de 5s para tolerar clock skew entre worker y cliente
    const nowTs = Date.now() - 5000;
    const eventsRef = query(
      ref(database, syncPath),
      orderByChild('timestamp'),
      startAt(nowTs)
    );

    // Listener para nuevos eventos
    const unsubscribe = onChildAdded(eventsRef, (snapshot) => {
      const event = snapshot.val() as SyncEvent | null;
      if (!event) return;

      // Ignorar eventos propios del frontend
      if (event.source === 'frontend') return;

      // Notificar al callback (usando ref para estabilidad)
      onEventRef.current?.(event);
    });

    listenerRef.current = () => {
      try {
        unsubscribe();
      } catch {
        off(eventsRef, 'child_added');
      }
    };

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  // NOTA: onEvent NO está en las dependencias — usamos onEventRef para estabilidad
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, getSyncPath]);

  return {
    publishEvent,
    requestRefresh
  };
}

export default useSyncEvents;
