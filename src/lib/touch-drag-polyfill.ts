/**
 * Touch Drag Polyfill for tablet/mobile devices.
 *
 * HTML5 native drag-and-drop events (dragstart, dragover, drop) do NOT fire
 * on touch devices. This module translates touch events into a custom drag
 * system that coordinates with existing drop zones.
 *
 * Draggable elements: must have `draggable="true"` AND `data-drag-doc-id="<id>"`
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
let _lastDropZone: string | null = null;
let _longPressTimer: ReturnType<typeof setTimeout> | null = null;
let _dragConfirmed = false;
let _sourceEl: HTMLElement | null = null;

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

  // Find the closest draggable ancestor with a doc id
  const draggable = target.closest<HTMLElement>('[draggable="true"][data-drag-doc-id]');
  if (!draggable) return;

  const docId = draggable.getAttribute('data-drag-doc-id');
  if (!docId) return;

  _startX = touch.clientX;
  _startY = touch.clientY;
  _dragDocId = docId;
  _sourceEl = draggable;
  _dragConfirmed = false;

  // Start a long-press timer — drag only activates if held long enough
  // OR if the finger moves beyond the threshold
  _longPressTimer = setTimeout(() => {
    _longPressTimer = null;
  }, LONG_PRESS_DELAY);
}

function onTouchMove(e: TouchEvent): void {
  if (!_dragDocId || e.touches.length !== 1) return;

  const touch = e.touches[0];
  const dx = touch.clientX - _startX;
  const dy = touch.clientY - _startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (!_dragConfirmed) {
    // Need to move beyond threshold to confirm drag
    if (dist < MOVE_THRESHOLD) return;

    _dragConfirmed = true;
    _dragging = true;

    // Prevent scrolling once drag is confirmed
    e.preventDefault();

    markInternalDragStart();
    createGhost(_sourceEl, _dragDocId!);

    window.dispatchEvent(new CustomEvent('agora:touch-drag-start', {
      detail: { docId: _dragDocId }
    }));

    return;
  }

  // Drag is active — move ghost and check drop zones
  e.preventDefault();
  moveGhost(touch.clientX, touch.clientY);

  // Find drop zone under finger
  // Temporarily hide ghost so elementFromPoint sees through it
  if (_ghostEl) _ghostEl.style.display = 'none';
  const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
  if (_ghostEl) _ghostEl.style.display = '';

  const dropZone = elUnder?.closest<HTMLElement>('[data-drop-zone]');
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
    window.dispatchEvent(new CustomEvent('agora:touch-drag-over', {
      detail: { tileId, position }
    }));
  }
}

function onTouchEnd(e: TouchEvent): void {
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }

  if (!_dragging || !_dragDocId) {
    // Not dragging — let native click/tap through
    _dragDocId = null;
    _sourceEl = null;
    return;
  }

  // Find the final drop target
  const touch = e.changedTouches[0];
  if (_ghostEl) _ghostEl.style.display = 'none';
  const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
  if (_ghostEl) _ghostEl.style.display = '';

  const dropZone = elUnder?.closest<HTMLElement>('[data-drop-zone]');
  const tileId = dropZone?.getAttribute('data-drop-zone') ?? null;

  if (tileId && dropZone) {
    const rect = dropZone.getBoundingClientRect();
    const position = calcDropPosition(touch.clientX, touch.clientY, rect);

    window.dispatchEvent(new CustomEvent('agora:touch-drop', {
      detail: { docId: _dragDocId, tileId, position }
    }));
  }

  // Prevent the ghost tap from firing a click
  e.preventDefault();

  cleanup();
}

function onTouchCancel(_e: TouchEvent): void {
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
  cleanup();
}

// ── Ghost element ───────────────────────────────────────────────

function createGhost(sourceEl: HTMLElement | null, docId: string): void {
  _ghostEl = document.createElement('div');

  // Extract a short label from the source element
  const label = sourceEl?.querySelector('.text-xs')?.textContent
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
  _sourceEl = null;
}
