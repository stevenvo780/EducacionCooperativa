import { describe, expect, it } from 'vitest';

import { buildSTFromSemantic } from '@/lib/buildSTFromSemantic';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { evaluate, parse } from '@/lib/st-api';
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
    expect(evaluate(stContent).diagnostics ?? []).toHaveLength(0);
  });

  it('normaliza fórmulas unicode y separa perfiles incompatibles en bloques logic independientes', () => {
    const state = baseState();

    state.concepts.push(
      {
        id: 'concept-modal',
        title: 'Necesidad',
        excerpt: 'Es necesario que P',
        formula: '□P',
        logicProfile: 'modal.k',
        docId: 'doc-1',
        docName: 'Documento Demo',
        workspaceId: 'ws-1',
        createdAt: 1,
        updatedAt: 1,
        sourceFragmentId: ''
      },
      {
        id: 'concept-classical',
        title: 'Base',
        excerpt: 'P implica Q',
        formula: 'P -> Q',
        logicProfile: 'classical.propositional',
        docId: 'doc-1',
        docName: 'Documento Demo',
        workspaceId: 'ws-1',
        createdAt: 2,
        updatedAt: 2,
        sourceFragmentId: ''
      }
    );

    const stContent = buildSTFromSemantic(state, 'Documento Demo');
    const parsed = parse(stContent, 'Documento Demo.md.st');
    const evaluated = evaluate(stContent);

    expect(stContent).toContain('logic modal.k');
    expect(stContent).toContain('logic classical.propositional');
    expect(stContent).not.toContain('□');
    expect(parsed.ok).toBe(true);
    expect(parsed.diagnostics ?? []).toHaveLength(0);
    expect(evaluated.diagnostics ?? []).toHaveLength(0);
    expect(evaluated.results?.some((result) => result.status === 'error')).toBe(false);
  });

  it('marca fallback como formalización tentativa en vez de átomo silencioso', () => {
    const state = baseState();
    state.concepts.push({
      id: 'concept-fallback',
      title: '',
      excerpt: '',
      docId: 'doc-1',
      docName: 'Documento Demo',
      workspaceId: 'ws-1',
      createdAt: 1,
      updatedAt: 1,
      sourceFragmentId: ''
    });

    const stContent = buildSTFromSemantic(state, 'Documento Demo');

    expect(stContent).toContain('formalización tentativa');
    expect(stContent).toContain('warning:');
  });
});
