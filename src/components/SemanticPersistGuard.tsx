'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppSelector } from '@/store/hooks';
import { selectCurrentWorkspace } from '@/store/dashboard.selectors';
import { clearSemanticStoreCache, flushSemanticWorkspaceState } from '@/services/editorSemanticStore';
import { checkQuotaAndEvict } from '@/lib/idb-eviction';

export default function SemanticPersistGuard() {
  const { user } = useAuth();
  const currentWorkspace = useAppSelector(selectCurrentWorkspace);
  const lastUidRef = useRef<string | null>(null);
  const lastWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const flush = () => flushSemanticWorkspaceState();
    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const uid = user?.uid ?? null;
    const prevUid = lastUidRef.current;
    if (prevUid !== null && prevUid !== uid) {
      clearSemanticStoreCache();
    }
    lastUidRef.current = uid;
  }, [user?.uid]);

  useEffect(() => {
    const wsId = currentWorkspace?.id ?? null;
    const prevWsId = lastWorkspaceIdRef.current;
    if (prevWsId !== null && prevWsId !== wsId) {
      clearSemanticStoreCache(prevWsId);
    }
    lastWorkspaceIdRef.current = wsId;
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!user?.uid) return;
    void checkQuotaAndEvict();
  }, [user?.uid]);

  return null;
}
