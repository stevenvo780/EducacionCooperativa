/**
 * Decoraciones (ViewPlugin) para rainbow parens en el editor ST.
 *
 * CodeMirror 6 no tiene rainbow brackets nativos; este plugin lee
 * los tokens del StreamLanguage y aplica CSS classes para colorear
 * los paréntesis/llaves según su profundidad de anidación.
 */

import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  EditorView
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const parenDecos = [
  Decoration.mark({ class: 'cm-st-paren-0' }),
  Decoration.mark({ class: 'cm-st-paren-1' }),
  Decoration.mark({ class: 'cm-st-paren-2' }),
  Decoration.mark({ class: 'cm-st-paren-3' })
];

const OPEN = new Set(['(', '{']);
const CLOSE = new Set([')', '}']);

function buildRainbowDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const text = doc.toString();
  let depth = 0;

  // Walk through visible ranges for performance
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos < to; pos++) {
      const ch = text.charAt(pos);
      if (OPEN.has(ch)) {
        const d = depth % 4;
        builder.add(pos, pos + 1, parenDecos[d]!);
        depth++;
      } else if (CLOSE.has(ch)) {
        depth = Math.max(0, depth - 1);
        const d = depth % 4;
        builder.add(pos, pos + 1, parenDecos[d]!);
      }
    }
  }

  return builder.finish();
}

export const rainbowParensPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildRainbowDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildRainbowDecorations(update.view);
      }
    }
  },
  {
    decorations: v => v.decorations
  }
);

/**
 * Rainbow parentheses extension for ST editor.
 */
export function stRainbowParens() {
  return rainbowParensPlugin;
}
