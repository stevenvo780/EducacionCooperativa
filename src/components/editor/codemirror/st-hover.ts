/**
 * Hover tooltip extension para ST en CodeMirror 6.
 *
 * Muestra información contextual (definición, descripción, ejemplo)
 * al pasar el cursor sobre keywords, operators, builtins y profiles.
 */

import { hoverTooltip, Tooltip, EditorView } from '@codemirror/view';
import { getHoverInfo } from '../st-editor/hover-info';
import { getTokenAtPosition } from '../st-editor/tokenizer';

// ── Token category mapping para hover-info ──────────────────

function streamTagToCategory(tagName: string): string {
  if (tagName === 'keyword') return 'keyword';
  if (tagName === 'builtin') return 'builtin';
  if (tagName === 'operator') return 'operator';
  if (tagName === 'typeName') return 'profile';
  if (tagName === 'atom') return 'keyword';
  return 'identifier';
}

// ── Tooltip DOM renderer ────────────────────────────────────

function createTooltipDOM(info: { title: string; description: string; example?: string; category?: string }): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-st-hover-tooltip';

  const title = document.createElement('div');
  title.className = 'cm-st-hover-title';
  title.textContent = info.title;
  dom.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'cm-st-hover-desc';
  desc.textContent = info.description;
  dom.appendChild(desc);

  if (info.example) {
    const example = document.createElement('code');
    example.className = 'cm-st-hover-example';
    example.textContent = info.example;
    dom.appendChild(example);
  }

  if (info.category) {
    const cat = document.createElement('span');
    cat.className = 'cm-st-hover-category';
    cat.textContent = info.category;
    dom.appendChild(cat);
  }

  return dom;
}

// ── Hover handler ───────────────────────────────────────────

function stHoverHandler(view: EditorView, pos: number, side: 1 | -1): Tooltip | null {
  const doc = view.state.doc;
  const line = doc.lineAt(pos);
  const lineNum = line.number;
  const col = pos - line.from;
  const code = doc.toString();

  const token = getTokenAtPosition(code, lineNum, col);
  if (!token) return null;

  // Skip plain text and whitespace
  if (token.category === 'plain' || token.category === 'identifier') {
    // Try identifier lookup in hover-info anyway (for builtins that might be miscategorized)
    const info = getHoverInfo(token.text, 'keyword');
    if (!info) return null;
    return {
      pos: line.from + token.start,
      end: line.from + token.end,
      above: true,
      create() {
        return { dom: createTooltipDOM(info) };
      }
    };
  }

  const info = getHoverInfo(token.text, token.category);
  if (!info) return null;

  return {
    pos: line.from + token.start,
    end: line.from + token.end,
    above: true,
    create() {
      return { dom: createTooltipDOM(info) };
    }
  };
}

// ── Export ───────────────────────────────────────────────────

/**
 * Hover tooltip extension for ST language.
 */
export function stHoverTooltip() {
  return hoverTooltip(stHoverHandler, {
    hideOnChange: true
  });
}
