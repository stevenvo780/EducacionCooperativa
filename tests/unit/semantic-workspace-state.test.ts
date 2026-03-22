import { describe, expect, it } from 'vitest';
import {
  normalizeSemanticWorkspaceState,
  filterSemanticWorkspaceStateByDocument,
  type SemanticWorkspaceState
} from '../../src/lib/semantic/workspace-state';

describe('semantic workspace state helpers', () => {
  it('filters semantic state by source document before building companions', () => {
    const state: SemanticWorkspaceState = {
      concepts: [
        {
          id: 'concept-a',
          title: 'Concepto A',
          definition: 'Def A',
          excerpt: 'Texto A',
          docId: 'doc-a',
          docName: 'A.md',
          workspaceId: 'ws-1',
          createdAt: 1,
          updatedAt: 10,
          sourceFragmentId: 'fragment-a'
        },
        {
          id: 'concept-b',
          title: 'Concepto B',
          definition: 'Def B',
          excerpt: 'Texto B',
          docId: 'doc-b',
          docName: 'B.md',
          workspaceId: 'ws-1',
          createdAt: 2,
          updatedAt: 20,
          sourceFragmentId: 'fragment-b'
        }
      ],
      fragments: [
        {
          id: 'fragment-a',
          kind: 'concept',
          text: 'Texto A',
          excerpt: 'Texto A',
          docId: 'doc-a',
          docName: 'A.md',
          workspaceId: 'ws-1',
          createdAt: 1,
          updatedAt: 10,
          selectionHash: 'sel-a'
        },
        {
          id: 'fragment-rel-b',
          kind: 'relation',
          text: 'Relacion B',
          excerpt: 'Relacion B',
          docId: 'doc-b',
          docName: 'B.md',
          workspaceId: 'ws-1',
          createdAt: 2,
          updatedAt: 20,
          selectionHash: 'sel-b',
          conceptId: 'concept-b',
          conceptTitle: 'Concepto B'
        }
      ],
      relations: [
        {
          id: 'relation-b',
          fragmentId: 'fragment-rel-b',
          conceptId: 'concept-b',
          conceptTitle: 'Concepto B',
          relationType: 'related-to',
          createdAt: 20,
          docId: 'doc-b',
          selectionHash: 'sel-b'
        }
      ],
      updatedAt: 20
    };

    const filtered = filterSemanticWorkspaceStateByDocument(state, {
      docId: 'doc-a',
      docName: 'A.md'
    });

    expect(filtered.concepts).toHaveLength(1);
    expect(filtered.concepts[0]?.id).toBe('concept-a');
    expect(filtered.fragments).toHaveLength(1);
    expect(filtered.fragments[0]?.id).toBe('fragment-a');
    expect(filtered.relations).toHaveLength(0);
  });

  it('normalizes persisted notes without losing the comment text', () => {
    const state = normalizeSemanticWorkspaceState({
      concepts: [],
      fragments: [
        {
          id: 'note-1',
          kind: 'note',
          text: 'Pasaje del documento',
          excerpt: 'Pasaje del documento',
          note: 'Recordar conectar esto con el argumento central.',
          docId: 'doc-a',
          docName: 'A.md',
          workspaceId: 'ws-1',
          createdAt: 10,
          updatedAt: 20,
          selectionHash: 'note-a'
        }
      ],
      relations: [],
      updatedAt: 20
    });

    expect(state.fragments).toHaveLength(1);
    expect(state.fragments[0]).toMatchObject({
      kind: 'note',
      note: 'Recordar conectar esto con el argumento central.'
    });
  });
});