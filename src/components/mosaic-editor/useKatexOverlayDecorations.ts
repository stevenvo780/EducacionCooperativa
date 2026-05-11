import { useEffect, type MutableRefObject } from 'react';
import katex from 'katex';
import type { ViewMode } from './types';

const OVERLAY_CONTAINER_CLASS = 'katex-overlay-container';
const EDITING_ATTR = 'data-katex-editing';
const LATEX_LAZY_ATTR = 'data-katex-lazy';

// LRU cache for KaTeX renderToString. Same LaTeX in display vs inline mode
// produces different HTML, so we key on `${latex}::${displayMode}`. Evicts
// least-recently-used entries past the cap to bound memory in long sessions.
const KATEX_CACHE_MAX = 500;
const _katexCache = new Map<string, string>();

function getCachedKatex(latex: string, displayMode: boolean): string {
  const key = `${displayMode ? '1' : '0'}::${latex}`;
  const hit = _katexCache.get(key);
  if (hit !== undefined) {
    // Re-insert to mark as most-recently-used
    _katexCache.delete(key);
    _katexCache.set(key, hit);
    return hit;
  }
  let html: string;
  try {
    html = katex.renderToString(latex, { displayMode, throwOnError: false, trust: true });
  } catch {
    html = '';
  }
  _katexCache.set(key, html);
  if (_katexCache.size > KATEX_CACHE_MAX) {
    const oldestKey = _katexCache.keys().next().value;
    if (oldestKey !== undefined) _katexCache.delete(oldestKey);
  }
  return html;
}

type MathBlock = {
  elements: HTMLElement[];
  latex: string;
  cursorOffset: number;
  top: number;
  left: number;
  width: number;
  height: number;
};
const BLOCK_DELIMITER_REGEX = /(?:\\\$\\\$|\$\$)/g;

