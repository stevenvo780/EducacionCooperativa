/**
 * Lightweight event bus for opening the global Semantic Browser tab.
 *
 * MosaicEditor (or any component) calls `semanticBrowserBus.open(docName)`
 * and the dashboard page subscribes to trigger `openSemanticBrowser()`.
 */

type Listener = (filterDocName?: string) => void;

const listeners = new Set<Listener>();

export const semanticBrowserBus = {
  /** Request opening the global Semantic Browser tab (optionally filtered to a doc). */
  open(filterDocName?: string) {
    listeners.forEach(fn => fn(filterDocName));
  },
  /** Subscribe to open requests. Returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }
};
