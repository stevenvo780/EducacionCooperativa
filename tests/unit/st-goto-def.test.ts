import { EditorState } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

import { ctrlHoverPlugin, stGotoDef } from '@/components/editor/codemirror/st-goto-def';

function countDecorations(set: { between: (from: number, to: number, f: () => void) => void }): number {
  let count = 0;
  set.between(0, Number.MAX_SAFE_INTEGER, () => {
    count += 1;
  });
  return count;
}

describe('st goto definition hover plugin', () => {
  it('clears ctrl-hover decorations after document changes to avoid stale ranges', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: 'axiom foo = P\nfoo',
        extensions: [...stGotoDef()]
      })
    });

    try {
      const hoverPlugin = view.plugin(ctrlHoverPlugin);
      expect(hoverPlugin).toBeTruthy();

      hoverPlugin!.decorations = Decoration.set([
        Decoration.mark({ class: 'cm-st-goto-link' }).range(view.state.doc.length - 3, view.state.doc.length)
      ]);

      expect(countDecorations(hoverPlugin?.decorations ?? Decoration.none)).toBe(1);

      expect(() => {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'x' } });
        view.dispatch({ selection: { anchor: 0 } });
      }).not.toThrow();

      const afterChange = view.plugin(ctrlHoverPlugin);
      expect(afterChange).toBeTruthy();
      expect(countDecorations(afterChange?.decorations ?? Decoration.none)).toBe(0);
    } finally {
      view.destroy();
      parent.remove();
    }
  });
});