import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  EditorView
} from '@codemirror/view';
import { RangeSetBuilder, type Text } from '@codemirror/state';

const parenDecos = [
  Decoration.mark({ class: 'cm-st-paren-0' }),
  Decoration.mark({ class: 'cm-st-paren-1' }),
  Decoration.mark({ class: 'cm-st-paren-2' }),
  Decoration.mark({ class: 'cm-st-paren-3' })
];

const enum LexState {
  Normal = 0,
  LineComment = 1,
  BlockComment = 2,
  StringDouble = 3,
  StringSingle = 4,
  StringBacktick = 5
}

interface DepthScan {
  depth: number;
  state: LexState;
}

function scanDepth(doc: Text, from: number, to: number, initial: DepthScan): DepthScan {
  if (to <= from) return initial;
  let { depth, state } = initial;
  const iter = doc.iterRange(from, to);
  while (!iter.next().done) {
    const chunk = iter.value;
    if (chunk.length === 0) {
      if (state === LexState.LineComment) state = LexState.Normal;
      continue;
    }
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk.charAt(i);
      switch (state) {
        case LexState.Normal: {
          if (ch === '/' && i + 1 < chunk.length) {
            const next = chunk.charAt(i + 1);
            if (next === '/') { state = LexState.LineComment; i++; continue; }
            if (next === '*') { state = LexState.BlockComment; i++; continue; }
          }
          if (ch === '"') { state = LexState.StringDouble; continue; }
          if (ch === "'") { state = LexState.StringSingle; continue; }
          if (ch === '`') { state = LexState.StringBacktick; continue; }
          if (ch === '(' || ch === '{') { depth++; continue; }
          if (ch === ')' || ch === '}') { depth = Math.max(0, depth - 1); continue; }
          break;
        }
        case LexState.LineComment:
          break;
        case LexState.BlockComment:
          if (ch === '*' && i + 1 < chunk.length && chunk.charAt(i + 1) === '/') { state = LexState.Normal; i++; }
          break;
        case LexState.StringDouble:
          if (ch === '\\' && i + 1 < chunk.length) { i++; continue; }
          if (ch === '"') state = LexState.Normal;
          break;
        case LexState.StringSingle:
          if (ch === '\\' && i + 1 < chunk.length) { i++; continue; }
          if (ch === "'") state = LexState.Normal;
          break;
        case LexState.StringBacktick:
          if (ch === '\\' && i + 1 < chunk.length) { i++; continue; }
          if (ch === '`') state = LexState.Normal;
          break;
      }
    }
  }
  return { depth, state };
}

function buildVisibleDecorations(view: EditorView, builder: RangeSetBuilder<Decoration>, from: number, to: number, initial: DepthScan): DepthScan {
  let { depth, state } = initial;
  if (to <= from) return { depth, state };
  const doc = view.state.doc;
  const iter = doc.iterRange(from, to);
  let pos = from;
  while (!iter.next().done) {
    const chunk = iter.value;
    if (chunk.length === 0) {
      if (state === LexState.LineComment) state = LexState.Normal;
      pos += 1;
      continue;
    }
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk.charAt(i);
      switch (state) {
        case LexState.Normal: {
          if (ch === '/' && i + 1 < chunk.length) {
            const next = chunk.charAt(i + 1);
            if (next === '/') { state = LexState.LineComment; i++; continue; }
            if (next === '*') { state = LexState.BlockComment; i++; continue; }
          }
          if (ch === '"') { state = LexState.StringDouble; continue; }
          if (ch === "'") { state = LexState.StringSingle; continue; }
          if (ch === '`') { state = LexState.StringBacktick; continue; }
          if (ch === '(' || ch === '{') {
            const d = depth % 4;
            builder.add(pos + i, pos + i + 1, parenDecos[d]!);
            depth++;
            continue;
          }
          if (ch === ')' || ch === '}') {
            depth = Math.max(0, depth - 1);
            const d = depth % 4;
            builder.add(pos + i, pos + i + 1, parenDecos[d]!);
            continue;
          }
          break;
        }
        case LexState.LineComment:
          break;
        case LexState.BlockComment:
          if (ch === '*' && i + 1 < chunk.length && chunk.charAt(i + 1) === '/') { state = LexState.Normal; i++; }
          break;
        case LexState.StringDouble:
          if (ch === '\\' && i + 1 < chunk.length) { i++; continue; }
          if (ch === '"') state = LexState.Normal;
          break;
        case LexState.StringSingle:
          if (ch === '\\' && i + 1 < chunk.length) { i++; continue; }
          if (ch === "'") state = LexState.Normal;
          break;
        case LexState.StringBacktick:
          if (ch === '\\' && i + 1 < chunk.length) { i++; continue; }
          if (ch === '`') state = LexState.Normal;
          break;
      }
    }
    pos += chunk.length;
  }
  return { depth, state };
}

function buildRainbowDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const ranges = view.visibleRanges;
  if (ranges.length === 0) return builder.finish();

  let scan: DepthScan = { depth: 0, state: LexState.Normal };
  let cursor = 0;
  for (const { from, to } of ranges) {
    if (cursor < from) {
      scan = scanDepth(doc, cursor, from, scan);
    }
    scan = buildVisibleDecorations(view, builder, from, to, scan);
    cursor = to;
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

export function stRainbowParens() {
  return rainbowParensPlugin;
}
