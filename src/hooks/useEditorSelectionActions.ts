import { useCallback, useEffect, useRef, useState } from 'react';

type SelectionKind = 'contenteditable' | 'textarea';

interface SerializedPoint {
  path: number[];
  offset: number;
}

interface SerializedRange {
  start: SerializedPoint;
  end: SerializedPoint;
}

export interface EditorSelectionSnapshot {
  id: string;
  kind: SelectionKind;
  text: string;
  docId: string | null;
  rect: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
  createdAt: number;
  range?: SerializedRange;
  textareaRange?: {
    start: number;
    end: number;
  };
}

interface UseEditorSelectionActionsOptions {
  editorShellRef: React.RefObject<HTMLDivElement | null>;
  docId: string | null;
  enabled: boolean;
  onContextMenuWithoutSelection?: (eventPoint: { x: number; y: number }) => void;
}

const MIN_TEXT_LENGTH = 2;
const PRE_CONTEXT_TTL_MS = 1500;

/* ──── DEBUG: quitar cuando se confirme que funciona ──── */
const DEBUG_SELECTION = true;
const dbg = (...args: unknown[]) => {
  if (DEBUG_SELECTION) console.warn('[SelectionCapture]', ...args);
};

/** Normalize whitespace for robust substring comparison */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Check if `shorter` is contained within `longer` after normalizing whitespace.
 * This detects when the browser reduced a multi-paragraph selection to a single
 * paragraph on right-click in contenteditable.
 */
const isSubstringOf = (shorter: string, longer: string): boolean => {
  if (!shorter || !longer) return false;
  const a = norm(shorter);
  const b = norm(longer);
  return b.length > a.length && b.includes(a);
};

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const clampRect = (rect: DOMRect) => ({
  top: rect.top,
  left: rect.left,
  bottom: rect.bottom,
  right: rect.right,
  width: rect.width,
  height: rect.height
});

const getNodePath = (root: Node, target: Node): number[] | null => {
  const path: number[] = [];
  let current: Node | null = target;

  while (current && current !== root) {
    const parent: Node | null = current.parentNode;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.childNodes, current);
    if (index < 0) return null;
    path.unshift(index);
    current = parent;
  }

  return current === root ? path : null;
};

const resolveNodePath = (root: Node, path: number[]) => {
  let current: Node = root;
  for (const index of path) {
    const nextNode = current.childNodes[index];
    if (!nextNode) return null;
    current = nextNode;
  }
  return current;
};

const isValidText = (text: string) => text.replace(/\s+/g, ' ').trim().length >= MIN_TEXT_LENGTH;

const buildContentEditableSnapshot = ({
  shell,
  docId,
  range,
  eventPoint
}: {
  shell: HTMLDivElement;
  docId: string | null;
  range: Range;
  eventPoint?: { x: number; y: number };
}): EditorSelectionSnapshot | null => {
  const text = range.toString().trim();
  if (!isValidText(text)) return null;
  if (!shell.contains(range.commonAncestorContainer)) return null;

  const startPath = getNodePath(shell, range.startContainer);
  const endPath = getNodePath(shell, range.endContainer);
  if (!startPath || !endPath) return null;

  const rectCandidate = range.getBoundingClientRect();
  const rect = rectCandidate.width > 0 || rectCandidate.height > 0
    ? clampRect(rectCandidate)
    : {
        top: eventPoint?.y ?? 0,
        bottom: eventPoint?.y ?? 0,
        left: eventPoint?.x ?? 0,
        right: eventPoint?.x ?? 0,
        width: 0,
        height: 0
      };

  return {
    id: makeId(),
    kind: 'contenteditable',
    text,
    docId,
    rect,
    createdAt: Date.now(),
    range: {
      start: { path: startPath, offset: range.startOffset },
      end: { path: endPath, offset: range.endOffset }
    }
  };
};

