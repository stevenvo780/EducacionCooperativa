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
  setSemanticWorkspacePreferences,
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
import { syncSTSourceToSemanticWorkspace } from '@/services/semanticSyncService';
import { removeSemanticBlockFromDocument } from '@/services/semanticDocumentSync';
import { buildTheoryGraphFromSemanticState, type TheoryGraphQuickFix } from '@/lib/semantic/theory-graph';
import { buildSTFromSemantic } from '@/lib/buildSTFromSemantic';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

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
  const isPageVisible = usePageVisibility();
  const isOnline = useOnlineStatus();

  /* ── Mutation lock: prevents reload from overwriting in-flight changes ── */
  const mutatingRef = useRef(false);
  const lastReloadAtRef = useRef(0);

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

  const scheduleReload = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastReloadAtRef.current < 500) return;
    lastReloadAtRef.current = now;
    reload();
  }, [reload]);

  useEffect(() => { scheduleReload(true); }, [scheduleReload]);

  useEffect(() => {
    if (!workspaceId || !isPageVisible || !isOnline) return;
    const interval = setInterval(() => scheduleReload(), 30000);
    return () => clearInterval(interval);
  }, [workspaceId, isOnline, isPageVisible, scheduleReload]);

  useEffect(() => {
    if (!workspaceId) return;

    const handleWindowSync = () => scheduleReload();
    const handleVisibilitySync = () => {
      if (!document.hidden) scheduleReload(true);
    };

    window.addEventListener('agora:docs-changed', handleWindowSync);
    window.addEventListener('agora:doc-content-updated', handleWindowSync);
    window.addEventListener('focus', handleWindowSync);
    window.addEventListener('online', handleWindowSync);
    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      window.removeEventListener('agora:docs-changed', handleWindowSync);
      window.removeEventListener('agora:doc-content-updated', handleWindowSync);
      window.removeEventListener('focus', handleWindowSync);
      window.removeEventListener('online', handleWindowSync);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [workspaceId, scheduleReload]);

  /* Round-trip: when a .md.st companion is saved, sync its content back into the semantic workspace */
  useEffect(() => {
    if (!workspaceId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ docId?: string; docName?: string; content?: string }>).detail;
      if (!detail?.docName?.endsWith('.md.st') || !detail.content) return;
      void syncSTSourceToSemanticWorkspace({
        workspaceId,
        userId,
        docId: detail.docId ?? null,
        docName: detail.docName,
        source: detail.content,
        persistRemote: false
      }).then(() => scheduleReload(true)).catch((err) => {
        console.error('[GlobalSemanticBrowser] Round-trip sync failed', err);
      });
    };
    window.addEventListener('agora:st-source-saved', handler);
    return () => window.removeEventListener('agora:st-source-saved', handler);
  }, [workspaceId, userId, scheduleReload]);

  const ctx = useMemo(() => workspaceId ? { workspaceId, userId: userId ?? undefined } : null, [workspaceId, userId]);

  const conceptsById = useMemo(
    () => new Map(state.concepts.map(c => [c.id, c])),
    [state.concepts]
  );
  const fragmentsById = useMemo(
    () => new Map(state.fragments.map(f => [f.id, f])),
    [state.fragments]
  );
  const relationsById = useMemo(
    () => new Map(state.relations.map(r => [r.id, r])),
    [state.relations]
  );

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
    const concept = conceptsById.get(conceptId);
    const nextState = deleteConcept(ctx, conceptId);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteConcept failed', err));
  }, [ctx, persistAndSync, conceptsById]);

  const handleDeleteFragment = useCallback((fragmentId: string) => {
    if (!ctx) return;
    const fragment = fragmentsById.get(fragmentId);
    if (!fragment) return;
    void deleteReferencedFragment(fragment)
      .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteFragment failed', err));
  }, [ctx, deleteReferencedFragment, fragmentsById]);

  const handleDeleteRelation = useCallback((relationId: string) => {
    if (!ctx) return;
    const relation = relationsById.get(relationId);
    if (!relation) return;

    const relationFragment = fragmentsById.get(relation.fragmentId);
    if (relationFragment) {
      void deleteReferencedFragment(relationFragment)
        .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteRelation(fragment) failed', err));
      return;
    }

    const concept = conceptsById.get(relation.conceptId);
    const nextState = deleteRelation(ctx, relationId);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleDeleteRelation failed', err));
  }, [ctx, deleteReferencedFragment, persistAndSync, conceptsById, fragmentsById, relationsById]);

  const handleEditConcept = useCallback((conceptId: string, updates: { title?: string; definition?: string; formula?: string }) => {
    if (!ctx) return;
    const concept = conceptsById.get(conceptId);
    const nextState = updateConcept(ctx, conceptId, updates);
    void persistAndSync(nextState, concept ? [{ docId: concept.docId, docName: concept.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleEditConcept failed', err));
  }, [ctx, persistAndSync, conceptsById]);

  const handleEditFragment = useCallback((fragmentId: string, updates: { text?: string; note?: string }) => {
    if (!ctx) return;
    const fragment = fragmentsById.get(fragmentId);
    const nextState = updateFragment(ctx, fragmentId, updates);
    void persistAndSync(nextState, fragment ? [{ docId: fragment.docId, docName: fragment.docName }] : [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleEditFragment failed', err));
  }, [ctx, persistAndSync, fragmentsById]);

  const initialTab = useMemo<SemanticTab | undefined>(
    () => filterDocName ? 'archivos' : undefined,
    [filterDocName]
  );

  const emptyTasks = useMemo<BoardCard[]>(() => [], []);

  const noop = useMemo(() => () => {}, []);

  const theoryGraph = useMemo(() => buildTheoryGraphFromSemanticState(state, {
    sourceDocument: { docName: filterDocName || 'Espacio de trabajo' }
  }), [filterDocName, state]);

  const stPreviewContent = useMemo(() => buildSTFromSemantic(state, filterDocName || 'Espacio de trabajo'), [filterDocName, state]);

  const handleExperienceModeChange = useCallback((mode: 'assisted' | 'hybrid' | 'expert') => {
    if (!ctx) return;
    const nextState = setSemanticWorkspacePreferences(ctx, { experienceMode: mode });
    void persistAndSync(nextState, [])
      .catch((err) => console.error('[GlobalSemanticBrowser] handleExperienceModeChange failed', err));
  }, [ctx, persistAndSync]);

  const handleApplyQuickFix = useCallback((fix: TheoryGraphQuickFix) => {
    if (!ctx) return;

    if (fix.kind === 'weaken-claim' || fix.kind === 'add-condition' || fix.kind === 'mark-dialectical-tension') {
      const targetNode = theoryGraph.nodes.find((node) => node.id === fix.targetNodeId || node.id === fix.sourceNodeId);
      const conceptId = typeof targetNode?.metadata?.conceptId === 'string'
        ? targetNode.metadata.conceptId
        : state.concepts.find((concept) => concept.title === targetNode?.label)?.id;
      if (!conceptId) return;
      const nextState = updateConcept(ctx, conceptId, {
        status: fix.kind === 'mark-dialectical-tension' ? 'contradicted' : 'draft'
      });
      void persistAndSync(nextState, [])
        .catch((err) => console.error('[GlobalSemanticBrowser] handleApplyQuickFix(concept) failed', err));
      return;
    }

    if (fix.kind === 'link-missing-evidence') {
      const targetNode = theoryGraph.nodes.find((node) => node.id === fix.targetNodeId);
      const sourceNode = theoryGraph.nodes.find((node) => node.id === fix.sourceNodeId);
      const conceptId = typeof targetNode?.metadata?.conceptId === 'string'
        ? targetNode.metadata.conceptId
        : state.concepts.find((concept) => concept.title === targetNode?.label)?.id;
      const fragmentId = typeof sourceNode?.metadata?.fragmentId === 'string'
        ? sourceNode.metadata.fragmentId
        : state.fragments.find((fragment) => fragment.excerpt === sourceNode?.label || fragment.text === sourceNode?.text)?.id;

      if (!conceptId) return;
      const sourceFragment = fragmentId
        ? fragmentsById.get(fragmentId)
        : state.fragments.find((fragment) => fragment.kind === 'evidence');
      if (!sourceFragment) return;

      const nextState = {
        ...state,
        relations: [
          {
            id: `${sourceFragment.id}:${conceptId}:evidence-for`,
            fragmentId: sourceFragment.id,
            conceptId,
            conceptTitle: conceptsById.get(conceptId)?.title || targetNode?.label || conceptId,
            relationType: 'evidence-for' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            docId: sourceFragment.docId,
            origin: 'semantic-ui' as const,
            scope: 'document' as const,
            status: 'validated' as const,
            stableKey: `${sourceFragment.id}:${conceptId}:evidence-for`,
            sourceEntityId: sourceFragment.id,
            targetEntityId: conceptId,
            sourceRefs: sourceFragment.sourceRefs || []
          },
          ...state.relations.filter((relation) => !(relation.fragmentId === sourceFragment.id && relation.conceptId === conceptId))
        ]
      };
      void persistAndSync(nextState, [{ docId: sourceFragment.docId, docName: sourceFragment.docName }])
        .catch((err) => console.error('[GlobalSemanticBrowser] handleApplyQuickFix(evidence) failed', err));
    }
  }, [ctx, persistAndSync, state, theoryGraph.nodes, conceptsById, fragmentsById]);

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
      experienceMode={state.preferences.experienceMode}
      onExperienceModeChange={handleExperienceModeChange}
      theoryGraph={theoryGraph}
      verificationDiagnostics={theoryGraph.diagnostics}
      onApplyQuickFix={handleApplyQuickFix}
      stPreviewContent={stPreviewContent}
      onDeleteConcept={handleDeleteConcept}
      onDeleteFragment={handleDeleteFragment}
      onDeleteRelation={handleDeleteRelation}
      onEditConcept={handleEditConcept}
      onEditFragment={handleEditFragment}
    />
  );
}
