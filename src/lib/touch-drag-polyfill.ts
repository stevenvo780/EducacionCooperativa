/**
 * Touch Drag Polyfill for tablet/mobile devices.
 *
 * HTML5 native drag-and-drop events (dragstart, dragover, drop) do NOT fire
 * on touch devices. This module translates touch events into a custom drag
 * system that coordinates with existing drop zones.
 *
 * Touch drag sources can be either:
 *   - elements with `draggable="true"` that already use native HTML5 DnD
 *   - elements with `data-drag-doc-id="<id>"` for touch-only layout moves
 *
 * On touch devices we emit both:
 *   - synthetic dragstart/dragover/drop/dragend events with a mock dataTransfer
 *   - the custom `agora:touch-*` events used by the mosaic layout helpers
 *
 * Drop zones: must have `data-drop-zone="<tileId>"` (or `"__empty__"`)
 *
 * Communication with React components via CustomEvents on `window`:
 *   - `agora:touch-drag-start`  → { docId }
 *   - `agora:touch-drag-over`   → { tileId, position }
 *   - `agora:touch-drag-leave`  → {}
 *   - `agora:touch-drop`        → { docId, tileId, position }
 *   - `agora:touch-drag-end`    → {}
 */

import { markInternalDragStart, markInternalDragEnd } from './internal-drag-flag';

// ── Configuration ───────────────────────────────────────────────
const MOVE_THRESHOLD = 10; // px before drag is confirmed
const LONG_PRESS_DELAY = 200; // ms hold before drag activates (vs tap)

// ── State ───────────────────────────────────────────────────────
let _initialized = false;
let _dragging = false;
let _dragDocId: string | null = null;
let _startX = 0;
let _startY = 0;
let _ghostEl: HTMLElement | null = null;
let _shieldEl: HTMLElement | null = null;
let _lastDropZone: string | null = null;
let _lastResolvedDropTarget: {
  element: HTMLElement;
  tileId: string;
  position: 'left' | 'right' | 'top' | 'bottom' | 'replace';
} | null = null;
let _longPressTimer: ReturnType<typeof setTimeout> | null = null;
let _longPressReady = false;
let _dragConfirmed = false;
let _sourceEl: HTMLElement | null = null;
let _dataTransfer: DataTransfer | null = null;

// ── Public API ──────────────────────────────────────────────────

/** Initialize once at app level. Safe to call multiple times. */
export function initTouchDragPolyfill(): void {
  if (_initialized) return;
  // Only activate on touch-capable devices
  if (typeof window === 'undefined') return;
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

  _initialized = true;

  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('touchcancel', onTouchCancel, { passive: false });
}

/** Teardown (mostly for tests). */
export function destroyTouchDragPolyfill(): void {
  if (!_initialized) return;
  document.removeEventListener('touchstart', onTouchStart);
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
  document.removeEventListener('touchcancel', onTouchCancel);
  cleanup();
  _initialized = false;
}

// ── Touch handlers ──────────────────────────────────────────────

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length !== 1) return;

  const touch = e.touches[0];
  const target = touch.target as HTMLElement;

  // Native draggable elements cover most dashboard DnD flows.
  // `data-drag-doc-id` keeps touch-only layout drags available for mosaic tiles.
  const draggable = target.closest<HTMLElement>('[draggable="true"], [data-drag-doc-id]');
  if (!draggable) return;

  _startX = touch.clientX;
  _startY = touch.clientY;
  _dragDocId = draggable.getAttribute('data-drag-doc-id');
  _sourceEl = draggable;
  _dragConfirmed = false;
  _longPressReady = false;

  // Start a long-press timer — drag only activates if held long enough
  // OR if the finger moves beyond the threshold
  _longPressTimer = setTimeout(() => {
    _longPressTimer = null;
    _longPressReady = true;
  }, LONG_PRESS_DELAY);
}

