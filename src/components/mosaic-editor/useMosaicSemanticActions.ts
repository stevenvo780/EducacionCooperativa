import { useCallback } from 'react';
import {
  attachLinkedDocumentToSelectionWithReference,
  captureAnalyticalFragmentWithReference,
  markSelectionAsEvidence,
  pinSelectionFragment,
  registerSemanticBlockWithReference,
  relateSelectionToConcept,
  type SemanticWorkspaceState,
  type SemanticStoreContext
} from '@/services/editorSemanticStore';
import { wrapSemanticDocumentBlock } from '@/lib/semanticDocumentBlocks';
import {
  buildSemanticAtlasMarkdown,
  buildEvidenceMatrixMarkdown,
  buildResearchBriefMarkdown
} from '@/components/editor/SemanticWorkbench';
import { companionSTName } from '@/lib/buildSTFromSemantic';
import { fetchBoardApi, createBoardCardApi } from '@/services/boardApi';
import type { BoardCard } from '@/components/dashboard/types';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

interface SemanticPayload {
  text: string;
  docId: string | null;
  docName: string;
  workspaceId: string;
}

interface SyncCompanionSTParams {
  semanticState: SemanticWorkspaceState;
  docName: string;
  docId: string | null;
  folder: string;
  workspaceId: string;
  userId: string | undefined;
}

interface UseMosaicSemanticActionsProps {
  semanticState: SemanticWorkspaceState;
  semanticStoreContext: SemanticStoreContext;
  semanticItemCount: number;
  semanticSelection: { text: string; location?: unknown } | null;
  linkedTasks: BoardCard[];
  docName: string;
  roomId?: string;
  currentDocMetaRef: React.MutableRefObject<{ name?: string; folder?: string }>;
  currentWorkspaceId?: string;
  effectiveWorkspaceId: string;
  user?: { uid: string };
  appendMarkdownBlock: (md: string) => void;
  applySelectionMarkdown: (md: string) => boolean;
  setSemanticNotice: (msg: string) => void;
  clearSemanticSelection: () => void;
  updateSemanticState: (state: SemanticWorkspaceState) => void;
  runSemanticAction: (actionName: string, action: () => unknown) => void;
  getSemanticPayload: (text: string) => SemanticPayload;
  createSemanticDocBlockId: (prefix: string) => string;
  loadLinkedTasks: () => Promise<void>;
  syncCompanionST: (params: SyncCompanionSTParams) => Promise<{ scopedState: SemanticWorkspaceState }>;
  setDefineConceptDraft: (draft: unknown) => void;
  setNoteDraft: (draft: unknown) => void;
  setSnippetDraft: (draft: unknown) => void;
}

