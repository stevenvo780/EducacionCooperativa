import {
  collectBlockMath,
  isKatexOverlayMutationBatch
} from '@/components/mosaic-editor/useKatexOverlayDecorations';

const mutation = (
  target: Node,
  addedNodes: Node[] = [],
  removedNodes: Node[] = []
) => ({
  target,
  addedNodes,
  removedNodes
}) as unknown as MutationRecord;

describe('KaTeX overlay block detection', () => {
  it('detects a block math expression split across multiple paragraphs', () => {
    const editable = document.createElement('div');
    editable.innerHTML = [
      '<p>$$</p>',
      '<p>\\begin{array}{l}</p>',
      '<p>p \\to q \\\\</p>',
      '<p>p \\\\</p>',
      '<p>\\hline</p>',
      '<p>\\therefore q</p>',
      '<p>\\end{array}</p>',
      '<p>$$</p>'
    ].join('');

    document.body.appendChild(editable);

    try {
      const paragraphs = editable.querySelectorAll('p');
      const { blocks, blockParagraphs } = collectBlockMath(editable, paragraphs);

      expect(blocks).toHaveLength(1);
      expect(blockParagraphs.size).toBe(8);
      expect(blocks[0]?.elements).toHaveLength(8);
      expect(blocks[0]?.latex).toContain('\\begin{array}{l}');
      expect(blocks[0]?.latex).toContain('\\therefore q');
    } finally {
      editable.remove();
    }
  });

  it('ignores DOM mutations caused by its own overlay redraw', () => {
    const shell = document.createElement('div');
    const scrollParent = document.createElement('div');
    const editable = document.createElement('div');
    const overlayContainer = document.createElement('div');
    const overlay = document.createElement('span');

    editable.setAttribute('contenteditable', 'true');
    overlayContainer.className = 'katex-overlay-container';
    overlay.className = 'katex-inline-overlay';
    overlayContainer.appendChild(overlay);
    scrollParent.appendChild(editable);
    shell.appendChild(scrollParent);

    const overlayAddedToEditor = mutation(scrollParent, [overlayContainer]);
    const overlayRedrawn = mutation(overlayContainer, [overlay]);
    const contentChanged = mutation(editable, [document.createElement('p')]);

    expect(isKatexOverlayMutationBatch([overlayAddedToEditor])).toBe(true);
    expect(isKatexOverlayMutationBatch([overlayRedrawn])).toBe(true);
    expect(isKatexOverlayMutationBatch([contentChanged])).toBe(false);
  });
});