function onTouchMove(e: TouchEvent): void {
  if (!_sourceEl || e.touches.length !== 1) return;

  const touch = e.touches[0];
  const dx = touch.clientX - _startX;
  const dy = touch.clientY - _startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (!_dragConfirmed) {
    // Start the drag after a deliberate move or after a short long-press hold.
    if (!_longPressReady && dist < MOVE_THRESHOLD) return;

    _dragConfirmed = true;
    _dragging = true;
    _dataTransfer = createTouchDataTransfer(_dragDocId ? {
      'application/x-dashboard-internal-drag': 'touch-doc',
      'application/x-doc-id': _dragDocId,
      'text/plain': _dragDocId
    } : undefined);

    // Prevent scrolling once drag is confirmed
    e.preventDefault();

    markInternalDragStart();
    createShield();
    createGhost(_sourceEl, _dragDocId ?? _sourceEl.dataset.dragLabel ?? _sourceEl.textContent?.trim().slice(0, 30) ?? 'Elemento');
    dispatchSyntheticDragEvent('dragstart', _sourceEl, touch);

    if (_dragDocId) {
      window.dispatchEvent(new CustomEvent('agora:touch-drag-start', {
        detail: { docId: _dragDocId }
      }));
    }
  }

  // Drag is active — move ghost and check drop zones
  e.preventDefault();
  moveGhost(touch.clientX, touch.clientY);
  const elUnder = getElementUnderPoint(touch.clientX, touch.clientY);
  const dropZone = getDropZoneAtPoint(touch.clientX, touch.clientY)
    ?? elUnder?.closest<HTMLElement>('[data-drop-zone]')
    ?? null;

  if (elUnder) {
    dispatchSyntheticDragEvent('dragover', elUnder, touch);
  }

  // Find drop zone under finger
  const tileId = dropZone?.getAttribute('data-drop-zone') ?? null;

  if (tileId !== _lastDropZone) {
    if (_lastDropZone) {
      window.dispatchEvent(new CustomEvent('agora:touch-drag-leave', { detail: {} }));
    }
    _lastDropZone = tileId;
  }

  if (tileId && dropZone) {
    const rect = dropZone.getBoundingClientRect();
    const position = calcDropPosition(touch.clientX, touch.clientY, rect);
    _lastResolvedDropTarget = { element: dropZone, tileId, position };
    window.dispatchEvent(new CustomEvent('agora:touch-drag-over', {
      detail: { tileId, position }
    }));
  } else {
    _lastResolvedDropTarget = null;
  }
}

function onTouchEnd(e: TouchEvent): void {
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
  _longPressReady = false;

  if (!_dragging || !_sourceEl) {
    // Not dragging — let native click/tap through
    _dragDocId = null;
    _sourceEl = null;
    _dataTransfer = null;
    return;
  }

  // Find the final drop target
  const touch = e.changedTouches[0];
  const elUnder = getElementUnderPoint(touch.clientX, touch.clientY);
  const directDropZone = getDropZoneAtPoint(touch.clientX, touch.clientY)
    ?? elUnder?.closest<HTMLElement>('[data-drop-zone]')
    ?? null;
  const dropTarget = directDropZone
    ? {
      element: directDropZone,
      tileId: directDropZone.getAttribute('data-drop-zone') ?? null,
      position: calcDropPosition(touch.clientX, touch.clientY, directDropZone.getBoundingClientRect())
    }
    : _lastResolvedDropTarget;

  if (elUnder) {
    dispatchSyntheticDragEvent('drop', elUnder, touch);
  }

  if (_dragDocId && dropTarget?.tileId && dropTarget.element) {

    window.dispatchEvent(new CustomEvent('agora:touch-drop', {
      detail: {
        docId: _dragDocId,
        tileId: dropTarget.tileId,
        position: dropTarget.position
      }
    }));
  }

  dispatchSyntheticDragEvent('dragend', _sourceEl, touch);

  // Prevent the ghost tap from firing a click
  e.preventDefault();

  cleanup();
}

function onTouchCancel(_e: TouchEvent): void {
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
  _longPressReady = false;
  if (_dragging && _sourceEl) {
    dispatchSyntheticDragEvent('dragend', _sourceEl);
  }
  cleanup();
}

function createTouchDataTransfer(initialData?: Record<string, string>): DataTransfer {
  const store = new Map(Object.entries(initialData ?? {}));

  return {
    dropEffect: 'move',
    effectAllowed: 'all',
    get files() {
      return [] as unknown as FileList;
    },
    get items() {
      return [] as unknown as DataTransferItemList;
    },
    get types() {
      return Array.from(store.keys());
    },
    clearData(format?: string) {
      if (format) {
        store.delete(format);
        return;
      }
      store.clear();
    },
    getData(format: string) {
      return store.get(format) ?? '';
    },
    setData(format: string, data: string) {
      store.set(format, data);
    },
    setDragImage() {}
  } as DataTransfer;
}

function dispatchSyntheticDragEvent(
  type: 'dragstart' | 'dragover' | 'drop' | 'dragend',
  target: EventTarget,
  touch?: Touch,
): void {
  if (!_dataTransfer) return;

  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;

  Object.defineProperties(event, {
    dataTransfer: {
      configurable: true,
      value: _dataTransfer
    },
    clientX: {
      configurable: true,
      value: touch?.clientX ?? _startX
    },
    clientY: {
      configurable: true,
      value: touch?.clientY ?? _startY
    },
    pageX: {
      configurable: true,
      value: touch?.clientX ?? _startX
    },
    pageY: {
      configurable: true,
      value: touch?.clientY ?? _startY
    },
    screenX: {
      configurable: true,
      value: touch?.clientX ?? _startX
    },
    screenY: {
      configurable: true,
      value: touch?.clientY ?? _startY
    }
  });

  target.dispatchEvent(event);
}

