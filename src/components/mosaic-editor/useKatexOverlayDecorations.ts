import { useEffect, type MutableRefObject } from 'react';
import katex from 'katex';
import type { ViewMode } from './types';

const OVERLAY_CONTAINER_CLASS = 'katex-overlay-container';
const EDITING_ATTR = 'data-katex-editing';

type MathBlock = {
  el: HTMLElement;
  latex: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

type InlineMath = {
  el: HTMLElement;
  latex: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

const normalizeLatex = (raw: string): string => {
  let src = raw.trim();
  src = src.replace(/\\\n/g, '\\\\\n');
  if (/\\begin\s*\{/.test(src)) return src;
  if (!/\\\\/.test(src)) return src;
  if (/\\hline/.test(src)) {
    return `\\begin{array}{l}\n${src}\n\\end{array}`;
  }
  return `\\begin{gathered}\n${src}\n\\end{gathered}`;
};

const ensureOverlayContainer = (shell: HTMLDivElement): HTMLElement | null => {
  const editable = shell.querySelector('[contenteditable="true"]') as HTMLElement | null;
  if (!editable) return null;
  const scrollParent = editable.parentElement;
  if (!scrollParent) return null;

  let container = scrollParent.querySelector(`.${OVERLAY_CONTAINER_CLASS}`) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.className = OVERLAY_CONTAINER_CLASS;
    if (getComputedStyle(scrollParent).position === 'static') {
      scrollParent.style.position = 'relative';
    }
    scrollParent.appendChild(container);
  }
  return container;
};

const findTextNodeAtOffset = (
  el: HTMLElement,
  charOffset: number
): { node: Text; offset: number } | null => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let accumulated = 0;
  let lastNode: Text | null = null;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const len = (node.textContent || '').length;
    lastNode = node;
    if (accumulated + len > charOffset) {
      return { node, offset: charOffset - accumulated };
    }
    accumulated += len;
    if (accumulated === charOffset) {
      return { node, offset: len };
    }
    node = walker.nextNode() as Text | null;
  }

  if (lastNode && accumulated === charOffset) {
    return { node: lastNode, offset: (lastNode.textContent || '').length };
  }

  return null;
};

const moveCursorToMath = (el: HTMLElement, delimiter: '$$' | '$') => {
  try {
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let textNode = walker.nextNode() as Text | null;
    while (textNode) {
      const idx = (textNode.textContent || '').indexOf(delimiter);
      if (idx >= 0) {
        range.setStart(textNode, Math.min(idx + delimiter.length, textNode.textContent?.length || 0));
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        break;
      }
      textNode = walker.nextNode() as Text | null;
    }
  } catch {
    // best effort
  }
};

const collectBlockMath = (editable: HTMLElement, paragraphs: NodeListOf<Element>) => {
  const blocks: MathBlock[] = [];
  const blockParagraphs = new Set<HTMLElement>();
  const editableRect = editable.getBoundingClientRect();

  paragraphs.forEach((paragraph) => {
    const el = paragraph as HTMLElement;
    if (el.getAttribute(EDITING_ATTR) === '1') return;

    // Skip elements inside code blocks / code mirrors
    if (el.closest('[class*="_codeBlockEditorWrapper"], [class*="_codeMirrorWrapper"], pre, code, .cm-editor')) return;

    const text = el.textContent || '';

    // Match both escaped (\$\$…\$\$) and unescaped ($$…$$) block math
    const blockRegex = /(?:\\\$\\\$|\$\$)([\s\S]*?)(?:\\\$\\\$|\$\$)/;
    const match = blockRegex.exec(text);
    if (!match || !match[1]?.trim()) return;

    const start = findTextNodeAtOffset(el, match.index);
    const end = findTextNodeAtOffset(el, match.index + match[0].length);
    if (!start || !end) return;

    let top = el.offsetTop;
    let left = 0;
    let width = el.getBoundingClientRect().width;
    let height = el.getBoundingClientRect().height;

    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        top = rect.top - editableRect.top + editable.scrollTop;
        left = rect.left - editableRect.left + editable.scrollLeft;
        width = rect.width;
        height = rect.height;
      }
    } catch {
      // fallback to paragraph metrics
    }

    blockParagraphs.add(el);
    blocks.push({
      el,
      latex: normalizeLatex(match[1]),
      top,
      left,
      width,
      height
    });
  });

  return { blocks, blockParagraphs };
};

const collectInlineMath = (
  editable: HTMLElement,
  paragraphs: NodeListOf<Element>,
  blockParagraphs: Set<HTMLElement>
) => {
  const inlines: InlineMath[] = [];

  paragraphs.forEach((paragraph) => {
    const el = paragraph as HTMLElement;
    if (el.getAttribute(EDITING_ATTR) === '1' || blockParagraphs.has(el)) return;

    // Skip elements inside code blocks / code mirrors
    if (el.closest('[class*="_codeBlockEditorWrapper"], [class*="_codeMirrorWrapper"], pre, code, .cm-editor')) return;

    const text = el.textContent || '';

    // Match both escaped (\$…\$) and unescaped ($…$) inline math
    const inlineRegex = /(?<!\$)(?:\\\$|\$)((?!\$|\s)[^\n$]*?(?<!\s))(?:\\\$|\$)(?!\$)/g;
    let match: RegExpExecArray | null;
    while ((match = inlineRegex.exec(text)) !== null) {
      const latex = match[1];
      if (!latex.trim()) continue;

      const start = findTextNodeAtOffset(el, match.index);
      const end = findTextNodeAtOffset(el, match.index + match[0].length);
      if (!start || !end) continue;

      try {
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        const rect = range.getBoundingClientRect();
        const editableRect = editable.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        inlines.push({
          el,
          latex,
          top: rect.top - editableRect.top + editable.scrollTop,
          left: rect.left - editableRect.left + editable.scrollLeft,
          width: rect.width,
          height: rect.height
        });
      } catch {
        // ignore invalid ranges
      }
    }
  });

  return inlines;
};

