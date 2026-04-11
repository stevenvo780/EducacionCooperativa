export interface PersistedPdfViewerState {
  top: number;
  left: number;
  zoomLevel: number;
  searchQuery: string;
  activeSearchIndex: number;
}

export const PDFJS_VERSION = '3.11.174';
export const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
export const PDF_VIEWER_STATE_PREFIX = 'agora-pdf-viewer:';

export const DEFAULT_VIEWER_STATE: PersistedPdfViewerState = {
  top: 0,
  left: 0,
  zoomLevel: 1,
  searchQuery: '',
  activeSearchIndex: 0
};

export const pdfViewerStateMemory = new Map<string, PersistedPdfViewerState>();

export function clampZoomLevel(value: number) {
  return Math.min(5, Math.max(0.25, Number.isFinite(value) ? value : 1));
}

export function normalizeViewerState(value?: Partial<PersistedPdfViewerState> | null): PersistedPdfViewerState {
  return {
    top: typeof value?.top === 'number' ? value.top : DEFAULT_VIEWER_STATE.top,
    left: typeof value?.left === 'number' ? value.left : DEFAULT_VIEWER_STATE.left,
    zoomLevel: clampZoomLevel(value?.zoomLevel ?? DEFAULT_VIEWER_STATE.zoomLevel),
    searchQuery: typeof value?.searchQuery === 'string' ? value.searchQuery : DEFAULT_VIEWER_STATE.searchQuery,
    activeSearchIndex: typeof value?.activeSearchIndex === 'number' ? value.activeSearchIndex : DEFAULT_VIEWER_STATE.activeSearchIndex
  };
}

export function getStorageKey(storageKey: string) {
  return `${PDF_VIEWER_STATE_PREFIX}${storageKey}`;
}

export function readViewerState(storageKey: string): PersistedPdfViewerState {
  const inMemory = pdfViewerStateMemory.get(storageKey);
  if (inMemory) return inMemory;
  if (typeof window === 'undefined') return DEFAULT_VIEWER_STATE;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(storageKey));
    if (!raw) return DEFAULT_VIEWER_STATE;
    const parsed = normalizeViewerState(JSON.parse(raw) as Partial<PersistedPdfViewerState>);
    pdfViewerStateMemory.set(storageKey, parsed);
    return parsed;
  } catch {
    return DEFAULT_VIEWER_STATE;
  }
}

export function saveViewerState(storageKey: string, state: PersistedPdfViewerState) {
  const normalized = normalizeViewerState(state);
  pdfViewerStateMemory.set(storageKey, normalized);
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(getStorageKey(storageKey), JSON.stringify(normalized));
  } catch {
  }
}
