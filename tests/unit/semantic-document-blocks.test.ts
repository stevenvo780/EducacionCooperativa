import { describe, expect, it } from 'vitest';
import { removeSemanticDocumentBlock, wrapSemanticDocumentBlock } from '../../src/lib/semanticDocumentBlocks';

describe('semantic document blocks', () => {
  it('wraps and removes a materialized semantic block', () => {
    const wrapped = wrapSemanticDocumentBlock('blk-1', 'Texto importante');

    expect(wrapped).toContain('<!-- agora-semantic:start:blk-1 -->');
    expect(wrapped).toContain('<!-- agora-semantic:end:blk-1 -->');

    const content = ['Antes', wrapped, 'Despues'].join('\n\n');
    const next = removeSemanticDocumentBlock(content, 'blk-1');

    expect(next).toBe('Antes\nDespues');
  });
});