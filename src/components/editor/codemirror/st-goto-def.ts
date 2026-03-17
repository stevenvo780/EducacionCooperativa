/**
 * Go-to-definition para el editor ST en CodeMirror 6.
 *
 * Soporta Ctrl+Click y F12 para saltar a la definición de:
 * - axiom, theorem, let, claim, passage (definidos en el mismo archivo)
 */

import { EditorView, ViewPlugin, Decoration, DecorationSet, ViewUpdate } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

// ── Regex para encontrar definiciones ───────────────────────

const DEFINITION_RE = /^\s*(?:axiom|axioma|theorem|teorema|let|sea|claim|passage)\s+(\w+)/gm;

interface SymbolDef {
  name: string;
  from: number;
  to: number;
  line: number;
}

/**
 * Escanea el documento para encontrar todas las definiciones de símbolos ST.
 */
function findDefinitions(doc: string): SymbolDef[] {
  const defs: SymbolDef[] = [];
  const lines = doc.split('\n');
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*(?:axiom|axioma|theorem|teorema|let|sea|claim|passage)\s+(\w+)/);
    if (match) {
      const nameStart = offset + line.indexOf(match[1]);
      defs.push({
        name: match[1],
        from: nameStart,
        to: nameStart + match[1].length,
        line: i + 1
      });
    }
    offset += line.length + 1;
  }

  return defs;
}

/**
 * Obtiene la palabra bajo el cursor en la posición dada.
 */
function getWordAt(doc: string, pos: number): { word: string; from: number; to: number } | null {
  if (pos < 0 || pos >= doc.length) return null;

  let from = pos;
  let to = pos;

  while (from > 0 && /\w/.test(doc.charAt(from - 1))) from--;
  while (to < doc.length && /\w/.test(doc.charAt(to))) to++;

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
        return jumpToDefinition(view);
      }
    }),

    // Ctrl+hover underline effect
    ctrlHoverPlugin
  ];
}

/**
 * Intenta saltar a la definición del símbolo bajo el cursor.
 */
function jumpToDefinition(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const doc = view.state.doc.toString();
  const wordInfo = getWordAt(doc, pos);

  if (!wordInfo) return false;

  const defs = findDefinitions(doc);
  const target = defs.find(d => d.name === wordInfo.word && d.from !== wordInfo.from);

  if (!target) return false;

  // Jump to definition
  view.dispatch({
    selection: EditorSelection.single(target.from, target.to),
    scrollIntoView: true
  });

  return true;
}

// ── Ctrl+hover underline for clickable symbols ──────────────

const ctrlHoverPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    isCtrlHeld = false;

    constructor(view: EditorView) {
      this.decorations = Decoration.none;
    }

    update(update: ViewUpdate) {
      // decorations are updated via DOM events, not doc changes
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

        const defs = findDefinitions(doc);
        const hasDef = defs.some(d => d.name === wordInfo.word && d.from !== wordInfo.from);

        if (hasDef) {
          this.decorations = Decoration.set([
            Decoration.mark({
              class: 'cm-st-goto-link'
            }).range(wordInfo.from, wordInfo.to)
          ]);
        } else {
          this.decorations = Decoration.none;
        }
      }
    }
  }
);
