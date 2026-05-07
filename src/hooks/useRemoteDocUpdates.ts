'use client';

import { useEffect } from 'react';
import { SyncEventType, type SyncEvent } from '@/types/sync';
import { AGORA_EVENTS, subscribeAgoraEvent } from '@/lib/agora-events';
import { isYjsActive } from '@/lib/yjs/firebase-provider';

interface UseRemoteDocUpdatesArgs {
  /** ID del documento abierto en el editor; null si no hay ninguno. */
  docId: string | null;
  /** Notifica cuando llega un Updated de otro cliente para `docId`. La UI
   *  decide si recargar silenciosamente o mostrar banner según `isDirty`. */
  onRemoteUpdate: (event: SyncEvent) => void;
  /** Notifica cuando otro cliente borra el doc abierto. */
  onRemoteDelete?: (event: SyncEvent) => void;
  /** Si el caller sabe que hay colab Yjs activa puede forzar el skip
   *  manualmente; si se omite, se consulta el registry global. */
  collabEnabled?: boolean;
}

/**
 * Escucha el bus global `agora:rtdb-event` y filtra los eventos relevantes
 * para el documento que el editor tiene abierto. Vive aparte de
 * `useSyncEvents` porque ese hook hace fetch del listing — éste sólo
 * decide si el doc abierto debe refrescar su contenido.
 *
 * Cuando hay un Y.Doc colaborativo activo para `docId`, este hook se
 * silencia: Yjs es la fuente de verdad y los reloads via fetch raw
 * pisarían cambios CRDT sin mergear.
 */
export function useRemoteDocUpdates({
  docId,
  onRemoteUpdate,
  onRemoteDelete,
  collabEnabled
}: UseRemoteDocUpdatesArgs) {
  useEffect(() => {
    if (!docId) return;
    return subscribeAgoraEvent(AGORA_EVENTS.rtdbEvent, (detail) => {
      if (!detail || detail.docId !== docId) return;
      // Si hay Y.Doc activo (en este o cualquier workspace abierto) la
      // sync corre por el canal /collab/<wsId>/<docId>/updates: ignorar
      // el ping de RTDB sync-events para no provocar un reload que pise
      // los cambios CRDT pendientes.
      if (collabEnabled || isYjsActive(docId)) {
        // Aún así, el delete se respeta: si otro cliente borró el doc
        // hay que cerrar el editor.
        if (detail.type === SyncEventType.Deleted) onRemoteDelete?.(detail);
        return;
      }
      if (detail.type === SyncEventType.Updated) onRemoteUpdate(detail);
      else if (detail.type === SyncEventType.Deleted) onRemoteDelete?.(detail);
    });
  }, [docId, onRemoteUpdate, onRemoteDelete, collabEnabled]);
}

export default useRemoteDocUpdates;
