'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { createSnippet } from '@/services/snippetApi';
import { authFetch } from '@/services/apiClient';
import { PdfViewerToolbar } from '@/components/pdf-viewer/PdfViewerToolbar';
import {
  type PersistedPdfViewerState,
  clampZoomLevel,
  readViewerState,
  saveViewerState
} from '@/components/pdf-viewer/pdfStorage';
import { usePdfGestures } from '@/components/pdf-viewer/usePdfGestures';
import {
  loadPdfJs,
  type PdfJsDocumentProxy as PDFDocumentProxy
} from '@/lib/pdfjs-loader';

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
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [isCreatingSnippet, setIsCreatingSnippet] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const textLayerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const lastKnownStateRef = useRef<PersistedPdfViewerState>(initialViewerState);
  const isRestoringRef = useRef(true);

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
      const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
      const results = await Promise.all(
        pageNumbers.map(async (pageNumber) => {
          const page = await pdfDocument.getPage(pageNumber);
          const textContent = await page.getTextContent?.();
          page.cleanup?.();
          return Array.isArray(textContent?.items)
            ? textContent.items.map((item) => item.str ?? '').join(' ')
            : '';
        })
      );
      if (!cancelled) {
        setPageTexts(results);
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
        left: container.scrollLeft
      };
      saveViewerState(storageKey, lastKnownStateRef.current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [storageKey, updateCurrentPageFromScroll, useIframeFallback]);

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
          left: container.scrollLeft
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
        // pdf.js v3+ requiere --scale-factor en el container del text layer
        // para alinear los spans con el canvas (si falta, console warn).
        textLayer.style.setProperty('--scale-factor', String(actualScale));
        textLayer.innerHTML = '';

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas 2D context is not available');
        }

        const renderTask = page.render({ canvasContext: context, viewport: renderViewport });
        renderTasks.push(renderTask);
        await renderTask.promise;

        if (page.streamTextContent || page.getTextContent) {
          // API nueva: textContentSource (stream). textContent quedó deprecado
          // y el warning generaba muchísimo ruido en consola.
          const textContentSource = page.streamTextContent
            ? page.streamTextContent({ includeMarkedContent: true })
            : await page.getTextContent();
          if (cancelled) return;

          const textLayerTask = pdfjs.renderTextLayer({
            textContentSource,
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
  }, [containerWidth, pageCount, storageKey, updateCurrentPageFromScroll, useIframeFallback, zoomLevel]);

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

  const _handleResetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const {
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = usePdfGestures({ containerRef, useIframeFallback, setZoomLevel });

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
      <PdfViewerToolbar
        currentPage={currentPage}
        pageCount={pageCount}
        zoomLevel={zoomLevel}
        searchQuery={searchQuery}
        searchMatchesLength={searchMatches.length}
        activeSearchIndex={activeSearchIndex}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onPageInputChange={handlePageInputChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onSearchQueryChange={setSearchQuery}
        onSearchPrev={handleSearchPrev}
        onSearchNext={handleSearchNext}
      />

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
