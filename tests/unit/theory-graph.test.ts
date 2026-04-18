import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import { buildSTFromSemantic } from '@/lib/buildSTFromSemantic';
import {
  buildTheoryGraphFromSTSource,
  buildTheoryGraphFromSemanticState,
  projectTheoryGraphToSemanticState
} from '@/lib/semantic/theory-graph';
import { evaluate } from '@/lib/st-api';
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';

describe('theory graph ST round-trip', () => {
  it('preserves passage supports from canonical text-layer examples', () => {
    const source = readFileSync('public/downloads/st/11-text-layer.st', 'utf8');
    const graph = buildTheoryGraphFromSTSource(source, {
      workspaceId: 'ws-1',
      docName: '11-text-layer.st'
    });

    const c1 = graph.nodes.find((node) => node.label === 'c1');
    const c2 = graph.nodes.find((node) => node.label === 'c2');

    expect(graph.nodes.some((node) => node.kind === 'passage' && node.label === 'p1')).toBe(true);
    expect(graph.nodes.some((node) => node.kind === 'passage' && node.label === 'p2')).toBe(true);
    expect(graph.edges.some((edge) => edge.relationType === 'supports' && edge.to === c1?.id)).toBe(true);
    expect(graph.edges.some((edge) => edge.relationType === 'supports' && edge.to === c2?.id)).toBe(true);

    const projectedState = projectTheoryGraphToSemanticState(graph, {
      workspaceId: 'ws-1',
      docName: '11-text-layer.st'
    });
    const rebuilt = buildSTFromSemantic(projectedState, '11-text-layer.st');
    const evaluated = evaluate(rebuilt);

    expect(rebuilt).toContain('passage([[documento.md#seccion-1]])');
    expect(rebuilt).toContain('support');
    expect(evaluated.diagnostics ?? []).toHaveLength(0);
    expect(evaluated.results?.some((result) => result.status === 'error')).toBe(false);
  });

  it('resolves interpret aliases as valid support sources', () => {
    const source = [
      'logic classical.propositional',
      'claim c = (P)',
      'interpret "texto" as E',
      'support c <- E'
    ].join('\n');
    const graph = buildTheoryGraphFromSTSource(source, { docName: 'interpret.st' });
    const claimNode = graph.nodes.find((node) => node.label === 'c');

    expect(graph.edges.some((edge) => edge.relationType === 'supports' && edge.to === claimNode?.id)).toBe(true);
  });

  it('checks contradictions beyond the twelfth claim pair', () => {
    const state: SemanticWorkspaceState = {
      concepts: Array.from({ length: 13 }, (_, index) => ({
        id: `concept-${index + 1}`,
        title: `Claim ${index + 1}`,
        excerpt: '',
        formula: index === 0 ? 'P' : index === 12 ? '!P' : `Q${index + 1}`,
        logicProfile: 'classical.propositional',
        docId: 'doc-1',
        docName: 'Documento Demo',
        workspaceId: 'ws-1',
        createdAt: index + 1,
        updatedAt: index + 1,
        sourceFragmentId: ''
      })),
      fragments: [],
      relations: [],
      updatedAt: 13,
      preferences: {
        experienceMode: 'hybrid',
        showSTPreview: true,
        showPedagogicalHints: true
      }
    };

    const graph = buildTheoryGraphFromSemanticState(state, { sourceDocument: { docName: 'Documento Demo' } });

    expect(graph.diagnostics.some((diagnostic) => (
      diagnostic.type === 'contradiction'
      && diagnostic.message.includes('Claim 1')
      && diagnostic.message.includes('Claim 13')
    ))).toBe(true);
  });
});