function getElementUnderPoint(clientX: number, clientY: number): HTMLElement | null {
  return withHiddenDragArtifacts(() => {
    if (typeof document.elementsFromPoint === 'function') {
      const elements = document.elementsFromPoint(clientX, clientY);
      return (elements.find((element): element is HTMLElement => element instanceof HTMLElement) ?? null);
    }

    const elUnder = document.elementFromPoint(clientX, clientY);
    return elUnder instanceof HTMLElement ? elUnder : null;
  });
}

function getDropZoneAtPoint(clientX: number, clientY: number): HTMLElement | null {
  return withHiddenDragArtifacts(() => {
    const dropZones = Array.from(document.querySelectorAll<HTMLElement>('[data-drop-zone]'));
    let bestMatch: { element: HTMLElement; area: number } | null = null;

    for (const zone of dropZones) {
      const rect = zone.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const style = window.getComputedStyle(zone);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const withinBounds = clientX >= rect.left
        && clientX <= rect.right
        && clientY >= rect.top
        && clientY <= rect.bottom;

      if (!withinBounds) continue;

      const area = rect.width * rect.height;
      if (!bestMatch || area < bestMatch.area) {
        bestMatch = { element: zone, area };
      }
    }

    return bestMatch?.element ?? null;
  });
}

function withHiddenDragArtifacts<T>(fn: () => T): T {
  const previousGhostDisplay = _ghostEl?.style.display ?? '';
  const previousShieldDisplay = _shieldEl?.style.display ?? '';

  if (_ghostEl) _ghostEl.style.display = 'none';
  if (_shieldEl) _shieldEl.style.display = 'none';

  try {
    return fn();
  } finally {
    if (_ghostEl) _ghostEl.style.display = previousGhostDisplay;
    if (_shieldEl) _shieldEl.style.display = previousShieldDisplay;
  }
}

// ── Drag artifacts ──────────────────────────────────────────────

function createShield(): void {
  _shieldEl = document.createElement('div');
  _shieldEl.setAttribute('data-touch-drag-shield', 'true');

  Object.assign(_shieldEl.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99998',
    background: 'transparent',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  });

  document.body.appendChild(_shieldEl);
}

function createGhost(sourceEl: HTMLElement | null, docId: string): void {
  _ghostEl = document.createElement('div');

  // Extract a short label from the source element
  const label = sourceEl?.dataset.dragLabel
    ?? sourceEl?.querySelector('.text-xs')?.textContent
    ?? sourceEl?.textContent?.trim().slice(0, 30)
    ?? docId;

  Object.assign(_ghostEl.style, {
    position: 'fixed',
    top: `${_startY - 20}px`,
    left: `${_startX - 40}px`,
    zIndex: '99999',
    padding: '6px 14px',
    borderRadius: '10px',
    background: 'rgba(233, 69, 96, 0.9)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transform: 'scale(0.95)',
    transition: 'transform 0.1s',
    backdropFilter: 'blur(8px)'
  });

  _ghostEl.textContent = `📌 ${label}`;
  document.body.appendChild(_ghostEl);

  // Animate in
  requestAnimationFrame(() => {
    if (_ghostEl) _ghostEl.style.transform = 'scale(1)';
  });
}

function moveGhost(x: number, y: number): void {
  if (!_ghostEl) return;
  _ghostEl.style.left = `${x - 40}px`;
  _ghostEl.style.top = `${y - 20}px`;
}

// ── Position calculation (mirrors MosaicLayout.calcDropPosition) ─

function calcDropPosition(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): 'left' | 'right' | 'top' | 'bottom' | 'replace' {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const edge = 0.22;
  if (x < edge) return 'left';
  if (x > 1 - edge) return 'right';
  if (y < edge) return 'top';
  if (y > 1 - edge) return 'bottom';
  return 'replace';
}

// ── Cleanup ─────────────────────────────────────────────────────

function cleanup(): void {
  if (_shieldEl) {
    _shieldEl.remove();
    _shieldEl = null;
  }
  if (_ghostEl) {
    _ghostEl.remove();
    _ghostEl = null;
  }
  if (_dragging) {
    markInternalDragEnd();
    window.dispatchEvent(new CustomEvent('agora:touch-drag-end', { detail: {} }));
  }
  _dragging = false;
  _dragDocId = null;
  _dragConfirmed = false;
  _lastDropZone = null;
  _lastResolvedDropTarget = null;
  _sourceEl = null;
  _dataTransfer = null;
  _longPressReady = false;
}
