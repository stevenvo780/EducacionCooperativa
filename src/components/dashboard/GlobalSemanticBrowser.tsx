'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SemanticBrowser, type SemanticTab } from '@/components/editor/SemanticBrowser';
import {
  loadSemanticWorkspaceState,
  deleteConcept,
  deleteFragment,
  deleteRelation,
  updateConcept,
  updateFragment,
  type SemanticWorkspaceState
} from '@/services/editorSemanticStore';
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

  const reload = useCallback(() => {
    if (!workspaceId) return;
    setState(loadSemanticWorkspaceState({ workspaceId, userId }));
  }, [workspaceId, userId]);

  useEffect(() => { reload(); }, [reload]);

  /* Reload periodically to pick up changes from editors */
  useEffect(() => {
    if (!workspaceId) return;
    const interval = setInterval(reload, 3000);
    return () => clearInterval(interval);
  }, [workspaceId, reload]);

  const ctx = useMemo(() => workspaceId ? { workspaceId, userId: userId ?? undefined } : null, [workspaceId, userId]);

  const handleDeleteConcept = useCallback((conceptId: string) => {
    if (!ctx) return;
    deleteConcept(ctx, conceptId);
    reload();
  }, [ctx, reload]);

  const handleDeleteFragment = useCallback((fragmentId: string) => {
    if (!ctx) return;
    deleteFragment(ctx, fragmentId);
    reload();
  }, [ctx, reload]);

  const handleDeleteRelation = useCallback((relationId: string) => {
    if (!ctx) return;
    deleteRelation(ctx, relationId);
    reload();
  }, [ctx, reload]);

  const handleEditConcept = useCallback((conceptId: string, updates: { title?: string; definition?: string; formula?: string }) => {
    if (!ctx) return;
    updateConcept(ctx, conceptId, updates);
    reload();
  }, [ctx, reload]);

  const handleEditFragment = useCallback((fragmentId: string, updates: { text?: string }) => {
    if (!ctx) return;
    updateFragment(ctx, fragmentId, updates);
    reload();
  }, [ctx, reload]);

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
      onDeleteConcept={handleDeleteConcept}
      onDeleteFragment={handleDeleteFragment}
      onDeleteRelation={handleDeleteRelation}
      onEditConcept={handleEditConcept}
      onEditFragment={handleEditFragment}
    />
  );
}
