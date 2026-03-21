'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

  /* ── Mutation lock: prevents reload from overwriting in-flight changes ── */
  const mutatingRef = useRef(false);

  const reload = useCallback(() => {
    if (!workspaceId) return;
    /* While a mutation (delete/edit) is persisting, skip remote merge to avoid
       the additive union resurrecting items that were just deleted locally. */
    if (mutatingRef.current) return;

    const localState = loadSemanticWorkspaceState({ workspaceId, userId });
    setState(localState);
    void fetchSemanticWorkspaceStateApi(workspaceId)
      .then((remoteState) => {
        /* Guard again — a mutation may have started while the fetch was in-flight */
        if (mutatingRef.current) return;
        const mergedState = mergeSemanticWorkspaceStates(remoteState ?? EMPTY_SEMANTIC_WORKSPACE_STATE, localState);
        saveSemanticWorkspaceState({ workspaceId, userId }, mergedState);
        setState(mergedState);
      })
      .catch(() => {
        if (!mutatingRef.current) setState(localState);
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

    mutatingRef.current = true;
    try {
      /* 1. Immediately update React state + localStorage so the UI is responsive */
      saveSemanticWorkspaceState({ workspaceId: ctx.workspaceId, userId: ctx.userId ?? null }, nextState);
      setState(nextState);

      /* 2. Persist to Firestore */
      let stateToSync = nextState;
      try {
        const persistedState = await saveSemanticWorkspaceStateApi(ctx.workspaceId, nextState);
        stateToSync = persistedState ?? nextState;
      } catch (err) {
        console.error('[GlobalSemanticBrowser] API save failed, syncing with local state', err);
      }

      /* 3. Ensure localStorage stays consistent with the persisted state */
      saveSemanticWorkspaceState({ workspaceId: ctx.workspaceId, userId: ctx.userId ?? null }, stateToSync);
      setState(stateToSync);

      /* 4. Sync companion .st files */
      try {
        await syncSemanticCompanionFiles({
          workspaceId: ctx.workspaceId,
          state: stateToSync,
          documentRefs: affectedDocs
        });
      } catch (err) {
        console.error('[GlobalSemanticBrowser] Companion sync failed', err);
      }
    } finally {
      mutatingRef.current = false;
    }
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
    /* Use void + catch to avoid unhandled rejections — the lock inside
       persistAndSync already blocks reload from overwriting this mutation. */
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteConcept failed', err));
  }, [ctx, persistAndSync, state.concepts]);

  const handleDeleteFragment = useCallback((fragmentId: string) => {
    if (!ctx) return;
    const fragment = state.fragments.find((item) => item.id === fragmentId);
    if (!fragment) return;
    void deleteReferencedFragment(fragment)
      .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteFragment failed', err));
  }, [ctx, deleteReferencedFragment, state.fragments]);

  const handleDeleteRelation = useCallback((relationId: string) => {
    if (!ctx) return;
    const relation = state.relations.find((item) => item.id === relationId);
    if (!relation) return;

    const relationFragment = state.fragments.find((item) => item.id === relation.fragmentId);
    if (relationFragment) {
      void deleteReferencedFragment(relationFragment)
        .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteRelation(fragment) failed', err));
      return;
    }

    const concept = state.concepts.find((item) => item.id === relation.conceptId);
    const nextState = deleteRelation(ctx, relationId);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteRelation failed', err));
  }, [ctx, deleteReferencedFragment, persistAndSync, state.concepts, state.fragments, state.relations]);

  const handleEditConcept = useCallback((conceptId: string, updates: { title?: string; definition?: string; formula?: string }) => {
    if (!ctx) return;
    const concept = state.concepts.find((item) => item.id === conceptId);
    const nextState = updateConcept(ctx, conceptId, updates);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleEditConcept failed', err));
  }, [ctx, persistAndSync, state.concepts]);

  const handleEditFragment = useCallback((fragmentId: string, updates: { text?: string }) => {
    if (!ctx) return;
    const fragment = state.fragments.find((item) => item.id === fragmentId);
    const nextState = updateFragment(ctx, fragmentId, updates);
    void persistAndSync(nextState, fragment ? [{ docId: fragment.docId, docName: fragment.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleEditFragment failed', err));
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
