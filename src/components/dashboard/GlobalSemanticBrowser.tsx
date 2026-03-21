'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SemanticBrowser, type SemanticTab } from '@/components/editor/SemanticBrowser';
import {
  loadSemanticWorkspaceState,
  saveSemanticWorkspaceState,
  deleteConcept,
  deleteFragmentsByDocBlockId,
  deleteFragment,
  deleteRelation,
  updateConcept,
  updateFragment,
  type SemanticWorkspaceState
} from '@/services/editorSemanticStore';
import {
  EMPTY_SEMANTIC_WORKSPACE_STATE,
  mergeSemanticWorkspaceStates,
  type SemanticFragmentRecord,
  type SemanticDocumentRef
} from '@/lib/semantic/workspace-state';
import type { BoardCard } from '@/components/dashboard/types';
import { fetchSemanticWorkspaceStateApi, saveSemanticWorkspaceStateApi } from '@/services/semanticStateApi';
import { syncSemanticCompanionFiles } from '@/services/semanticCompanionSync';
import { removeSemanticBlockFromDocument } from '@/services/semanticDocumentSync';

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
    const localState = loadSemanticWorkspaceState({ workspaceId, userId });
    setState(localState);
    void fetchSemanticWorkspaceStateApi(workspaceId)
      .then((remoteState) => {
        const mergedState = mergeSemanticWorkspaceStates(remoteState ?? EMPTY_SEMANTIC_WORKSPACE_STATE, localState);
        saveSemanticWorkspaceState({ workspaceId, userId }, mergedState);
        setState(mergedState);
      })
      .catch(() => {
        setState(localState);
      });
  }, [workspaceId, userId]);

  useEffect(() => { reload(); }, [reload]);

  /* Reload periodically to pick up changes from editors */
  useEffect(() => {
    if (!workspaceId) return;
    const interval = setInterval(reload, 3000);
    return () => clearInterval(interval);
  }, [workspaceId, reload]);

  const ctx = useMemo(() => workspaceId ? { workspaceId, userId: userId ?? undefined } : null, [workspaceId, userId]);

  const persistAndSync = useCallback(async (nextState: SemanticWorkspaceState, affectedDocs: SemanticDocumentRef[]) => {
    if (!ctx) return;

    const persistedState = await saveSemanticWorkspaceStateApi(ctx.workspaceId, nextState) ?? nextState;
    saveSemanticWorkspaceState({ workspaceId: ctx.workspaceId, userId: ctx.userId ?? null }, persistedState);
    setState(persistedState);

    await syncSemanticCompanionFiles({
      workspaceId: ctx.workspaceId,
      state: persistedState,
      documentRefs: affectedDocs
    });
  }, [ctx]);

  const deleteReferencedFragment = useCallback(async (fragment: SemanticFragmentRecord) => {
    if (!ctx) return;

    if (fragment.docId && fragment.docBlockId) {
      await removeSemanticBlockFromDocument(fragment.docId, fragment.docBlockId);
    }

    const nextState = fragment.docBlockId
      ? deleteFragmentsByDocBlockId(ctx, fragment.docBlockId)
      : deleteFragment(ctx, fragment.id);

    await persistAndSync(nextState, [{ docId: fragment.docId, docName: fragment.docName }]);
  }, [ctx, persistAndSync]);

  const handleDeleteConcept = useCallback((conceptId: string) => {
    if (!ctx) return;
    const concept = state.concepts.find((item) => item.id === conceptId);
    const nextState = deleteConcept(ctx, conceptId);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : []);
  }, [ctx, persistAndSync, state.concepts]);

  const handleDeleteFragment = useCallback((fragmentId: string) => {
    if (!ctx) return;
    const fragment = state.fragments.find((item) => item.id === fragmentId);
    if (!fragment) return;
    void deleteReferencedFragment(fragment);
  }, [ctx, deleteReferencedFragment, state.fragments]);

  const handleDeleteRelation = useCallback((relationId: string) => {
    if (!ctx) return;
    const relation = state.relations.find((item) => item.id === relationId);
    if (!relation) return;

    const relationFragment = state.fragments.find((item) => item.id === relation.fragmentId);
    if (relationFragment) {
      void deleteReferencedFragment(relationFragment);
      return;
    }

    const concept = state.concepts.find((item) => item.id === relation.conceptId);
    const nextState = deleteRelation(ctx, relationId);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : []);
  }, [ctx, deleteReferencedFragment, persistAndSync, state.concepts, state.fragments, state.relations]);

  const handleEditConcept = useCallback((conceptId: string, updates: { title?: string; definition?: string; formula?: string }) => {
    if (!ctx) return;
    const concept = state.concepts.find((item) => item.id === conceptId);
    const nextState = updateConcept(ctx, conceptId, updates);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : []);
  }, [ctx, persistAndSync, state.concepts]);

  const handleEditFragment = useCallback((fragmentId: string, updates: { text?: string }) => {
    if (!ctx) return;
    const fragment = state.fragments.find((item) => item.id === fragmentId);
    const nextState = updateFragment(ctx, fragmentId, updates);
    void persistAndSync(nextState, fragment ? [{ docId: fragment.docId, docName: fragment.docName }] : []);
  }, [ctx, persistAndSync, state.fragments]);

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
