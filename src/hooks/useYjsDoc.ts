'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { FirebaseYjsProvider } from '@/lib/yjs/firebase-provider';
import { colorForUser } from '@/lib/presence';

interface UseYjsDocArgs {
  workspaceId: string | null;
  docId: string | null;
  userId: string | null;
  displayName: string | null;
  enabled?: boolean;
}

interface UseYjsDocResult {
  ydoc: Y.Doc | null;
  awareness: Awareness | null;
  provider: FirebaseYjsProvider | null;
  status: 'idle' | 'connecting' | 'connected' | 'disconnected';
}

/**
 * Crea un Y.Doc + Awareness sincronizados con Firebase RTDB.
 */
export function useYjsDoc({
  workspaceId,
  docId,
  userId,
  displayName,
  enabled = true
}: UseYjsDocArgs): UseYjsDocResult {
  const [status, setStatus] = useState<UseYjsDocResult['status']>('idle');
  const [tick, setTick] = useState(0);
  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const providerRef = useRef<FirebaseYjsProvider | null>(null);

  useEffect(() => {
    if (!enabled || !workspaceId || !docId) {
      setStatus('idle');
      return;
    }

    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);

    if (userId) {
      awareness.setLocalStateField('user', {
        id: userId,
        name: displayName ?? 'Anónimo',
        color: colorForUser(userId)
      });
    }

    const provider = new FirebaseYjsProvider({
      workspaceId,
      docId,
      ydoc,
      awareness,
      onStatusChange: setStatus
    });

    ydocRef.current = ydoc;
    awarenessRef.current = awareness;
    providerRef.current = provider;
    setTick((v) => v + 1);

    return () => {
      provider.destroy();
      awareness.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      awarenessRef.current = null;
      providerRef.current = null;
      setStatus('idle');
    };
  }, [enabled, workspaceId, docId, userId, displayName]);

  // tick fuerza re-render cuando se materializan los refs.
  void tick;

  return {
    ydoc: ydocRef.current,
    awareness: awarenessRef.current,
    provider: providerRef.current,
    status
  };
}

export default useYjsDoc;