type InlineMath = {
  el: HTMLElement;
  latex: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

const roundedMetric = (value: number) => Math.round(value * 100) / 100;

const buildRenderKey = (blocks: MathBlock[], inlines: InlineMath[]) => JSON.stringify({
  blocks: blocks.map((block) => [
    block.latex,
    roundedMetric(block.top),
    roundedMetric(block.left),
    roundedMetric(block.width),
    roundedMetric(block.height)
  ]),
  inlines: inlines.map((inlineMath) => [
    inlineMath.latex,
    roundedMetric(inlineMath.top),
    roundedMetric(inlineMath.left),
    roundedMetric(inlineMath.width),
    roundedMetric(inlineMath.height)
  ])
});

const nodeIsInsideKatexOverlay = (node: Node) => {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  return Boolean(
    element?.classList.contains(OVERLAY_CONTAINER_CLASS)
    || element?.closest(`.${OVERLAY_CONTAINER_CLASS}`)
  );
};

const mutationOnlyTouchesKatexOverlay = (mutation: MutationRecord) => {
  if (nodeIsInsideKatexOverlay(mutation.target)) return true;

  const changedNodes = [
    ...Array.from(mutation.addedNodes),
    ...Array.from(mutation.removedNodes)
  ];
  return changedNodes.length > 0 && changedNodes.every(nodeIsInsideKatexOverlay);
};

export const isKatexOverlayMutationBatch = (mutations: readonly MutationRecord[]) => (
  mutations.length > 0 && mutations.every(mutationOnlyTouchesKatexOverlay)
);

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

const findNextBlockDelimiter = (text: string, fromIndex = 0) => {
  BLOCK_DELIMITER_REGEX.lastIndex = fromIndex;
  const match = BLOCK_DELIMITER_REGEX.exec(text);
  if (!match) return null;

  return {
    index: match.index,
    value: match[0],
    length: match[0].length
  };
};

const isMathCandidateElement = (el: HTMLElement) => {
  if (el.getAttribute(EDITING_ATTR) === '1') return false;
  return !el.closest('[class*="_codeBlockEditorWrapper"], [class*="_codeMirrorWrapper"], pre, code, .cm-editor');
};

const measureBlockGeometry = (
  editable: HTMLElement,
  elements: HTMLElement[],
  start: { node: Text; offset: number },
  end: { node: Text; offset: number },
) => {
  const editableRect = editable.getBoundingClientRect();
  const firstRect = elements[0]?.getBoundingClientRect();
  const fallbackRects = elements.map((element) => element.getBoundingClientRect());

  let top = firstRect?.top ? firstRect.top - editableRect.top + editable.scrollTop : elements[0]?.offsetTop || 0;
  let left = fallbackRects.length > 0
    ? Math.min(...fallbackRects.map((rect) => rect.left - editableRect.left + editable.scrollLeft))
    : 0;
  let width = fallbackRects.length > 0
    ? Math.max(...fallbackRects.map((rect) => rect.right - editableRect.left + editable.scrollLeft)) - left
    : elements[0]?.getBoundingClientRect().width || 0;
  let height = fallbackRects.length > 0
    ? Math.max(...fallbackRects.map((rect) => rect.bottom)) - Math.min(...fallbackRects.map((rect) => rect.top))
    : elements[0]?.getBoundingClientRect().height || 0;

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
    // fallback to element metrics
  }

  return {
    top,
    left,
    width: Math.max(width, 0),
    height: Math.max(height, 0)
  };
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

const moveCursorToOffset = (el: HTMLElement, charOffset: number) => {
  try {
    const target = findTextNodeAtOffset(el, charOffset);
    if (!target) return;
    const range = document.createRange();
    range.setStart(target.node, target.offset);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch {
    // best effort
  }
};

export const collectBlockMath = (editable: HTMLElement, paragraphs: NodeListOf<Element>) => {
  const blocks: MathBlock[] = [];
  const blockParagraphs = new Set<HTMLElement>();
  const candidates = Array.from(paragraphs)
    .map((paragraph) => paragraph as HTMLElement)
    .filter(isMathCandidateElement);

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const firstEl = candidates[idx];
    if (!firstEl || blockParagraphs.has(firstEl)) continue;

    const firstText = firstEl.textContent || '';
    const openDelimiter = findNextBlockDelimiter(firstText);
    if (!openDelimiter) continue;

    const sameLineClose = findNextBlockDelimiter(
      firstText,
      openDelimiter.index + openDelimiter.length,
    );

    if (sameLineClose) {
      const latex = normalizeLatex(
        firstText.slice(openDelimiter.index + openDelimiter.length, sameLineClose.index),
      );
      if (!latex.trim()) continue;

      const start = findTextNodeAtOffset(firstEl, openDelimiter.index);
      const end = findTextNodeAtOffset(firstEl, sameLineClose.index + sameLineClose.length);
      if (!start || !end) continue;

      const geometry = measureBlockGeometry(editable, [firstEl], start, end);
      blockParagraphs.add(firstEl);
      blocks.push({
        elements: [firstEl],
        latex,
        cursorOffset: openDelimiter.index + openDelimiter.length,
        ...geometry
      });
      continue;
    }

    const blockElements: HTMLElement[] = [firstEl];
    const latexSegments = [firstText.slice(openDelimiter.index + openDelimiter.length)];
    let closeMatch: ReturnType<typeof findNextBlockDelimiter> = null;
    let lastEl: HTMLElement = firstEl;

    for (let nextIdx = idx + 1; nextIdx < candidates.length; nextIdx += 1) {
      const candidate = candidates[nextIdx];
      if (!candidate) continue;
      blockElements.push(candidate);

      const candidateText = candidate.textContent || '';
      const candidateClose = findNextBlockDelimiter(candidateText);
      if (candidateClose) {
        closeMatch = candidateClose;
        lastEl = candidate;
        latexSegments.push(candidateText.slice(0, candidateClose.index));
        break;
      }

      latexSegments.push(candidateText);
    }

    if (!closeMatch) continue;

    const latex = normalizeLatex(latexSegments.join('\n'));
    if (!latex.trim()) continue;

    const start = findTextNodeAtOffset(firstEl, openDelimiter.index);
    const end = findTextNodeAtOffset(lastEl, closeMatch.index + closeMatch.length);
    if (!start || !end) continue;

    const geometry = measureBlockGeometry(editable, blockElements, start, end);
    blockElements.forEach((element) => blockParagraphs.add(element));
    blocks.push({
      elements: blockElements,
      latex,
      cursorOffset: openDelimiter.index + openDelimiter.length,
      ...geometry
    });

    idx += blockElements.length - 1;
  }

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
      if (!latex || !latex.trim()) continue;

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

const createBlockOverlay = (block: MathBlock, deferRender: boolean) => {
  const overlay = document.createElement('div');
  overlay.className = 'katex-block-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = `${block.top}px`;
  overlay.style.left = `${block.left}px`;
  overlay.style.width = `${block.width}px`;
  overlay.style.minHeight = `${block.height}px`;
  overlay.style.zIndex = '5';
  overlay.dataset.latex = block.latex;
  overlay.dataset.displayMode = '1';
  if (deferRender) {
    overlay.setAttribute(LATEX_LAZY_ATTR, '1');
  } else {
    overlay.innerHTML = getCachedKatex(block.latex, true);
  }

  overlay.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    overlay.style.display = 'none';
    block.elements.forEach((element) => element.setAttribute(EDITING_ATTR, '1'));
    const focusTarget = block.elements[0];
    focusTarget?.focus();
    if (focusTarget) {
      moveCursorToOffset(focusTarget, block.cursorOffset);
    }
  });

  return overlay;
};

