/**
 * Singleton state for tracking an active touch-based drag of a document.
 * Used when the HTML5 drag-and-drop API is unavailable (e.g. iOS Safari touch).
 */

let _docId: string | null = null;
const _listeners: Array<(id: string | null) => void> = [];

export function setTouchDragDocId(id: string | null): void {
  _docId = id;
  _listeners.forEach((fn) => fn(id));
}

export function getTouchDragDocId(): string | null {
  return _docId;
}

export function subscribeTouchDragDocId(fn: (id: string | null) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}
