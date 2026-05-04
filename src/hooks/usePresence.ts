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

    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let localHandle: PresenceHandle | null = null;

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
        if (cancelled) {
          await handle.leave();
          return;
        }
        localHandle = handle;
        handleRef.current = handle;
        heartbeatTimer = setInterval(() => {
          handle.heartbeat().catch(() => { /* RTDB hipa, no rompemos UI */ });
        }, PRESENCE_HEARTBEAT_MS);
      } catch (err) {
        console.warn('[usePresence] join failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      handleRef.current = null;
      localHandle?.leave().catch(() => { /* ignore */ });
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
