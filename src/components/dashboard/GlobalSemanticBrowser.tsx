'use client';

import { useState, useEffect, useMemo } from 'react';
import { SemanticBrowser, type SemanticTab } from '@/components/editor/SemanticBrowser';
import { loadSemanticWorkspaceState, type SemanticWorkspaceState } from '@/services/editorSemanticStore';
import { EMPTY_SEMANTIC_WORKSPACE_STATE } from '@/lib/semantic/workspace-state';
import type { BoardCard } from '@/components/dashboard/types';

interface GlobalSemanticBrowserProps {
  workspaceId?: string;
  userId?: string;
  /** When set, auto-navigate to the "archivos" tab and filter definitions to this file. */
  filterDocName?: string;
}

export default function GlobalSemanticBrowser({
  workspaceId,
  userId,
  filterDocName
}: GlobalSemanticBrowserProps) {
  const [state, setState] = useState<SemanticWorkspaceState>(EMPTY_SEMANTIC_WORKSPACE_STATE);

  useEffect(() => {
    if (!workspaceId) return;
    const loaded = loadSemanticWorkspaceState({ workspaceId, userId });
    setState(loaded);
  }, [workspaceId, userId]);

  /* Reload periodically to pick up changes from editors */
  useEffect(() => {
    if (!workspaceId) return;
    const interval = setInterval(() => {
      const loaded = loadSemanticWorkspaceState({ workspaceId, userId });
      setState(loaded);
    }, 3000);
    return () => clearInterval(interval);
  }, [workspaceId, userId]);

  const initialTab = useMemo<SemanticTab | undefined>(
    () => filterDocName ? 'archivos' : undefined,
    [filterDocName]
  );

  const emptyTasks = useMemo<BoardCard[]>(() => [], []);

  const noop = useMemo(() => () => {}, []);

  return (
    <SemanticBrowser
      docName={filterDocName || 'Espacio de trabajo'}
      state={state}
      linkedTasks={emptyTasks}
      onBack={noop}
      onInsertAtlas={noop}
      onInsertEvidenceMatrix={noop}
      onInsertResearchBrief={noop}
      standalone
      initialTab={initialTab}
      filterSTFile={filterDocName}
    />
  );
}
