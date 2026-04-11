import { describe, expect, it } from 'vitest';

import { buildSTFromSemantic } from '@/lib/buildSTFromSemantic';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';

const baseState = (): SemanticWorkspaceState => ({
  concepts: [],
  fragments: [],
  relations: [],
  updatedAt: 0,
  preferences: {
    experienceMode: 'hybrid',
    showSTPreview: true,
    showPedagogicalHints: true
  }
});

describe('buildSTFromSemantic', () => {
  it('proyecta conceptos aunque no tengan definición ni fórmula manual', () => {
    const state = baseState();

    state.fragments.push({
      id: 'fragment-1',
      kind: 'concept',
      text: 'la cooperación educativa fortalece el aprendizaje compartido',
      excerpt: 'la cooperación educativa fortalece el aprendizaje compartido',
      docId: 'doc-1',
      docName: 'Documento Demo',
      workspaceId: 'ws-1',
      createdAt: 1,
      updatedAt: 1,
      selectionHash: 'hash-1'
    });

    state.concepts.push({
      id: 'concept-1',
      title: 'Cooperación educativa',
      excerpt: 'la cooperación educativa fortalece el aprendizaje compartido',
      docId: 'doc-1',
      docName: 'Documento Demo',
      workspaceId: 'ws-1',
      createdAt: 1,
      updatedAt: 1,
      sourceFragmentId: 'fragment-1'
    });

    const stContent = buildSTFromSemantic(state, 'Documento Demo');
    const definitions = STDefinitionsRegistry.extractFromSource(stContent, 'Documento Demo.md.st');

    expect(stContent).toContain('interpret "la cooperación educativa fortalece el aprendizaje compartido" as');
    expect(stContent).toContain('claim CLM_');
    expect(definitions.some((definition) => definition.kind === 'interpretation')).toBe(true);
    expect(definitions.some((definition) => definition.kind === 'claim')).toBe(true);
  });
});