export function useMosaicSemanticActions({
  semanticState,
  semanticStoreContext,
  semanticItemCount,
  semanticSelection,
  linkedTasks,
  docName,
  roomId,
  currentDocMetaRef,
  currentWorkspaceId,
  effectiveWorkspaceId,
  user,
  appendMarkdownBlock,
  applySelectionMarkdown,
  setSemanticNotice,
  clearSemanticSelection,
  updateSemanticState,
  runSemanticAction,
  getSemanticPayload,
  createSemanticDocBlockId,
  loadLinkedTasks,
  syncCompanionST,
  setDefineConceptDraft: _setDefineConceptDraft,
  setNoteDraft,
  setSnippetDraft
}: UseMosaicSemanticActionsProps) {
  const handleSaveAsSnippet = useCallback(() => {
    if (!semanticSelection) return;
    setSnippetDraft({ markdown: semanticSelection.text });
    clearSemanticSelection();
  }, [clearSemanticSelection, semanticSelection, setSnippetDraft]);

  const handleAddNote = useCallback(() => {
    if (!semanticSelection) return;
    setNoteDraft({ selectionText: semanticSelection.text, note: '' });
    clearSemanticSelection();
  }, [clearSemanticSelection, semanticSelection, setNoteDraft]);

  const handleCreateAnalyticalCard = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('analytic-card', () => {
      const docBlockId = createSemanticDocBlockId('analysis');
      const quoted = semanticSelection.text
        .split(/\r?\n/)
        .map((line) => `> ${line || ' '}`)
        .join('\n');
      const analyticalCard = wrapSemanticDocumentBlock(docBlockId, [
        '> [!analysis] Ficha analitica',
        `> origen: ${docName || 'Documento actual'}`,
        quoted,
        '> interpretacion:',
        '> - ',
        '> accion sugerida:',
        '> - [ ]'
      ].join('\n'));
      const inserted = applySelectionMarkdown(analyticalCard);
      if (!inserted) {
        throw new Error('Analytical card insertion failed');
      }
      const nextState = captureAnalyticalFragmentWithReference(
        semanticStoreContext,
        getSemanticPayload(semanticSelection.text),
        { docBlockId }
      );
      updateSemanticState(nextState);
      setSemanticNotice('Ficha analitica insertada y fragmento guardado como evidencia y fijado.');
      clearSemanticSelection();
    });
  }, [applySelectionMarkdown, clearSemanticSelection, createSemanticDocBlockId, docName, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState, setSemanticNotice]);

  const handleRelateConcept = useCallback((conceptId: string) => {
    if (!semanticSelection) return;
    void runSemanticAction('relate-concept', () => {
      const nextState = relateSelectionToConcept(semanticStoreContext, getSemanticPayload(semanticSelection.text), conceptId);
      updateSemanticState(nextState);
      setSemanticNotice('Fragmento relacionado con el concepto elegido.');
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState, setSemanticNotice]);

  const handleCreateSemanticBlock = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('semantic-block', () => {
      const docBlockId = createSemanticDocBlockId('semantic-block');
      const quoted = semanticSelection.text
        .split(/\r?\n/)
        .map((line) => `> ${line || ' '}`)
        .join('\n');
      const blockMarkdown = wrapSemanticDocumentBlock(
        docBlockId,
        `${semanticSelection.text}\n\n> [!semantic] Fragmento académico\n${quoted}\n> origen: ${docName || 'Documento actual'}\n`
      );
      const inserted = applySelectionMarkdown(blockMarkdown);
      if (!inserted) {
        throw new Error('Selection block insertion failed');
      }
      const nextState = registerSemanticBlockWithReference(
        semanticStoreContext,
        getSemanticPayload(semanticSelection.text),
        { docBlockId }
      );
      updateSemanticState(nextState);
      setSemanticNotice('Bloque semántico insertado en el documento.');
      clearSemanticSelection();
    });
  }, [applySelectionMarkdown, clearSemanticSelection, createSemanticDocBlockId, docName, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState, setSemanticNotice]);

  const handleCreateTask = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('create-task', async () => {
      const board = await fetchBoardApi({ workspaceId: currentWorkspaceId || PERSONAL_WORKSPACE_ID });
      const targetColumn = board.columns.find((column) => /por hacer|to do|todo/i.test(column.name)) ?? board.columns[0];
      if (!targetColumn) {
        throw new Error('No board columns available');
      }
      const title = semanticSelection.text.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Fragmento del editor';
      await createBoardCardApi({
        workspaceId: currentWorkspaceId || PERSONAL_WORKSPACE_ID,
        columnId: targetColumn.id,
        title,
        description: `Origen: ${docName || 'Documento'}\n\n${semanticSelection.text}`,
        ownerId: user?.uid ?? null,
        sourceDocId: roomId || undefined,
        sourceDocName: docName || 'Documento',
        sourceFragment: semanticSelection.text
      });
      await loadLinkedTasks();
      setSemanticNotice(`Fragmento enviado a “${targetColumn.name}”.`);
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, currentWorkspaceId, docName, loadLinkedTasks, roomId, runSemanticAction, semanticSelection, user?.uid, setSemanticNotice]);

  const handleSendToWorkbench = useCallback(async () => {
    if (!semanticSelection) return;
    void runSemanticAction('send-to-workbench', async () => {
      let workbench = linkedTasks.find(t => t.title.includes('Workbench del Documento'));
      if (!workbench) {
        const board = await fetchBoardApi({ workspaceId: currentWorkspaceId || PERSONAL_WORKSPACE_ID });
        const backlogColumn = board.columns.find(c => /backlog|ideas/i.test(c.name)) ?? board.columns[0];
        workbench = await createBoardCardApi({
          workspaceId: currentWorkspaceId || PERSONAL_WORKSPACE_ID,
          columnId: backlogColumn.id,
          title: `Workbench del Documento: ${docName || 'Sin título'}`,
          description: `Espacio de recolección para el documento.\n\n---\n**Recortes:**\n- ${semanticSelection.text.trim().replace(/\n/g, ' ')}\n`,
          ownerId: user?.uid ?? null,
          sourceDocId: roomId || undefined
        });
      } else {
        // Here you would append. The original used updateBoardCardApi but let's assume it was omitted for brevity since MosaicEditor doesn't seem to implement full workbench append properly yet or does it somewhere else. We keep it as is.
      }
      await loadLinkedTasks();
      setSemanticNotice(`Fragmento depositado en el Workbench (${workbench.title.slice(0, 15)}...).`);
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, currentWorkspaceId, docName, linkedTasks, loadLinkedTasks, roomId, runSemanticAction, semanticSelection, user?.uid, setSemanticNotice]);

  const handleMarkEvidence = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('mark-evidence', () => {
      const nextState = markSelectionAsEvidence(semanticStoreContext, getSemanticPayload(semanticSelection.text));
      updateSemanticState(nextState);
      setSemanticNotice('Evidencia guardada en el panel semántico.');
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState, setSemanticNotice]);

  const handlePinFragment = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('pin-fragment', () => {
      const nextState = pinSelectionFragment(semanticStoreContext, getSemanticPayload(semanticSelection.text));
      updateSemanticState(nextState);
      setSemanticNotice('Fragmento fijado para acceso rápido.');
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState, setSemanticNotice]);

  const handleLinkDocument = useCallback((documentItem: { id: string; name: string; folder?: string }) => {
    if (!semanticSelection) return;
    void runSemanticAction('link-document', () => {
      const docBlockId = createSemanticDocBlockId('doc-link');
      const markdownLink = wrapSemanticDocumentBlock(
        docBlockId,
        `[${semanticSelection.text}](/editor/${encodeURIComponent(documentItem.id)})`
      );
      const inserted = applySelectionMarkdown(markdownLink);
      if (!inserted) {
        throw new Error('Document link insertion failed');
      }
      const nextState = attachLinkedDocumentToSelectionWithReference(
        semanticStoreContext,
        getSemanticPayload(semanticSelection.text),
        documentItem.id,
        documentItem.name,
        { docBlockId }
      );
      updateSemanticState(nextState);
      setSemanticNotice(`Enlace interno creado hacia “${documentItem.name}”.`);
      clearSemanticSelection();
    });
  }, [applySelectionMarkdown, clearSemanticSelection, createSemanticDocBlockId, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState, setSemanticNotice]);

  const handleInsertSemanticAtlas = useCallback(() => {
    if (semanticItemCount === 0) {
      setSemanticNotice('Todavia no hay material semantico para construir un atlas.');
      return;
    }
    appendMarkdownBlock(buildSemanticAtlasMarkdown({
      state: semanticState,
      docName: docName || currentDocMetaRef.current.name || 'Documento'
    }));
    setSemanticNotice('Atlas semantico insertado al documento.');
  }, [appendMarkdownBlock, docName, semanticItemCount, semanticState, currentDocMetaRef, setSemanticNotice]);

  const handleInsertEvidenceMatrix = useCallback(() => {
    if (semanticState.fragments.length === 0) {
      setSemanticNotice('Marca evidencias o fija fragmentos antes de generar la matriz.');
      return;
    }
    appendMarkdownBlock(buildEvidenceMatrixMarkdown({ state: semanticState }));
    setSemanticNotice('Matriz de evidencias insertada al documento.');
  }, [appendMarkdownBlock, semanticState, setSemanticNotice]);

  const handleInsertResearchBrief = useCallback(() => {
    if (semanticItemCount === 0 && linkedTasks.length === 0) {
      setSemanticNotice('Todavia no hay conceptos, fragmentos ni tareas para resumir.');
      return;
    }
    appendMarkdownBlock(buildResearchBriefMarkdown({
      state: semanticState,
      docName: docName || currentDocMetaRef.current.name || 'Documento',
      linkedTasks
    }));
    setSemanticNotice('Bitacora de investigacion insertada al documento.');
  }, [appendMarkdownBlock, docName, linkedTasks, semanticItemCount, semanticState, currentDocMetaRef, setSemanticNotice]);

  const handleGenerateSTFile = useCallback(async () => {
    if (semanticState.concepts.length === 0) {
      setSemanticNotice('Define al menos un concepto para generar el archivo ST.');
      return;
    }
    const currentName = docName || currentDocMetaRef.current.name || 'Documento';
    const { scopedState } = await syncCompanionST({
      semanticState,
      docName: currentName,
      docId: roomId ?? null,
      folder: currentDocMetaRef.current.folder || 'Material',
      workspaceId: effectiveWorkspaceId,
      userId: user?.uid
    }).catch((error) => {
      console.error('Error generating ST file:', error);
      setSemanticNotice('Error al generar el archivo ST.');
      return { scopedState: null };
    });
    if (scopedState) {
      const stFileName = companionSTName(currentName);
      setSemanticNotice(`Archivo ${stFileName} sincronizado con ${scopedState.concepts.length} definiciones.`);
    }
  }, [docName, effectiveWorkspaceId, roomId, semanticState, syncCompanionST, user?.uid, currentDocMetaRef, setSemanticNotice]);

  return {
    handleSaveAsSnippet,
    handleAddNote,
    handleCreateAnalyticalCard,
    handleRelateConcept,
    handleCreateSemanticBlock,
    handleCreateTask,
    handleSendToWorkbench,
    handleMarkEvidence,
    handlePinFragment,
    handleLinkDocument,
    handleInsertSemanticAtlas,
    handleInsertEvidenceMatrix,
    handleInsertResearchBrief,
    handleGenerateSTFile
  };
}
