/**
 * Application-level flag to track internal drag operations.
 *
 * On tablets, the browser restricts access to dataTransfer.types and
 * dataTransfer.items during dragenter/dragover events for security.
 * This makes it impossible to reliably distinguish internal drags
 * (tool panels, documents, folders) from real file drags using only
 * DOM APIs. This module provides a simple flag that all internal drag
 * sources set, allowing the upload overlay logic to skip unreliable
 * browser checks entirely.
 */

let _internalDragActive = false;

/** Call from every internal dragStart handler. */
export function markInternalDragStart(): void {
  _internalDragActive = true;
}

/** Call from every internal dragEnd handler (+ global safety). */
export function markInternalDragEnd(): void {
  _internalDragActive = false;
}

/** True while an internal (non-file) drag is in progress. */
export function isInternalDragActive(): boolean {
  return _internalDragActive;
}
