'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Search, Sparkles } from 'lucide-react';
import { createSnippet } from '@/services/snippetApi';
import { authFetch } from '@/services/apiClient';

interface PDFViewportProxy {
  width: number;
  height: number;
}

interface PDFTextItem {
  str?: string;
}

interface PDFTextContent {
  items: PDFTextItem[];
}

interface PDFRenderTask {
  promise: Promise<void>;
  cancel?: () => void;
}

interface PDFPageProxy {
  getViewport(params: { scale: number }): PDFViewportProxy;
  getTextContent?: (params?: any) => Promise<PDFTextContent>;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewportProxy }): PDFRenderTask;
  cleanup?: () => void;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy?: () => Promise<void> | void;
}

interface PDFJSLib {
  getDocument(params: { url: string }): { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
  renderTextLayer(params: any): any;
}

declare global {
  interface Window {
    pdfjsLib?: PDFJSLib;
  }
}

interface PersistedPdfViewerState {
  top: number;
  left: number;
  zoomLevel: number;
  searchQuery: string;
  activeSearchIndex: number;
}

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
const PDF_VIEWER_STATE_PREFIX = 'agora-pdf-viewer:';
const DEFAULT_VIEWER_STATE: PersistedPdfViewerState = {
  top: 0,
  left: 0,
  zoomLevel: 1,
  searchQuery: '',
  activeSearchIndex: 0
};
const pdfViewerStateMemory = new Map<string, PersistedPdfViewerState>();
let pdfJsPromise: Promise<PDFJSLib> | null = null;

function clampZoomLevel(value: number) {
  return Math.min(5, Math.max(0.25, Number.isFinite(value) ? value : 1));
}

function normalizeViewerState(value?: Partial<PersistedPdfViewerState> | null): PersistedPdfViewerState {
  return {
    top: typeof value?.top === 'number' ? value.top : DEFAULT_VIEWER_STATE.top,
    left: typeof value?.left === 'number' ? value.left : DEFAULT_VIEWER_STATE.left,
    zoomLevel: clampZoomLevel(value?.zoomLevel ?? DEFAULT_VIEWER_STATE.zoomLevel),
    searchQuery: typeof value?.searchQuery === 'string' ? value.searchQuery : DEFAULT_VIEWER_STATE.searchQuery,
    activeSearchIndex: typeof value?.activeSearchIndex === 'number' ? value.activeSearchIndex : DEFAULT_VIEWER_STATE.activeSearchIndex
  };
}

function getStorageKey(storageKey: string) {
  return `${PDF_VIEWER_STATE_PREFIX}${storageKey}`;
}

function readViewerState(storageKey: string): PersistedPdfViewerState {
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

function saveViewerState(storageKey: string, state: PersistedPdfViewerState) {
  const normalized = normalizeViewerState(state);
  pdfViewerStateMemory.set(storageKey, normalized);
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(getStorageKey(storageKey), JSON.stringify(normalized));
  } catch {
  }
}

async function loadPdfJs(): Promise<PDFJSLib> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js requires a browser environment');
  }

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
    return window.pdfjsLib;
  }

  if (!pdfJsPromise) {
    pdfJsPromise = new Promise<PDFJSLib>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${PDFJS_CDN}/pdf.min.js"]`);
      if (existing) {
        existing.addEventListener('load', () => {
          if (!window.pdfjsLib) {
            reject(new Error('PDF.js failed to initialize'));
            return;
          }
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
          resolve(window.pdfjsLib);
        }, { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load PDF.js')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `${PDFJS_CDN}/pdf.min.js`;
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error('PDF.js failed to initialize'));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
  }

  return pdfJsPromise;
}

interface PdfViewerProps {
  fileUrl: string;
  fileName: string;
  storageKey: string;
  workspaceId?: string;
  /** Document id – used to request a fresh signed URL when the current one has expired. */
  docId?: string;
}

export default function PdfViewer({ fileUrl, fileName, storageKey, workspaceId, docId }: PdfViewerProps) {
  const initialViewerState = useMemo(() => readViewerState(storageKey), [storageKey]);
  const [zoomLevel, setZoomLevel] = useState(() => initialViewerState.zoomLevel);
  const [searchQuery, setSearchQuery] = useState(() => initialViewerState.searchQuery);
  const [activeSearchIndex, setActiveSearchIndex] = useState(() => initialViewerState.activeSearchIndex);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [isCreatingSnippet, setIsCreatingSnippet] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const textLayerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const lastKnownStateRef = useRef<PersistedPdfViewerState>(initialViewerState);
  const isRestoringRef = useRef(true);
  const dragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const lastTouchDistRef = useRef<number | null>(null);

  useEffect(() => {
    const nextState = readViewerState(storageKey);
    lastKnownStateRef.current = nextState;
    isRestoringRef.current = true;
    setZoomLevel(nextState.zoomLevel);
    setSearchQuery(nextState.searchQuery);
    setActiveSearchIndex(nextState.activeSearchIndex);
  }, [storageKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    isRestoringRef.current = true;
    setUseIframeFallback(false);
    setIsLoading(true);
    setPageCount(0);
    setPageTexts([]);
    setCurrentPage(1);
    canvasRefs.current = {};
    pageRefs.current = {};

    const loadDocument = async () => {
      const tryLoad = async (url: string) => {
        const pdfjs = await loadPdfJs();
        if (cancelled) return;
        const nextDocument = await pdfjs.getDocument({ url }).promise;
        if (cancelled) {
          await nextDocument.destroy?.();
          return;
        }

        pdfDocumentRef.current = nextDocument;
        if (nextDocument.numPages < 1) {
          setUseIframeFallback(true);
          setIsLoading(false);
          return;
        }

        setPageCount(nextDocument.numPages);
        setIsLoading(false);
      };

      try {
        await tryLoad(fileUrl);
      } catch (firstError) {
        // The signed URL may have expired — try fetching a fresh one from the API.
        if (docId && !cancelled) {
          try {
            const res = await authFetch(`/api/documents/${docId}`, { cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              if (typeof data?.url === 'string' && data.url !== fileUrl) {
                await tryLoad(data.url);
                return; // success on retry
              }
            }
          } catch { /* retry also failed – fall through */ }
        }
        console.warn('Falling back to browser PDF viewer', firstError);
        setUseIframeFallback(true);
        setIsLoading(false);
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      saveViewerState(storageKey, lastKnownStateRef.current);
      const activeDocument = pdfDocumentRef.current;
      pdfDocumentRef.current = null;
      void activeDocument?.destroy?.();
    };
  }, [fileUrl, storageKey, docId]);

  useEffect(() => {
    if (useIframeFallback || !pageCount || !pdfDocumentRef.current) return;

    let cancelled = false;
    const pdfDocument = pdfDocumentRef.current;

    const loadPageTexts = async () => {
      const nextTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        if (cancelled) return;
        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent?.();
        nextTexts[pageNumber - 1] = Array.isArray(textContent?.items)
          ? textContent.items.map((item) => item.str ?? '').join(' ')
          : '';
        page.cleanup?.();
      }
      if (!cancelled) {
        setPageTexts(nextTexts);
      }
    };

    void loadPageTexts().catch((error) => {
      if (!cancelled) {
        console.warn('Failed to extract PDF text content', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pageCount, useIframeFallback]);

  const searchMatches = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return pageTexts
      .map((text, index) => ({
        pageNumber: index + 1,
        text: text.toLowerCase()
      }))
      .filter((entry) => entry.text.includes(normalizedQuery))
      .map((entry) => entry.pageNumber);
  }, [pageTexts, searchQuery]);

  useEffect(() => {
    if (searchMatches.length === 0) {
      setActiveSearchIndex(0);
      return;
    }
    setActiveSearchIndex((current) => Math.min(current, searchMatches.length - 1));
  }, [searchMatches]);

  const saveCurrentViewerState = useCallback(() => {
    lastKnownStateRef.current = {
      ...lastKnownStateRef.current,
      zoomLevel,
      searchQuery,
      activeSearchIndex
    };
    saveViewerState(storageKey, lastKnownStateRef.current);
  }, [activeSearchIndex, searchQuery, storageKey, zoomLevel]);

  // Actualización síncrona del ref antes de cualquier cleanup (desmontaje de tile)
  useLayoutEffect(() => {
    lastKnownStateRef.current = {
      ...lastKnownStateRef.current,
      zoomLevel,
      searchQuery,
      activeSearchIndex
    };
    saveViewerState(storageKey, lastKnownStateRef.current);
  }, [activeSearchIndex, searchQuery, storageKey, zoomLevel]);

  useEffect(() => {
    if (useIframeFallback) return;
    saveCurrentViewerState();
  }, [activeSearchIndex, saveCurrentViewerState, searchQuery, useIframeFallback, zoomLevel]);

  const updateCurrentPageFromScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const anchor = container.scrollTop + Math.max(container.clientHeight * 0.3, 32);
    let nextPage = 1;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const element = pageRefs.current[pageNumber];
      if (!element) continue;

      const top = element.offsetTop;
      const bottom = top + element.offsetHeight;
      if (anchor >= top && anchor < bottom) {
        nextPage = pageNumber;
        smallestDistance = 0;
        break;
      }

      const distance = Math.abs(top - anchor);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        nextPage = pageNumber;
      }
    }

    setCurrentPage(nextPage);
  }, [pageCount]);

  useEffect(() => {
    if (useIframeFallback) return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isRestoringRef.current) return;
      updateCurrentPageFromScroll();
      lastKnownStateRef.current = {
        ...lastKnownStateRef.current,
        top: container.scrollTop,
        left: container.scrollLeft,
        zoomLevel,
        searchQuery,
        activeSearchIndex
      };
      saveViewerState(storageKey, lastKnownStateRef.current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [activeSearchIndex, searchQuery, storageKey, updateCurrentPageFromScroll, useIframeFallback, zoomLevel]);

  const scrollToPage = useCallback((pageNumber: number, behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    const element = pageRefs.current[pageNumber];
    if (!container || !element) return;

    const top = Math.max(element.offsetTop - 12, 0);
    container.scrollTo({ top, left: container.scrollLeft, behavior });
    setCurrentPage(pageNumber);
  }, []);

  useEffect(() => {
    if (useIframeFallback || !pageCount || !containerWidth || !pdfDocumentRef.current) {
      return;
    }

    let cancelled = false;
    const renderTasks: { promise: Promise<void>; cancel?: () => void }[] = [];
    const pdfDocument = pdfDocumentRef.current;

    const restoreScroll = (attempt = 0) => {
      const container = containerRef.current;
      if (!container) return;

      const saved = lastKnownStateRef.current;
      const nextTop = Math.min(saved.top, Math.max(container.scrollHeight - container.clientHeight, 0));
      const nextLeft = Math.min(saved.left, Math.max(container.scrollWidth - container.clientWidth, 0));

      container.scrollTop = nextTop;
      container.scrollLeft = nextLeft;

      if (cancelled) return;
      if (
        attempt >= 20
        || (
          Math.abs(container.scrollTop - nextTop) <= 2
          && Math.abs(container.scrollLeft - nextLeft) <= 2
        )
      ) {
        isRestoringRef.current = false;
        lastKnownStateRef.current = {
          ...lastKnownStateRef.current,
          top: container.scrollTop,
          left: container.scrollLeft,
          zoomLevel,
          searchQuery,
          activeSearchIndex
        };
        saveViewerState(storageKey, lastKnownStateRef.current);
        updateCurrentPageFromScroll();
        return;
      }

      requestAnimationFrame(() => {
        restoreScroll(attempt + 1);
      });
    };

    const renderPages = async () => {
      const targetWidth = Math.max(containerWidth - 48, 320);
      const pdfjs = await loadPdfJs();

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        if (cancelled) return;

        const canvas = canvasRefs.current[pageNumber];
        const textLayer = textLayerRefs.current[pageNumber];
        if (!canvas || !textLayer) continue;

        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = targetWidth / baseViewport.width;
        const actualScale = fitScale * zoomLevel;
        const cssViewport = page.getViewport({ scale: actualScale });
        const outputScale = window.devicePixelRatio || 1;
        const renderViewport = page.getViewport({ scale: actualScale * outputScale });

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;

        textLayer.style.width = `${cssViewport.width}px`;
        textLayer.style.height = `${cssViewport.height}px`;
        textLayer.innerHTML = '';

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas 2D context is not available');
        }

        const renderTask = page.render({ canvasContext: context, viewport: renderViewport });
        renderTasks.push(renderTask);
        await renderTask.promise;

        if (page.getTextContent) {
          const textContent = await page.getTextContent();
          if (cancelled) return;

          const textLayerTask = pdfjs.renderTextLayer({
            textContent,
            container: textLayer,
            viewport: cssViewport
          });
          renderTasks.push(textLayerTask);
          await textLayerTask.promise;
        }

        page.cleanup?.();
      }

      restoreScroll();
    };

    void renderPages().catch((error) => {
      if (!cancelled) {
        console.warn('Integrated PDF rendering failed; using iframe fallback', error);
        setUseIframeFallback(true);
      }
    });

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel?.());
    };
  }, [activeSearchIndex, containerWidth, pageCount, searchQuery, storageKey, updateCurrentPageFromScroll, useIframeFallback, zoomLevel]);

  const activeSearchPage = searchMatches[activeSearchIndex] ?? null;

  useEffect(() => {
    if (!activeSearchPage || useIframeFallback) return;
    scrollToPage(activeSearchPage, 'smooth');
  }, [activeSearchIndex, activeSearchPage, scrollToPage, useIframeFallback]);

  const handlePageInputChange = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(pageCount, Math.max(1, parsed));
    scrollToPage(clamped, 'smooth');
  }, [pageCount, scrollToPage]);

  const handleNextPage = useCallback(() => {
    scrollToPage(Math.min(pageCount, currentPage + 1), 'smooth');
  }, [currentPage, pageCount, scrollToPage]);

  const handlePrevPage = useCallback(() => {
    scrollToPage(Math.max(1, currentPage - 1), 'smooth');
  }, [currentPage, scrollToPage]);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((current) => clampZoomLevel(Number((current / 1.25).toFixed(2))));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((current) => clampZoomLevel(Number((current * 1.25).toFixed(2))));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  // Ctrl+rueda para zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container || useIframeFallback) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? 1 / 1.15 : 1.15;
      setZoomLevel((current) => clampZoomLevel(Number((current * delta).toFixed(2))));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [useIframeFallback]);

  // Atajos de teclado
  useEffect(() => {
    if (useIframeFallback) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        setZoomLevel((current) => clampZoomLevel(Number((current * 1.25).toFixed(2))));
      } else if (event.key === '-') {
        event.preventDefault();
        setZoomLevel((current) => clampZoomLevel(Number((current / 1.25).toFixed(2))));
      } else if (event.key === '0') {
        event.preventDefault();
        setZoomLevel(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [useIframeFallback]);

  // Arrastrar para mover (pan)
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    // Solo arrastrar con botón izquierdo y si hay overflow
    if (event.button !== 0) return;
    if (container.scrollWidth <= container.clientWidth && container.scrollHeight <= container.clientHeight) return;
    event.preventDefault();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    };
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    container.scrollLeft = dragStartRef.current.scrollLeft - dx;
    container.scrollTop = dragStartRef.current.scrollTop - dy;
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  // Pellizco táctil para zoom
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      lastTouchDistRef.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || lastTouchDistRef.current === null) return;
    event.preventDefault();
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / lastTouchDistRef.current;
    lastTouchDistRef.current = dist;
    setZoomLevel((current) => clampZoomLevel(Number((current * ratio).toFixed(2))));
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistRef.current = null;
  }, []);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setSelection({
        text: sel.toString(),
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 40
      });
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const handleCreateSnippetFromSelection = useCallback(async () => {
    if (!selection || !workspaceId || isCreatingSnippet) return;

    setIsCreatingSnippet(true);
    try {
      await createSnippet({
        title: `Snippet de ${fileName}`,
        description: `Extraído de ${fileName}, página ${currentPage}`,
        markdown: selection.text,
        workspaceId,
        category: 'general',
        order: 0
      });
      // Clear selection after creation
      window.getSelection()?.removeAllRanges();
      setSelection(null);
    } catch (error) {
      console.error('Error creating snippet from PDF:', error);
    } finally {
      setIsCreatingSnippet(false);
    }
  }, [selection, workspaceId, isCreatingSnippet, fileName, currentPage]);

  const handleSearchPrev = useCallback(() => {
    if (searchMatches.length === 0) return;
    setActiveSearchIndex((current) => (current - 1 + searchMatches.length) % searchMatches.length);
  }, [searchMatches.length]);

  const handleSearchNext = useCallback(() => {
    if (searchMatches.length === 0) return;
    setActiveSearchIndex((current) => (current + 1) % searchMatches.length);
  }, [searchMatches.length]);

  if (useIframeFallback) {
    return (
      <iframe
        src={fileUrl}
        className="h-full w-full rounded border border-slate-700 bg-white"
        title={fileName}
        data-testid="pdf-viewer-fallback"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-900 relative">
      <div className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-1 py-1">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Página anterior"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="flex items-center gap-2 px-2 text-xs text-slate-300">
            <span className="hidden sm:inline">Página</span>
            <input
              type="number"
              min={1}
              max={Math.max(pageCount, 1)}
              value={currentPage}
              onChange={(event) => handlePageInputChange(event.target.value)}
              className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-xs text-slate-100 outline-none focus:border-sky-500"
              aria-label="Página actual"
            />
            <span className="text-slate-500">/ {pageCount || '—'}</span>
          </label>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={pageCount === 0 || currentPage >= pageCount}
            className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Página siguiente"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-1 py-1">
          <button
            type="button"
            onClick={handleZoomOut}
            className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            title="Alejar"
            aria-label="Alejar PDF"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="min-w-[4.5rem] rounded px-2 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
            title="Ajustar al ancho"
            aria-label="Ajustar PDF al ancho"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            title="Acercar"
            aria-label="Acercar PDF"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-w-[15rem] flex-1 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (event.shiftKey) {
                  handleSearchPrev();
                } else {
                  handleSearchNext();
                }
              }
            }}
            placeholder="Buscar en PDF..."
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
            aria-label="Buscar en PDF"
          />
          <span className="text-[11px] text-slate-500">
            {searchQuery.trim()
              ? searchMatches.length > 0
                ? `${activeSearchIndex + 1}/${searchMatches.length}`
                : '0'
              : '—'}
          </span>
          <button
            type="button"
            onClick={handleSearchPrev}
            disabled={searchMatches.length === 0}
            className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Resultado anterior"
            aria-label="Resultado anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSearchNext}
            disabled={searchMatches.length === 0}
            className="rounded p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Resultado siguiente"
            aria-label="Resultado siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`h-full w-full flex-1 overflow-auto bg-slate-900 px-4 py-6 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        data-testid="pdf-viewer-scroll-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading && (
          <div className="flex min-h-full items-center justify-center text-slate-400">
            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 shadow-lg shadow-black/20">
              <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
              <span className="text-sm">Cargando PDF…</span>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="mx-auto flex w-fit flex-col gap-4">
            {Array.from({ length: pageCount }, (_, index) => {
              const pageNumber = index + 1;
              const isMatchedPage = searchMatches.includes(pageNumber);
              const isActiveMatchedPage = activeSearchPage === pageNumber;

              return (
                <div
                  key={pageNumber}
                  ref={(node) => {
                    pageRefs.current[pageNumber] = node;
                  }}
                  className={`relative overflow-hidden rounded-xl border bg-white shadow-2xl shadow-black/30 ${
                    isActiveMatchedPage
                      ? 'border-amber-400 ring-2 ring-amber-400/60'
                      : isMatchedPage
                        ? 'border-amber-500/70'
                        : 'border-slate-700/80'
                  }`}
                  data-page-number={pageNumber}
                >
                  <div className="absolute left-3 top-3 z-10 rounded-full bg-slate-950/85 px-2 py-1 text-[11px] font-medium text-slate-200 shadow">
                    Página {pageNumber}
                  </div>
                  {isActiveMatchedPage && (
                    <div className="absolute right-3 top-3 z-10 rounded-full bg-amber-500/90 px-2 py-1 text-[11px] font-semibold text-slate-950 shadow">
                      Coincidencia
                    </div>
                  )}
                  <canvas
                    ref={(node) => {
                      canvasRefs.current[pageNumber] = node;
                    }}
                    className="block"
                    data-testid="pdf-page-canvas"
                  />
                  <div
                    ref={(node) => {
                      textLayerRefs.current[pageNumber] = node;
                    }}
                    className="textLayer absolute inset-0 z-10 opacity-100 mix-blend-multiply"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Snippet Selection Menu */}
      {selection && workspaceId && (
        <div
          className="pointer-events-auto absolute z-[100] flex animate-in fade-in zoom-in duration-150"
          style={{
            left: selection.x,
            top: selection.y,
            transform: 'translateX(-50%)'
          }}
        >
          <button
            type="button"
            onClick={handleCreateSnippetFromSelection}
            disabled={isCreatingSnippet}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xl shadow-black/40 transition hover:bg-sky-500 disabled:opacity-50"
          >
            {isCreatingSnippet ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            <span>Crear Snippet</span>
          </button>
        </div>
      )}

      <style jsx global>{`
        .textLayer {
          position: absolute;
          text-align: initial;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          opacity: 0.25;
          line-height: 1;
          text-wrap: nowrap;
          white-space: pre;
        }
        .textLayer span, .textLayer br {
          color: transparent;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
        }
        .textLayer .highlight {
          margin: -1px;
          padding: 1px;
          background-color: rgb(180, 0, 170);
          border-radius: 4px;
        }
        .textLayer .highlight.selected {
          background-color: rgb(0, 100, 0);
        }
        .textLayer ::selection {
          background: rgb(0, 0, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
