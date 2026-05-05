import { useCallback, useRef, useState, type MouseEvent, type TouchEvent } from 'react';

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX = 8;
const DISABLE_CONTEXT_MENU_SELECTOR = '[data-disable-context-menu-trigger="true"]';

interface MenuState<T> {
  x: number;
  y: number;
  data: T;
}

export function useContextMenu<T>() {
  const [menu, setMenu] = useState<MenuState<T> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const open = useCallback((x: number, y: number, data: T) => {
    setMenu({ x, y, data });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  const shouldIgnoreTarget = useCallback((target: EventTarget | null) => {
    return target instanceof Element && Boolean(target.closest(DISABLE_CONTEXT_MENU_SELECTOR));
  }, []);

  // Retorna los event handlers para adjuntar al elemento objetivo.
  // Cubre: right-click en desktop y long press en touch.
  // Cancela el long press si hay movimiento (drag).
  const getTriggerProps = useCallback((data: T) => ({
    onContextMenu: (e: MouseEvent) => {
      if (shouldIgnoreTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, data });
    },
    onTouchStart: (e: TouchEvent) => {
      if (shouldIgnoreTarget(e.target) || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      isDragging.current = false;
      longPressTimer.current = setTimeout(() => {
        if (!isDragging.current) {
          setMenu({ x: touch.clientX, y: touch.clientY, data });
        }
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: TouchEvent) => {
      if (!touchStartPos.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        isDragging.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    },
    onTouchEnd: () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      touchStartPos.current = null;
    },
    onTouchCancel: () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      touchStartPos.current = null;
    }
  }), [shouldIgnoreTarget]);

  return { menu, open, close, getTriggerProps };
}
