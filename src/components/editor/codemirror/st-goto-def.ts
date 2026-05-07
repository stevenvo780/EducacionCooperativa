import { EditorView, ViewPlugin, Decoration, DecorationSet, ViewUpdate } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { getSemanticDefinition, getSemanticDefinitionAsync, getSemanticSymbolsAsync } from './st-semantic';
import type { SymbolInfo } from '@/lib/st-api';

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

function symbolsToDefinitions(symbols: SymbolInfo[], docLength: number, lineOffsets: number[]): SymbolDef[] {
  return symbols
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

function buildLineOffsets(doc: string): { offsets: number[]; length: number } {
  const offsets: number[] = [];
  let offset = 0;
  for (const line of doc.split('\n')) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return { offsets, length: doc.length };
}

async function findDefinitionsAsync(doc: string): Promise<SymbolDef[]> {
  const { offsets, length } = buildLineOffsets(doc);
  const symbols = await getSemanticSymbolsAsync(doc);
  return symbolsToDefinitions(symbols, length, offsets);
}

function getWordAt(doc: string, pos: number): { word: string; from: number; to: number } | null {
  if (pos < 0 || pos >= doc.length) return null;

  let from = pos;
  let to = pos;

  while (from > 0 && /[a-zA-Z0-9_.]/.test(doc.charAt(from - 1))) from--;
  while (to < doc.length && /[a-zA-Z0-9_.]/.test(doc.charAt(to))) to++;

  if (from === to) return null;
  return { word: doc.slice(from, to), from, to };
}

export function stGotoDef() {
  return [
    EditorView.domEventHandlers({
      keydown(event: KeyboardEvent, view: EditorView) {
        if (event.key === 'F12') {
          event.preventDefault();
          void jumpToDefinition(view);
          return true;
        }
        return false;
      }
    }),

    EditorView.domEventHandlers({
      click(event: MouseEvent, view: EditorView) {
        if (!event.ctrlKey && !event.metaKey) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        void jumpToDefinition(view, pos ?? view.state.selection.main.head);
        return true;
      }
    }),

    ctrlHoverPlugin
  ];
}

async function jumpToDefinition(view: EditorView, pos: number = view.state.selection.main.head): Promise<boolean> {
  const stateDoc = view.state.doc;
  const doc = stateDoc.toString();
  const wordInfo = getWordAt(doc, pos);

  if (!wordInfo) return false;

  const defs = await findDefinitionsAsync(doc);
  let semanticTarget: SymbolDef | null = defs.find((definition) => definition.name === wordInfo.word) ?? null;

  if (!semanticTarget) {
    const location = await getSemanticDefinitionAsync(doc, wordInfo.word);
    if (location?.line) {
      const lineNumber = Math.max(1, Math.min(location.line, stateDoc.lines));
      const line = stateDoc.line(lineNumber);
      const from = clampDocPos(line.from + Math.max(0, (location.column ?? 1) - 1), stateDoc.length);
      const range = clampRange(
        from,
        from + (wordInfo.word.split('.').pop() || wordInfo.word).length,
        stateDoc.length,
      );
      if (range) {
        semanticTarget = {
          name: wordInfo.word,
          from: range.from,
          to: range.to,
          line: lineNumber,
          column: location.column ?? 1
        };
      }
    }
  }

  if (!semanticTarget) return false;
  if (semanticTarget.from === wordInfo.from) return false;

  view.dispatch({
    selection: EditorSelection.single(semanticTarget.from, semanticTarget.to),
    scrollIntoView: true
  });

  return true;
}

const DEFINITIONS_REBUILD_DEBOUNCE_MS = 300;

export const ctrlHoverPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    isCtrlHeld = false;
    definitions: SymbolDef[] = [];
    private dirty = true;
    private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    private rebuildSeq = 0;
    private latestView: EditorView;

    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      this.latestView = view;
      void this.rebuildAsync();
    }

    private async rebuildAsync(): Promise<void> {
      const seq = ++this.rebuildSeq;
      const docString = this.latestView.state.doc.toString();
      const next = await findDefinitionsAsync(docString);
      if (seq !== this.rebuildSeq) return;
      this.definitions = next;
      this.dirty = false;
    }

    private scheduleRebuild(): void {
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => {
        this.rebuildTimer = null;
        if (!this.dirty) return;
        void this.rebuildAsync();
      }, DEFINITIONS_REBUILD_DEBOUNCE_MS);
    }

    update(update: ViewUpdate) {
      this.latestView = update.view;
      if (update.docChanged) {
        this.dirty = true;
        if (this.decorations !== Decoration.none) {
          this.decorations = Decoration.none;
        }
        this.scheduleRebuild();
      }
    }

    destroy() {
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }

    ensureDefinitionsFresh(): void {
      if (this.dirty) {
        if (this.rebuildTimer) {
          clearTimeout(this.rebuildTimer);
          this.rebuildTimer = null;
        }
        void this.rebuildAsync();
      }
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

        this.ensureDefinitionsFresh();

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