const createBlockOverlay = (container: HTMLElement, block: MathBlock) => {
  const html = katex.renderToString(block.latex, {
    displayMode: true,
    throwOnError: false,
    trust: true
  });

  const overlay = document.createElement('div');
  overlay.className = 'katex-block-overlay';
  overlay.innerHTML = html;
  overlay.style.position = 'absolute';
  overlay.style.top = `${block.top}px`;
  overlay.style.left = `${block.left}px`;
  overlay.style.width = `${block.width}px`;
  overlay.style.minHeight = `${block.height}px`;
  overlay.style.zIndex = '5';

  overlay.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    overlay.style.display = 'none';
    block.el.setAttribute(EDITING_ATTR, '1');
    block.el.focus();
    moveCursorToMath(block.el, '$$');
  });

  container.appendChild(overlay);
};

const createInlineOverlay = (container: HTMLElement, inlineMath: InlineMath) => {
  const html = katex.renderToString(inlineMath.latex, {
    displayMode: false,
    throwOnError: false,
    trust: true
  });

  const overlay = document.createElement('span');
  overlay.className = 'katex-inline-overlay';
  overlay.innerHTML = html;
  overlay.style.position = 'absolute';
  overlay.style.top = `${inlineMath.top}px`;
  overlay.style.left = `${inlineMath.left}px`;
  overlay.style.minWidth = `${inlineMath.width + 8}px`;
  overlay.style.height = `${inlineMath.height}px`;
  overlay.style.zIndex = '5';
  overlay.dataset.paraId = String(inlineMath.el.dataset.lexicalKey || inlineMath.el.id || '');

  overlay.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    container.querySelectorAll('.katex-inline-overlay').forEach((candidate) => {
      const element = candidate as HTMLElement;
      if (element.dataset.paraId === overlay.dataset.paraId) {
        element.style.display = 'none';
      }
    });
    inlineMath.el.setAttribute(EDITING_ATTR, '1');
    inlineMath.el.focus();
    moveCursorToMath(inlineMath.el, '$');
  });

  container.appendChild(overlay);
};

export const useKatexOverlayDecorations = ({
  editorShellRef,
  viewMode
}: {
  editorShellRef: MutableRefObject<HTMLDivElement | null>;
  viewMode: ViewMode;
}) => {
  useEffect(() => {
    if (viewMode !== 'edit') return;
    const shell = editorShellRef.current;
    if (!shell) return;

    const decorateAll = () => {
      const editable = shell.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) return;
      const container = ensureOverlayContainer(shell);
      if (!container) return;
      const paragraphs = editable.querySelectorAll('p, [data-lexical-paragraph], h1, h2, h3, h4, h5, h6, li, td, th, blockquote');
      const { blocks, blockParagraphs } = collectBlockMath(editable, paragraphs);
      const inlines = collectInlineMath(editable, paragraphs, blockParagraphs);

      container.innerHTML = '';
      blocks.forEach((block) => {
        try {
          createBlockOverlay(container, block);
        } catch {
          // ignore katex errors for malformed blocks
        }
      });
      inlines.forEach((inlineMath) => {
        try {
          createInlineOverlay(container, inlineMath);
        } catch {
          // ignore katex errors for malformed inline expressions
        }
      });
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(`.${OVERLAY_CONTAINER_CLASS}`)) return;

      const editingElements = shell.querySelectorAll(`[${EDITING_ATTR}="1"]`);
      if (editingElements.length === 0) return;
      editingElements.forEach((element) => {
        if (!element.contains(target)) {
          element.removeAttribute(EDITING_ATTR);
        }
      });
      requestAnimationFrame(decorateAll);
    };

    const initialTimer = setTimeout(decorateAll, 400);
    let decorateTimer: ReturnType<typeof setTimeout> | null = null;
    let isDecorating = false;

    const debouncedDecorate = () => {
      if (isDecorating) return;
      if (decorateTimer) clearTimeout(decorateTimer);
      decorateTimer = setTimeout(() => {
        isDecorating = true;
        decorateAll();
        requestAnimationFrame(() => {
          isDecorating = false;
        });
      }, 200);
    };

    const observer = new MutationObserver(debouncedDecorate);
    const editable = shell.querySelector('[contenteditable="true"]');
    if (editable) {
      observer.observe(editable, { childList: true, subtree: true, characterData: true });
    }

    const scrollTarget = editable?.parentElement;
    const handleScroll = () => debouncedDecorate();
    if (scrollTarget) {
      scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    }

    document.addEventListener('click', handleClickOutside);

    return () => {
      clearTimeout(initialTimer);
      if (decorateTimer) clearTimeout(decorateTimer);
      observer.disconnect();
      if (scrollTarget) scrollTarget.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClickOutside);
      const container = shell.querySelector(`.${OVERLAY_CONTAINER_CLASS}`);
      if (container) container.remove();
      shell.querySelectorAll(`[${EDITING_ATTR}]`).forEach((element) => element.removeAttribute(EDITING_ATTR));
    };
  }, [editorShellRef, viewMode]);
};
