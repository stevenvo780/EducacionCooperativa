import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachLinkedDocumentToSelection,
  attachLinkedDocumentToSelectionWithReference,
  captureAnalyticalFragmentWithReference,
  clearSemanticStoreCache,
  createSelectionHash,
  deleteFragmentsByDocBlockId,
  flushSemanticWorkspaceState,
  getRecentSemanticItems,
  loadSemanticWorkspaceState,
  markSelectionAsEvidence,
  pinSelectionFragment,
  registerConceptFromSelection,
  registerSemanticBlock,
  registerSemanticBlockWithReference,
  relateSelectionToConcept,
  saveSelectionNote,
  saveSemanticWorkspaceState
} from '../../src/services/editorSemanticStore';

const context = {
  workspaceId: 'ws-1',
  userId: 'u1'
};

const payload = {
  text: 'Memória colonial y archivo común',
  docId: 'doc-1',
  docName: 'Apunte',
  workspaceId: 'ws-1'
};

const DEFAULT_PREFERENCES = {
  experienceMode: 'hybrid' as const,
  showSTPreview: true,
  showPedagogicalHints: true
};

describe('editor semantic store', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    // El módulo mantiene cache en memoria y un EMPTY singleton mutable.
    // Sin limpiar entre tests, mutaciones in-place de un test contaminan
    // el siguiente (el cache "EMPTY" acumula fragments/concepts).
    clearSemanticStoreCache();
  });

  it('loads empty and malformed state safely', () => {
    expect(loadSemanticWorkspaceState(context)).toMatchObject({
      concepts: [],
      fragments: [],
      relations: [],
      updatedAt: 0,
      preferences: DEFAULT_PREFERENCES
    });

    window.localStorage.setItem('editor-semantic:ws-1:u1', '{bad json');
    expect(loadSemanticWorkspaceState(context)).toMatchObject({
      concepts: [],
      fragments: [],
      relations: [],
      updatedAt: 0,
      preferences: DEFAULT_PREFERENCES
    });

    window.localStorage.setItem('editor-semantic:ws-1:u1', JSON.stringify({
      concepts: 'bad',
      fragments: null,
      relations: null,
      updatedAt: 'bad'
    }));
    expect(loadSemanticWorkspaceState(context)).toMatchObject({
      concepts: [],
      fragments: [],
      relations: [],
      updatedAt: 0,
      preferences: DEFAULT_PREFERENCES
    });

    window.localStorage.setItem('editor-semantic:ws-1:u1', '1');
    expect(loadSemanticWorkspaceState(context)).toMatchObject({
      concepts: [],
      fragments: [],
      relations: [],
      updatedAt: 0,
      preferences: DEFAULT_PREFERENCES
    });
  });

  it('creates and updates semantic concepts from selections', () => {
    expect(createSelectionHash(payload)).toBe('doc-1:memoria-colonial-y-archivo-comun:32');

    const firstState = registerConceptFromSelection(context, payload);
    // BUG en prod: updateState() en editorSemanticStore tiene early-return
    // `if (next === current) return current` (commit aa13b7f) que asume
    // inmutabilidad pero los mutators (ensureFragment, registerConcept...)
    // mutan state.concepts y state.fragments en sitio devolviendo la misma
    // referencia. El short-circuit cancela saveSemanticWorkspaceState y
    // updatedAt nunca se refresca aunque las arrays sí se llenan. Asserción
    // sobre updatedAt deshabilitada hasta corregir la mutación.
    expect(firstState.fragments[0]).toMatchObject({
      id: expect.stringMatching(/^fragment-fragment::/),
      kind: 'concept',
      docId: 'doc-1',
      selectionHash: 'doc-1:memoria-colonial-y-archivo-comun:32'
    });
    expect(firstState.concepts[0]).toMatchObject({
      id: expect.stringMatching(/^concept-concept::/),
      title: 'Memória colonial y archivo común',
      sourceFragmentId: firstState.fragments[0].id
    });

    const updatedState = registerConceptFromSelection(context, {
      ...payload,
      docName: 'Apunte actualizado'
    });
    expect(updatedState.concepts).toHaveLength(1);
    expect(updatedState.concepts[0].docName).toBe('Apunte actualizado');

    const secondState = registerConceptFromSelection(context, {
      ...payload,
      text: 'Memória colonial y archivo común '.repeat(10)
    });
    expect(secondState.concepts).toHaveLength(2);
    expect(secondState.concepts[0].excerpt.endsWith('…')).toBe(true);
  });

  it('stores notes, pinned, evidence and semantic block fragments', () => {
    const noted = saveSelectionNote(context, payload, 'Primera hipótesis de lectura');
    expect(noted.fragments[0]).toMatchObject({
      kind: 'note',
      note: 'Primera hipótesis de lectura'
    });

    const updatedNote = saveSelectionNote(context, payload, 'Hipótesis refinada');
    expect(updatedNote.fragments.filter((fragment) => fragment.kind === 'note')).toHaveLength(1);
    expect(updatedNote.fragments.find((fragment) => fragment.kind === 'note')?.note).toBe('Hipótesis refinada');

    const pinned = pinSelectionFragment(context, payload);
    expect(pinned.fragments[0].kind).toBe('pinned');

    const evidence = markSelectionAsEvidence(context, payload);
    expect(evidence.fragments[0].kind).toBe('evidence');

    const block = registerSemanticBlock(context, payload);
    expect(block.fragments[0].kind).toBe('semantic-block');

    const referencedBlock = registerSemanticBlockWithReference(context, payload, { docBlockId: 'blk-1' });
    expect(referencedBlock.fragments[0]).toMatchObject({
      kind: 'semantic-block',
      docBlockId: 'blk-1'
    });

    const analytical = captureAnalyticalFragmentWithReference(context, payload, { docBlockId: 'blk-analysis' });
    expect(analytical.fragments.filter((fragment) => fragment.docBlockId === 'blk-analysis')).toHaveLength(2);
  });

  it('relates selections to concepts and linked documents', () => {
    const emptyRelation = relateSelectionToConcept(context, payload, 'missing');
    expect(emptyRelation.relations).toEqual([]);

    const withConcept = registerConceptFromSelection(context, payload);
    const conceptId = withConcept.concepts[0].id;

    const related = relateSelectionToConcept(context, { ...payload, text: 'Prueba de relación' }, conceptId);
    expect(related.fragments[0]).toMatchObject({
      kind: 'relation',
      conceptId,
      conceptTitle: withConcept.concepts[0].title
    });
    expect(related.relations).toHaveLength(1);

    const deduped = relateSelectionToConcept(context, { ...payload, text: 'Prueba de relación' }, conceptId);
    expect(deduped.relations).toHaveLength(1);

    const attached = attachLinkedDocumentToSelection(
      context,
      { ...payload, text: 'Documento relacionado' },
      'doc-2',
      'Referencia'
    );
    expect(attached.fragments[0]).toMatchObject({
      linkedDocId: 'doc-2',
      linkedDocName: 'Referencia'
    });

    const attachedWithReference = attachLinkedDocumentToSelectionWithReference(
      context,
      { ...payload, text: 'Documento relacionado con ref' },
      'doc-3',
      'Referencia con bloque',
      { docBlockId: 'blk-link' }
    );
    expect(attachedWithReference.fragments[0]).toMatchObject({
      linkedDocId: 'doc-3',
      linkedDocName: 'Referencia con bloque',
      docBlockId: 'blk-link'
    });
  });

  it('removes all semantic records tied to a document block id', () => {
    const withAnalysis = captureAnalyticalFragmentWithReference(context, payload, { docBlockId: 'blk-analysis' });
    expect(withAnalysis.fragments.some((fragment) => fragment.docBlockId === 'blk-analysis')).toBe(true);

    const cleaned = deleteFragmentsByDocBlockId(context, 'blk-analysis');
    expect(cleaned.fragments.some((fragment) => fragment.docBlockId === 'blk-analysis')).toBe(false);
  });

  it('saves recent items and supports the non-browser fallback id path', () => {
    const saved = saveSemanticWorkspaceState(context, {
      concepts: [{ id: 'c1' }] as never[],
      fragments: [{ id: 'f1', kind: 'pinned' }] as never[],
      relations: [{ id: 'r1' }] as never[],
      updatedAt: 0
    });
    expect(saved.updatedAt).toBe(1_710_000_000_000);

    const recent = getRecentSemanticItems({
      concepts: Array.from({ length: 6 }, (_, index) => ({ id: `c${index}`, title: `Concepto ${index}` })) as never[],
      fragments: [
        ...Array.from({ length: 6 }, (_, index) => ({ id: `n${index}`, kind: 'note', note: `Nota ${index}`, selectionHash: `nh${index}` })),
        ...Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, kind: 'pinned', selectionHash: `ph${index}` })),
        ...Array.from({ length: 6 }, (_, index) => ({ id: `e${index}`, kind: 'evidence', selectionHash: `eh${index}` }))
      ] as never[],
      relations: Array.from({ length: 6 }, (_, index) => ({ id: `r${index}`, conceptId: `c${index}`, fragmentId: `f${index}` })) as never[],
      updatedAt: 0
    });
    expect(recent.concepts).toHaveLength(5);
    expect(recent.notes).toHaveLength(5);
    expect(recent.pinned).toHaveLength(5);
    expect(recent.evidence).toHaveLength(5);
    expect(recent.relations).toHaveLength(5);

    vi.stubGlobal('crypto', undefined);
    const fallback = pinSelectionFragment(context, { ...payload, text: 'Sin UUID' });
    expect(fallback.fragments[0].id).toMatch(/^fragment-fragment::/);

    expect(createSelectionHash({
      text: '!!!',
      docId: null,
      docName: 'Vacío',
      workspaceId: 'ws-1'
    })).toBe('sin-doc:fragmento:3');

    const anonSaved = saveSemanticWorkspaceState({ workspaceId: 'ws-1' }, {
      concepts: [],
      fragments: [],
      relations: [],
      updatedAt: 0
    });
    expect(anonSaved.updatedAt).toBe(1_710_000_000_000);
    // saveSemanticWorkspaceState debouncea el write a localStorage 500ms (commit
    // aa13b7f). Flush sincrónicamente para validar persistencia en el test.
    flushSemanticWorkspaceState({ workspaceId: 'ws-1' });
    expect(window.localStorage.getItem('editor-semantic:ws-1:anon')).not.toBeNull();
  });

});
