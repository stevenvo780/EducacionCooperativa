import { useCallback, useEffect, useState } from 'react';

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
}

const MIN_TEXT_LENGTH = 2;

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

export function useEditorSelectionActions({ editorShellRef, docId, enabled }: UseEditorSelectionActionsOptions) {
  const [selection, setSelection] = useState<EditorSelectionSnapshot | null>(null);

  const clearSelection = useCallback(() => {
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
      setSelection(snapshot);
      return snapshot;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
      setSelection(null);
      return null;
    }

    const range = domSelection.getRangeAt(0);
    const text = domSelection.toString().trim();
    if (!isValidText(text)) {
      setSelection(null);
      return null;
    }

    if (!shell.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return null;
    }

    const startPath = getNodePath(shell, range.startContainer);
    const endPath = getNodePath(shell, range.endContainer);
    if (!startPath || !endPath) {
      setSelection(null);
      return null;
    }

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

    const snapshot: EditorSelectionSnapshot = {
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

    setSelection(snapshot);
    return snapshot;
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
      if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLTextAreaElement) || activeElement.selectionStart === activeElement.selectionEnd) {
          setSelection(null);
        }
      }
    };

    shell.addEventListener('contextmenu', handleContextMenu as any, true);
    shell.addEventListener('touchstart', handleTouchStart as any, { passive: true });
    shell.addEventListener('touchmove', handleTouchMove as any, { passive: true });
    shell.addEventListener('touchend', handleTouchEnd as any, { passive: true });
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      shell.removeEventListener('contextmenu', handleContextMenu as any, true);
      shell.removeEventListener('touchstart', handleTouchStart as any);
      shell.removeEventListener('touchmove', handleTouchMove as any);
      shell.removeEventListener('touchend', handleTouchEnd as any);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (longPressTimer) clearTimeout(longPressTimer);
    };
  }, [captureSelection, editorShellRef, enabled]);

  return {
    selection,
    captureSelection,
    restoreSelection,
    clearSelection
  };
}
