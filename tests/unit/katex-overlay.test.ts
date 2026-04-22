import { collectBlockMath } from '@/components/mosaic-editor/useKatexOverlayDecorations';

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
});