export function useEditorSelectionActions({ editorShellRef, docId, enabled, onContextMenuWithoutSelection }: UseEditorSelectionActionsOptions) {
  const [selection, setSelection] = useState<EditorSelectionSnapshot | null>(null);
  const suppressClearUntilRef = useRef(0);
  /**
   * Snapshot captured at mousedown(button=2) — BEFORE the browser can
   * reduce the selection. Only used as fallback when the DOM selection
   * at contextmenu time is a strict substring of it.
   */
  const preContextRef = useRef<EditorSelectionSnapshot | null>(null);

  const clearSelection = useCallback(() => {
    suppressClearUntilRef.current = 0;
    setSelection(null);
  }, []);

  const captureSelection = useCallback((eventPoint?: { x: number; y: number }) => {
    if (!enabled) {
      setSelection(null);
      return null;
    }

    const shell = editorShellRef.current;
    if (!shell) return null;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement && shell.contains(activeElement)) {
      const start = activeElement.selectionStart ?? 0;
      const end = activeElement.selectionEnd ?? 0;
      const rawText = activeElement.value.slice(start, end);
      const text = rawText.trim();
      if (!isValidText(text) || start === end) {
        setSelection(null);
        return null;
      }

      const rect = eventPoint
        ? { top: eventPoint.y, bottom: eventPoint.y, left: eventPoint.x, right: eventPoint.x, width: 0, height: 0 }
        : shell.getBoundingClientRect();

      const snapshot: EditorSelectionSnapshot = {
        id: makeId(),
        kind: 'textarea',
        text,
        docId,
        rect,
        createdAt: Date.now(),
        textareaRange: { start, end }
      };
      suppressClearUntilRef.current = Date.now() + 800;
      setSelection(snapshot);
      return snapshot;
    }

    const domSelection = window.getSelection();
    const pre = preContextRef.current;
    const preIsRecent = pre && (Date.now() - pre.createdAt) < PRE_CONTEXT_TTL_MS;

    if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
      // DOM selection is gone — use preContext as fallback if recent
      dbg('DOM selection collapsed',
        `| preContext: ${preIsRecent ? `${pre!.text.length} chars (recent)` : 'none/expired'}`);
      if (preIsRecent && pre) {
        suppressClearUntilRef.current = Date.now() + 800;
        setSelection(pre);
        return pre;
      }
      setSelection(null);
      return null;
    }

    const range = domSelection.getRangeAt(0);
    const currentSnapshot = buildContentEditableSnapshot({ shell, docId, range, eventPoint });

    // Decide: use DOM current, or preContext if the browser reduced the selection
    let chosen = currentSnapshot;
    if (currentSnapshot && preIsRecent && pre) {
      // Only prefer preContext if current is a SUBSTRING of it (= browser reduced)
      if (isSubstringOf(currentSnapshot.text, pre.text)) {
        chosen = pre;
        dbg('captureSelection: browser reduced selection → using preContext',
          `| DOM: ${currentSnapshot.text.length} chars`,
          `| preContext: ${pre.text.length} chars`);
      } else {
        dbg('captureSelection: DOM is NOT substring of preContext → using DOM',
          `| DOM: ${currentSnapshot.text.length} chars`,
          `| preContext: ${pre.text.length} chars`);
      }
    } else {
      dbg('captureSelection: using DOM selection',
        `| ${currentSnapshot?.text.length ?? 0} chars`,
        `| preContext: ${preIsRecent ? 'recent' : 'none/expired'}`);
    }

    if (!chosen) {
      setSelection(null);
      return null;
    }

    suppressClearUntilRef.current = Date.now() + 800;
    setSelection(chosen);
    return chosen;
  }, [docId, editorShellRef, enabled]);

  const restoreSelection = useCallback((snapshot?: EditorSelectionSnapshot | null) => {
    const targetSelection = snapshot ?? selection;
    const shell = editorShellRef.current;
    if (!targetSelection || !shell) return false;

    if (targetSelection.kind === 'textarea') {
      const textarea = shell.querySelector('textarea');
      if (!(textarea instanceof HTMLTextAreaElement) || !targetSelection.textareaRange) return false;
      textarea.focus();
      textarea.setSelectionRange(targetSelection.textareaRange.start, targetSelection.textareaRange.end);
      return true;
    }

    if (!targetSelection.range) return false;
    const startNode = resolveNodePath(shell, targetSelection.range.start.path);
    const endNode = resolveNodePath(shell, targetSelection.range.end.path);
    if (!startNode || !endNode) return false;

    const nextRange = document.createRange();
    nextRange.setStart(startNode, Math.min(targetSelection.range.start.offset, startNode.textContent?.length ?? targetSelection.range.start.offset));
    nextRange.setEnd(endNode, Math.min(targetSelection.range.end.offset, endNode.textContent?.length ?? targetSelection.range.end.offset));

    const domSelection = window.getSelection();
    if (!domSelection) return false;
    domSelection.removeAllRanges();
    domSelection.addRange(nextRange);
    return true;
  }, [editorShellRef, selection]);

  useEffect(() => {
    if (!enabled) {
      setSelection(null);
    }
  }, [enabled]);

  useEffect(() => {
    const shell = editorShellRef.current;
    if (!shell || !enabled) return;

    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartPos: { x: number; y: number } | null = null;
    let isDragging = false;
    const LONG_PRESS_MS = 500;
    const DRAG_THRESHOLD_PX = 8;

    const handleContextMenu = (event: MouseEvent | { clientX: number; clientY: number; preventDefault: () => void }) => {
      const snapshot = captureSelection({ x: event.clientX, y: event.clientY });
      if (snapshot) {
        event.preventDefault();
        return;
      }

      if (enabled) {
        onContextMenuWithoutSelection?.({ x: event.clientX, y: event.clientY });
        event.preventDefault();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 2) return;
      // Capture the selection RIGHT NOW before the browser can reduce it
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        dbg('mousedown(2): no active selection to pre-capture');
        return;
      }
      const nextSnapshot = buildContentEditableSnapshot({
        shell,
        docId,
        range: domSelection.getRangeAt(0),
        eventPoint: { x: event.clientX, y: event.clientY }
      });
      if (nextSnapshot) {
        preContextRef.current = nextSnapshot;
        dbg(`mousedown(2): preContext saved (${nextSnapshot.text.length} chars)`,
          `| preview: "${nextSnapshot.text.slice(0, 100)}…"`);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      isDragging = false;
      longPressTimer = setTimeout(() => {
        if (!isDragging) {
          handleContextMenu({
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => {}
          });
        }
      }, LONG_PRESS_MS);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartPos) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.x);
      const dy = Math.abs(touch.clientY - touchStartPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        isDragging = true;
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    };

    const handleTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      touchStartPos = null;
    };

    const handleSelectionChange = () => {
      const domSelection = window.getSelection();

      if (Date.now() < suppressClearUntilRef.current) return;
      if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLTextAreaElement) || activeElement.selectionStart === activeElement.selectionEnd) {
          setSelection(null);
        }
      }
    };

    shell.addEventListener('contextmenu', handleContextMenu as any, true);
    shell.addEventListener('mousedown', handleMouseDown, true);
    shell.addEventListener('touchstart', handleTouchStart as any, { passive: true });
    shell.addEventListener('touchmove', handleTouchMove as any, { passive: true });
    shell.addEventListener('touchend', handleTouchEnd as any, { passive: true });
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      shell.removeEventListener('contextmenu', handleContextMenu as any, true);
      shell.removeEventListener('mousedown', handleMouseDown, true);
      shell.removeEventListener('touchstart', handleTouchStart as any);
      shell.removeEventListener('touchmove', handleTouchMove as any);
      shell.removeEventListener('touchend', handleTouchEnd as any);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (longPressTimer) clearTimeout(longPressTimer);
    };
  }, [captureSelection, docId, editorShellRef, enabled, onContextMenuWithoutSelection]);

  return {
    selection,
    captureSelection,
    restoreSelection,
    clearSelection
  };
}