const createInlineOverlay = (container: HTMLElement, inlineMath: InlineMath, deferRender: boolean) => {
  const overlay = document.createElement('span');
  overlay.className = 'katex-inline-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = `${inlineMath.top}px`;
  overlay.style.left = `${inlineMath.left}px`;
  overlay.style.minWidth = `${inlineMath.width + 8}px`;
  overlay.style.height = `${inlineMath.height}px`;
  overlay.style.zIndex = '5';
  overlay.dataset.paraId = String(inlineMath.el.dataset.lexicalKey || inlineMath.el.id || '');
  overlay.dataset.latex = inlineMath.latex;
  overlay.dataset.displayMode = '0';
  if (deferRender) {
    overlay.setAttribute(LATEX_LAZY_ATTR, '1');
  } else {
    overlay.innerHTML = getCachedKatex(inlineMath.latex, false);
  }

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

  return overlay;
};

/**
 * Renderiza un overlay perezoso (placeholder) llenando su HTML cuando entra
 * al viewport. Usado por IntersectionObserver para no pagar `renderToString`
 * sobre fórmulas off-screen.
 */
const fillLazyOverlay = (overlay: HTMLElement) => {
  if (!overlay.hasAttribute(LATEX_LAZY_ATTR)) return;
  const latex = overlay.dataset.latex || '';
  const displayMode = overlay.dataset.displayMode === '1';
  if (!latex) return;
  overlay.innerHTML = getCachedKatex(latex, displayMode);
  overlay.removeAttribute(LATEX_LAZY_ATTR);
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

    let observedEditable: HTMLElement | null = null;
    let editableObserver: MutationObserver | null = null;
    let shellObserver: MutationObserver | null = null;
    let scrollTarget: HTMLElement | null = null;
    let decorateFrame: number | null = null;
    let viewportObserver: IntersectionObserver | null = null;

    // Lazy fill via IntersectionObserver (200px margin for prefetch). Overlays
    // tagged with LATEX_LAZY_ATTR get their innerHTML filled when scrolling
    // brings them into view. Off-screen formulas remain placeholders, so we
    // pay zero `katex.renderToString` cost for them.
    const ensureViewportObserver = () => {
      if (viewportObserver) return viewportObserver;
      viewportObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement;
              fillLazyOverlay(target);
              viewportObserver?.unobserve(target);
            }
          }
        },
        { rootMargin: '200px 0px', threshold: 0.01 }
      );
      return viewportObserver;
    };

    const decorateAll = () => {
      const editable = shell.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) return;
      const container = ensureOverlayContainer(shell);
      if (!container) return;
      const paragraphs = editable.querySelectorAll('p, [data-lexical-paragraph], h1, h2, h3, h4, h5, h6, li, td, th, blockquote');
      const { blocks, blockParagraphs } = collectBlockMath(editable, paragraphs);
      const inlines = collectInlineMath(editable, paragraphs, blockParagraphs);
      const renderKey = buildRenderKey(blocks, inlines);

      if (container.dataset.renderKey === renderKey) return;

      const sp = editable.parentElement;
      const viewTop = sp ? sp.scrollTop : 0;
      const viewBottom = sp ? viewTop + sp.clientHeight : Number.POSITIVE_INFINITY;
      const viewMargin = 200;

      const isOffscreen = (top: number, height: number) => {
        if (!sp) return false;
        return top + height < viewTop - viewMargin || top > viewBottom + viewMargin;
      };

      if (viewportObserver) {
        viewportObserver.disconnect();
        viewportObserver = null;
      }
      const observer = ensureViewportObserver();

      const fragment = document.createDocumentFragment();
      const lazyOverlays: HTMLElement[] = [];

      for (const block of blocks) {
        try {
          const offscreen = isOffscreen(block.top, block.height);
          const overlay = createBlockOverlay(block, offscreen);
          if (offscreen) lazyOverlays.push(overlay);
          fragment.appendChild(overlay);
        } catch {
          // ignore katex errors for malformed blocks
        }
      }
      for (const inlineMath of inlines) {
        try {
          const offscreen = isOffscreen(inlineMath.top, inlineMath.height);
          const overlay = createInlineOverlay(container, inlineMath, offscreen);
          if (offscreen) lazyOverlays.push(overlay);
          fragment.appendChild(overlay);
        } catch {
          // ignore katex errors for malformed inline expressions
        }
      }
      container.dataset.renderKey = renderKey;
      container.replaceChildren(fragment);

      for (const overlay of lazyOverlays) {
        observer.observe(overlay);
      }
    };

    let decorateTimer: ReturnType<typeof setTimeout> | null = null;
    let isDecorating = false;

    const runDecorate = () => {
      if (isDecorating) return;
      isDecorating = true;
      decorateAll();
      decorateFrame = requestAnimationFrame(() => {
        isDecorating = false;
        decorateFrame = null;
      });
    };

    const debouncedDecorate = () => {
      if (decorateTimer) clearTimeout(decorateTimer);
      decorateTimer = setTimeout(() => {
        decorateTimer = null;
        runDecorate();
      }, 120);
    };

    const detachEditableBindings = () => {
      editableObserver?.disconnect();
      editableObserver = null;
      if (scrollTarget) {
        scrollTarget.removeEventListener('scroll', debouncedDecorate);
        scrollTarget = null;
      }
      observedEditable = null;
    };

    const attachEditableBindings = () => {
      const editable = shell.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) return;
      if (editable === observedEditable) return;

      detachEditableBindings();
      observedEditable = editable;

      editableObserver = new MutationObserver(debouncedDecorate);
      editableObserver.observe(editable, { childList: true, subtree: true, characterData: true });

      scrollTarget = editable.parentElement;
      if (scrollTarget) {
        scrollTarget.addEventListener('scroll', debouncedDecorate, { passive: true });
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          runDecorate();
        });
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
      requestAnimationFrame(runDecorate);
    };

    const initialTimer = setTimeout(() => {
      attachEditableBindings();
      runDecorate();
    }, 400);

    shellObserver = new MutationObserver((mutations) => {
      if (isKatexOverlayMutationBatch(mutations)) return;
      attachEditableBindings();
      debouncedDecorate();
    });
    shellObserver.observe(shell, { childList: true, subtree: true });

    attachEditableBindings();

    document.addEventListener('click', handleClickOutside);

    return () => {
      clearTimeout(initialTimer);
      if (decorateTimer) clearTimeout(decorateTimer);
      if (decorateFrame !== null) cancelAnimationFrame(decorateFrame);
      viewportObserver?.disconnect();
      viewportObserver = null;
      shellObserver?.disconnect();
      detachEditableBindings();
      document.removeEventListener('click', handleClickOutside);
      const container = shell.querySelector(`.${OVERLAY_CONTAINER_CLASS}`);
      if (container) container.remove();
      shell.querySelectorAll(`[${EDITING_ATTR}]`).forEach((element) => element.removeAttribute(EDITING_ATTR));
    };
  }, [editorShellRef, viewMode]);
};
