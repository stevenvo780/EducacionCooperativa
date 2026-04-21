/**
 * Go-to-definition para el editor ST en CodeMirror 6.
 *
 * Soporta Ctrl+Click y F12 para saltar a la definición de:
 * - axiom, theorem, let, claim, theory y fn (definidos en el mismo archivo)
 * - declaraciones exportadas con `export` / `exportar`
 */

import { EditorView, ViewPlugin, Decoration, DecorationSet, ViewUpdate } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { getSemanticDefinition, getSemanticSymbols } from './st-semantic';

// ── Regex para encontrar definiciones ───────────────────────

interface SymbolDef {
  name: string;
  from: number;
  to: number;
  line: number;
  column: number;
}

function clampDocPos(pos: number, docLength: number): number {
  return Math.max(0, Math.min(pos, docLength));
}

function clampRange(
  from: number,
  to: number,
  docLength: number,
): { from: number; to: number } | null {
  const safeFrom = clampDocPos(from, docLength);
  const safeTo = clampDocPos(Math.max(to, safeFrom), docLength);

  if (safeTo <= safeFrom) return null;
  return { from: safeFrom, to: safeTo };
}

/**
 * Escanea el documento para encontrar todas las definiciones de símbolos ST.
 */
function findDefinitions(doc: string): SymbolDef[] {
  const lines = doc.split('\n');
  const docLength = doc.length;
  const lineOffsets: number[] = [];
  let offset = 0;

  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  return getSemanticSymbols(doc)
    .filter((symbol) => Boolean(symbol.location?.line))
    .map((symbol) => {
      const line = Math.max(1, symbol.location.line);
      const column = Math.max(1, symbol.location.column ?? 1);
      const localName = symbol.name.includes('.') ? symbol.name.split('.').pop() || symbol.name : symbol.name;
      const from = clampDocPos((lineOffsets[line - 1] ?? 0) + column - 1, docLength);
      const to = clampDocPos(from + localName.length, docLength);

      return {
        name: symbol.name,
        from,
        to,
        line,
        column
      };
    });
}

/**
 * Obtiene la palabra bajo el cursor en la posición dada.
 */
function getWordAt(doc: string, pos: number): { word: string; from: number; to: number } | null {
  if (pos < 0 || pos >= doc.length) return null;

  let from = pos;
  let to = pos;

  while (from > 0 && /[a-zA-Z0-9_.]/.test(doc.charAt(from - 1))) from--;
  while (to < doc.length && /[a-zA-Z0-9_.]/.test(doc.charAt(to))) to++;

  if (from === to) return null;
  return { word: doc.slice(from, to), from, to };
}

/**
 * Extensión de go-to-definition para ST.
 * - Ctrl+Click: salta a la definición
 * - F12: salta a la definición
 */
export function stGotoDef() {
  return [
    // F12 keybinding
    EditorView.domEventHandlers({
      keydown(event: KeyboardEvent, view: EditorView) {
        if (event.key === 'F12') {
          event.preventDefault();
          return jumpToDefinition(view);
        }
        return false;
      }
    }),

    // Ctrl+Click
    EditorView.domEventHandlers({
      click(event: MouseEvent, view: EditorView) {
        if (!event.ctrlKey && !event.metaKey) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        return jumpToDefinition(view, pos ?? view.state.selection.main.head);
      }
    }),

    // Ctrl+hover underline effect
    ctrlHoverPlugin
  ];
}

/**
 * Intenta saltar a la definición del símbolo bajo el cursor.
 */
function jumpToDefinition(view: EditorView, pos: number = view.state.selection.main.head): boolean {
  const stateDoc = view.state.doc;
  const doc = stateDoc.toString();
  const wordInfo = getWordAt(doc, pos);

  if (!wordInfo) return false;

  const defs = findDefinitions(doc);
  const semanticTarget =
    defs.find((definition) => definition.name === wordInfo.word)
    ?? (() => {
      const location = getSemanticDefinition(doc, wordInfo.word);
      if (!location?.line) return null;

      const lineNumber = Math.max(1, Math.min(location.line, stateDoc.lines));
      const line = stateDoc.line(lineNumber);
      const from = clampDocPos(line.from + Math.max(0, (location.column ?? 1) - 1), stateDoc.length);
      const range = clampRange(
        from,
        from + (wordInfo.word.split('.').pop() || wordInfo.word).length,
        stateDoc.length,
      );
      if (!range) return null;

      return {
        name: wordInfo.word,
        from: range.from,
        to: range.to,
        line: lineNumber,
        column: location.column ?? 1
      };
    })();

  if (!semanticTarget) return false;
  if (semanticTarget.from === wordInfo.from) return false;

  // Jump to definition
  view.dispatch({
    selection: EditorSelection.single(semanticTarget.from, semanticTarget.to),
    scrollIntoView: true
  });

  return true;
}

// ── Ctrl+hover underline for clickable symbols ──────────────

export const ctrlHoverPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    isCtrlHeld = false;
    definitions: SymbolDef[] = [];

    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      this.definitions = findDefinitions(view.state.doc.toString());
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.definitions = findDefinitions(update.state.doc.toString());
        this.decorations = Decoration.none;
      }
    }

    destroy() {
      // cleanup if needed
    }
  },
  {
    decorations: v => v.decorations,
    eventHandlers: {
      keydown(event: KeyboardEvent) {
        if (event.key === 'Control' || event.key === 'Meta') {
          this.isCtrlHeld = true;
        }
      },
      keyup(event: KeyboardEvent) {
        if (event.key === 'Control' || event.key === 'Meta') {
          this.isCtrlHeld = false;
          this.decorations = Decoration.none;
        }
      },
      mousemove(event: MouseEvent, view: EditorView) {
        if (!this.isCtrlHeld) {
          if (this.decorations !== Decoration.none) {
            this.decorations = Decoration.none;
          }
          return;
        }

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return;

        const doc = view.state.doc.toString();
        const wordInfo = getWordAt(doc, pos);
        if (!wordInfo) {
          this.decorations = Decoration.none;
          return;
        }

        const hasDef =
          this.definitions.some((definition) => definition.name === wordInfo.word && definition.from !== wordInfo.from)
          || Boolean(getSemanticDefinition(doc, wordInfo.word));

        if (hasDef) {
          const range = clampRange(wordInfo.from, wordInfo.to, view.state.doc.length);
          if (!range) {
            this.decorations = Decoration.none;
            return;
          }

          this.decorations = Decoration.set([
            Decoration.mark({
              class: 'cm-st-goto-link'
            }).range(range.from, range.to)
          ]);
        } else {
          this.decorations = Decoration.none;
        }
      }
    }
  }
);
