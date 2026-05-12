import { useEffect, useRef } from 'react';
import { EMPTY_SEMANTIC_WORKSPACE_STATE } from '@/lib/semantic/workspace-state';
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';

const POLL_INTERVAL_MS = 15_000;

interface UseSemanticStateSyncerOptions {
  userId: string | null | undefined;
  isPageVisible: boolean;
  loadSemanticStateFromWorkspace: (options?: { seedFromLocal?: boolean; persistMerged?: boolean }) => Promise<void>;
  setSemanticState: (state: SemanticWorkspaceState) => void;
}

export function useSemanticStateSyncer({
  userId,
  isPageVisible,
  loadSemanticStateFromWorkspace,
  setSemanticState
}: UseSemanticStateSyncerOptions) {
  const fnRef = useRef(loadSemanticStateFromWorkspace);
  useEffect(() => { fnRef.current = loadSemanticStateFromWorkspace; });

  useEffect(() => {
    if (!userId) {
      setSemanticState(EMPTY_SEMANTIC_WORKSPACE_STATE);
      return;
    }
    void fnRef.current({ seedFromLocal: true, persistMerged: true });
  }, [userId, setSemanticState]);

  useEffect(() => {
    if (!userId || !isPageVisible) return;
    void fnRef.current({ seedFromLocal: false, persistMerged: false });
    const interval = window.setInterval(
      () => void fnRef.current({ seedFromLocal: false, persistMerged: false }),
      POLL_INTERVAL_MS
    );
    return () => window.clearInterval(interval);
  }, [isPageVisible, userId]);
}
