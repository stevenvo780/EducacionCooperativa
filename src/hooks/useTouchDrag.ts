'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { setTouchDragDocId, subscribeTouchDragDocId } from '@/lib/touchDragState';

export const LONG_PRESS_DELAY_MS = 400;
export const DRAG_START_THRESHOLD_PX = 8;

/**
 * Ghost element shown while touch-dragging a document item.
 * Reused across multiple drags; created lazily.
 */
let ghostEl: HTMLElement | null = null;

function getGhostEl(): HTMLElement {
  if (!ghostEl) {
    ghostEl = document.createElement('div');
    ghostEl.id = 'touch-drag-ghost';
    ghostEl.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:99999',
      'padding:6px 12px',
      'border-radius:8px',
      'background:rgba(30,41,59,0.95)',
      'border:1px solid rgba(100,116,139,0.5)',
      'color:#cbd5e1',
      'font-size:12px',
      'font-weight:500',
      'box-shadow:0 8px 24px rgba(0,0,0,0.5)',
      'backdrop-filter:blur(4px)',
      'display:none',
      'user-select:none',
      'white-space:nowrap'
    ].join(';');
    document.body.appendChild(ghostEl);
  }
  return ghostEl;
}

/**
 * Global event dispatched when a touch-drag of a document ends over a valid drop target.
 * `detail.docId`  – the dragged document id
 * `detail.tileId` – the target tile id (from data-tile-id attribute), or null for empty canvas
 */
export type TouchDropDocEvent = CustomEvent<{ docId: string; tileId: string | null }>;

export const TOUCH_DROP_DOC_EVENT = 'touchdropdoc';

/**
 * Returns touch-event props to attach to a draggable document item so that
 * touch users can drag the item to a mosaic tile.
 *
 * @param docId   ID of the document to drag
 * @param label   Display label shown in the ghost element
 */
export function useTouchDrag(docId: string, label: string) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const cancelDrag = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging.current) {
      setTouchDragDocId(null);
      isDragging.current = false;
    }
    if (typeof document !== 'undefined' && ghostEl !== null) {
      ghostEl.style.display = 'none';
    }
    startPos.current = null;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelDrag();
    };
  }, [cancelDrag]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startPos.current = { x: touch.clientX, y: touch.clientY };

      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        isDragging.current = true;
        setTouchDragDocId(docId);

        const ghost = getGhostEl();
        ghost.textContent = `📄 ${label}`;
        ghost.style.display = 'block';
        ghost.style.left = `${touch.clientX + 12}px`;
        ghost.style.top = `${touch.clientY - 20}px`;
      }, LONG_PRESS_DELAY_MS);
    },
    [docId, label],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current && startPos.current) {
      // Cancel long-press if the finger moved too much before the timer fired
      const touch = e.touches[0];
      const dx = touch.clientX - startPos.current.x;
      const dy = touch.clientY - startPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_START_THRESHOLD_PX) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        return;
      }
    }

    if (!isDragging.current) return;

    // Prevent page scroll while dragging
    e.preventDefault();

    const touch = e.touches[0];
    const ghost = getGhostEl();
    ghost.style.left = `${touch.clientX + 12}px`;
    ghost.style.top = `${touch.clientY - 20}px`;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) {
        cancelDrag();
        return;
      }

      const touch = e.changedTouches[0];

      // Temporarily hide the ghost so elementFromPoint works
      getGhostEl().style.display = 'none';

      // Find a tile or empty-canvas target under the touch point
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      let tileId: string | null = null;
      let isDropTarget = false;
      let node: Element | null = el;
      while (node) {
        if (node instanceof HTMLElement) {
          if (node.dataset.touchDropTarget === 'true') {
            isDropTarget = true;
            tileId = node.dataset.tileId ?? null;
            break;
          }
          if (node.dataset.touchEmptyDrop === 'true') {
            isDropTarget = true;
            break;
          }
        }
        node = node.parentElement;
      }

      if (isDropTarget) {
        window.dispatchEvent(
          new CustomEvent(TOUCH_DROP_DOC_EVENT, {
            detail: { docId, tileId }
          }) as TouchDropDocEvent
        );
      }

      setTouchDragDocId(null);
      isDragging.current = false;
      startPos.current = null;
    },
    [docId, cancelDrag],
  );

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}

/**
 * Returns a boolean that is true while a touch-drag of any doc is in progress.
 * Useful to show UI affordances (e.g. highlight drop zones).
 */
export function useTouchDragActive(): boolean {
  const [active, setActive] = useState<boolean>(false);
  useEffect(() => {
    return subscribeTouchDragDocId((id) => setActive(id !== null));
  }, []);
  return active;
}
