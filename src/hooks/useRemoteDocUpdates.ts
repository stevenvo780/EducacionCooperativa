'use client';

import { useEffect } from 'react';
import { SyncEventType, type SyncEvent } from '@/types/sync';
import { AGORA_EVENTS, subscribeAgoraEvent } from '@/lib/agora-events';

interface UseRemoteDocUpdatesArgs {
  /** ID del documento abierto en el editor; null si no hay ninguno. */
  docId: string | null;
  /** Notifica cuando llega un Updated de otro cliente para `docId`. La UI
   *  decide si recargar silenciosamente o mostrar banner según `isDirty`. */
  onRemoteUpdate: (event: SyncEvent) => void;
  /** Notifica cuando otro cliente borra el doc abierto. */
  onRemoteDelete?: (event: SyncEvent) => void;
}

/**
 * Escucha el bus global `agora:rtdb-event` y filtra los eventos relevantes
 * para el documento que el editor tiene abierto. Vive aparte de
 * `useSyncEvents` porque ese hook hace fetch del listing — éste sólo
 * decide si el doc abierto debe refrescar su contenido.
 */
export function useRemoteDocUpdates({ docId, onRemoteUpdate, onRemoteDelete }: UseRemoteDocUpdatesArgs) {
  useEffect(() => {
    if (!docId) return;
    return subscribeAgoraEvent(AGORA_EVENTS.rtdbEvent, (detail) => {
      if (!detail || detail.docId !== docId) return;
      if (detail.type === SyncEventType.Updated) onRemoteUpdate(detail);
      else if (detail.type === SyncEventType.Deleted) onRemoteDelete?.(detail);
    });
  }, [docId, onRemoteUpdate, onRemoteDelete]);
}

export default useRemoteDocUpdates;
