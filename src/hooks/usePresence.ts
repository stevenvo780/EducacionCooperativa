'use client';

import { useEffect, useRef, useState } from 'react';
import {
  deduplicateByUser,
  joinPresence,
  PRESENCE_HEARTBEAT_MS,
  subscribePresence,
  type PresenceEntry
} from '@/lib/presence';

interface UsePresenceArgs {
  workspaceId: string | null;
  userId: string | null;
  displayName: string | null;
  photoURL?: string | null;
  currentDocId?: string | null;
  enabled?: boolean;
}

interface UsePresenceResult {
  sessionId: string | null;
  /** Otros usuarios presentes (deduplicados por userId, excluyendo la sesión actual). */
  peers: PresenceEntry[];
  /** Snapshot crudo (incluye tu propia sesión y todas las pestañas). */
  rawEntries: PresenceEntry[];
}

interface PresenceHandle {
  updateCurrentDoc: (docId: string | null) => Promise<void>;
  heartbeat: () => Promise<void>;
  leave: () => Promise<void>;
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

/**
 * Publica la presencia del usuario en el workspace y devuelve los peers
 * conectados. Cleanup vía `onDisconnect()` server-side + `leave()` al
 * desmontar.
 */
export function usePresence(args: UsePresenceArgs): UsePresenceResult {
  const enabled = args.enabled ?? true;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rawEntries, setRawEntries] = useState<PresenceEntry[]>([]);
  const handleRef = useRef<PresenceHandle | null>(null);

  // Suscripción al canal
  useEffect(() => {
    if (!enabled || !args.workspaceId) {
      setRawEntries([]);
      return;
    }
    return subscribePresence(args.workspaceId, setRawEntries);
  }, [enabled, args.workspaceId]);

  // Join + heartbeat. El currentDocId NO está en deps: se sincroniza por
  // separado en otro efecto vía handleRef.
  useEffect(() => {
    if (!enabled || !args.workspaceId || !args.userId || !args.displayName) {
      setSessionId(null);
      handleRef.current = null;
      return;
    }

    const newSessionId = generateSessionId();
    setSessionId(newSessionId);

    const ctrl = {
      cancelled: false,
      heartbeatTimer: null as ReturnType<typeof setInterval> | null,
      localHandle: null as PresenceHandle | null
    };

    const startHeartbeat = (handle: PresenceHandle) => {
      if (ctrl.heartbeatTimer) return;
      ctrl.heartbeatTimer = setInterval(() => {
        if (ctrl.cancelled) {
          if (ctrl.heartbeatTimer) {
            clearInterval(ctrl.heartbeatTimer);
            ctrl.heartbeatTimer = null;
          }
          return;
        }
        handle.heartbeat().catch(() => { /* RTDB hipa, no rompemos UI */ });
      }, PRESENCE_HEARTBEAT_MS);
    };

    const stopHeartbeat = () => {
      if (ctrl.heartbeatTimer) {
        clearInterval(ctrl.heartbeatTimer);
        ctrl.heartbeatTimer = null;
      }
    };

    // Pausamos el heartbeat cuando la pestaña está oculta. El TTL de
    // PRESENCE_TTL_MS (90s) cubre tabs en background sin que aparezcan
    // como online indefinidamente: si el user pasa >90s con la tab
    // hidden, los demás dejan de verlo. Al volver, un heartbeat inmediato
    // lo reconcilia. Esto reduce escrituras RTDB de ~2400/h por usuario
    // (con N tabs abiertas) a solo las pestañas visibles.
    const handleVisibilityChange = () => {
      const handle = ctrl.localHandle;
      if (!handle) return;
      if (document.hidden) {
        stopHeartbeat();
      } else {
        // Heartbeat inmediato + reanudar interval.
        handle.heartbeat().catch(() => { /* ignore */ });
        startHeartbeat(handle);
      }
    };

    (async () => {
      try {
        const handle = await joinPresence({
          workspaceId: args.workspaceId!,
          sessionId: newSessionId,
          userId: args.userId!,
          displayName: args.displayName!,
          photoURL: args.photoURL ?? undefined,
          currentDocId: args.currentDocId ?? undefined
        });
        if (ctrl.cancelled) {
          await handle.leave();
          return;
        }
        ctrl.localHandle = handle;
        handleRef.current = handle;
        if (typeof document === 'undefined' || !document.hidden) {
          startHeartbeat(handle);
        }
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', handleVisibilityChange);
        }
      } catch (err) {
        console.warn('[usePresence] join failed:', err);
      }
    })();

    return () => {
      ctrl.cancelled = true;
      stopHeartbeat();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      handleRef.current = null;
      ctrl.localHandle?.leave().catch(() => { /* ignore */ });
      setSessionId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentDocId se sincroniza aparte
  }, [enabled, args.workspaceId, args.userId, args.displayName, args.photoURL]);

  // Sincroniza el doc actual sin re-joinear
  useEffect(() => {
    handleRef.current?.updateCurrentDoc(args.currentDocId ?? null).catch(() => { /* ignore */ });
  }, [args.currentDocId]);

  const peers = sessionId
    ? deduplicateByUser(rawEntries.filter((e) => e.sessionId !== sessionId))
    : deduplicateByUser(rawEntries);

  return { sessionId, peers, rawEntries };
}

export default usePresence;
