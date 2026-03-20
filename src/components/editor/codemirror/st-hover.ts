/**
 * Hover tooltip extension para ST en CodeMirror 6.
 *
 * Muestra información contextual (definición, descripción, ejemplo)
 * al pasar el cursor sobre keywords, operators, builtins y profiles.
 */

import { hoverTooltip, Tooltip, EditorView } from '@codemirror/view';
import { getHoverInfo } from '../st-editor/hover-info';
import { escapeHtml, getTokenAtPosition } from '../st-editor/tokenizer';
import { getSemanticHover } from './st-semantic';

// ── Tooltip DOM renderer ────────────────────────────────────

function markdownishToHtml(markdown: string): string {
  const codeBlocks: string[] = [];
  const placeholderPrefix = '\u0000st-code-block-';
  const withPlaceholders = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, language, code) => {
    const blockHtml = `<pre class="cm-st-hover-code"><code data-lang="${escapeHtml(language || '')}">${escapeHtml(String(code).trimEnd())}</code></pre>`;
    codeBlocks.push(blockHtml);
    return `${placeholderPrefix}${codeBlocks.length - 1}\u0000`;
  });

  let html = escapeHtml(withPlaceholders)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="cm-st-hover-inline">$1</code>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br />');

  html = `<p>${html}</p>`;
  return html.replace(/\u0000st-code-block-(\d+)\u0000/g, (_match, index) => codeBlocks[Number(index)] || '');
}

function createTooltipDOM(info: { title?: string; description?: string; example?: string; category?: string; markdown?: string }): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-st-hover-tooltip';

  if (info.markdown) {
    dom.innerHTML = markdownishToHtml(info.markdown);
    return dom;
  }

  const title = document.createElement('div');
  title.className = 'cm-st-hover-title';
  title.textContent = info.title || '';
  dom.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'cm-st-hover-desc';
  desc.textContent = info.description || '';
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

function getWordRangeAtColumn(lineText: string, column: number): { start: number; end: number } | null {
  if (column < 0 || column >= lineText.length) return null;

  let start = column;
  while (start > 0 && /[a-zA-Z0-9_.\u00C0-\u024F]/.test(lineText[start - 1])) start--;

  let end = column;
  while (end < lineText.length && /[a-zA-Z0-9_.\u00C0-\u024F]/.test(lineText[end])) end++;

  return start === end ? null : { start, end };
}

function stHoverHandler(view: EditorView, pos: number, side: 1 | -1): Tooltip | null {
  const doc = view.state.doc;
  const line = doc.lineAt(pos);
  const lineNum = line.number;
  const col = pos - line.from;
  const code = doc.toString();

  const token = getTokenAtPosition(code, lineNum, col);
  const wordRange = getWordRangeAtColumn(line.text, col);
  const semanticHover = getSemanticHover(code, lineNum, col + 1);

  if (semanticHover?.content) {
    const range =
      token && token.category !== 'plain' && token.category !== 'identifier'
        ? { start: token.start, end: token.end }
        : wordRange;

    return {
      pos: line.from + (range?.start ?? col),
      end: line.from + (range?.end ?? (col + 1)),
      above: true,
      create() {
        return { dom: createTooltipDOM({ markdown: semanticHover.content }) };
      }
    };
  }

  if (!token) return null;

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
