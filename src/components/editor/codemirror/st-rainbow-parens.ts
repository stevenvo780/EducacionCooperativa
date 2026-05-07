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
  let depth = 0;

  // Walk visible ranges via iterRange (chunked) en lugar de hacer
  // doc.toString() del documento completo: en archivos de 50KB+ esa copia
  // dispara GC y atrasca scroll en cada keystroke.
  for (const { from, to } of view.visibleRanges) {
    const iter = doc.iterRange(from, to);
    let pos = from;
    while (!iter.next().done) {
      const chunk = iter.value;
      // Saltar saltos de línea (iter emite "" para line breaks)
      if (chunk.length === 0) {
        pos += 1; // un newline por chunk vacío
        continue;
      }
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk.charAt(i);
        if (OPEN.has(ch)) {
          const d = depth % 4;
          builder.add(pos + i, pos + i + 1, parenDecos[d]!);
          depth++;
        } else if (CLOSE.has(ch)) {
          depth = Math.max(0, depth - 1);
          const d = depth % 4;
          builder.add(pos + i, pos + i + 1, parenDecos[d]!);
        }
      }
      pos += chunk.length;
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
