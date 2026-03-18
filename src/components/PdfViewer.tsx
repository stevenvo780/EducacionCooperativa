'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface PDFViewportProxy {
  width: number;
  height: number;
}

interface PDFRenderTask {
  promise: Promise<void>;
  cancel?: () => void;
}

interface PDFPageProxy {
  getViewport(params: { scale: number }): PDFViewportProxy;
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
}

declare global {
  interface Window {
    pdfjsLib?: PDFJSLib;
  }
}

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
const pdfScrollMemory = new Map<string, { top: number; left: number }>();
let pdfJsPromise: Promise<PDFJSLib> | null = null;

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

function getStorageKey(storageKey: string) {
  return `agora-pdf-scroll:${storageKey}`;
}

function readSavedScrollPosition(storageKey: string) {
  const inMemory = pdfScrollMemory.get(storageKey);
  if (inMemory) return inMemory;
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(storageKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { top?: unknown; left?: unknown };
    const next = {
      top: typeof parsed.top === 'number' ? parsed.top : 0,
      left: typeof parsed.left === 'number' ? parsed.left : 0
    };
    pdfScrollMemory.set(storageKey, next);
    return next;
  } catch {
    return null;
  }
}

function saveScrollPosition(storageKey: string, position: { top: number; left: number }) {
  pdfScrollMemory.set(storageKey, position);
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(getStorageKey(storageKey), JSON.stringify(position));
  } catch {
  }
}

interface PdfViewerProps {
  fileUrl: string;
  fileName: string;
  storageKey: string;
}

export default function PdfViewer({ fileUrl, fileName, storageKey }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const restorePositionRef = useRef<{ top: number; left: number } | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  useEffect(() => {
    restorePositionRef.current = readSavedScrollPosition(storageKey);
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
    setUseIframeFallback(false);
    setIsLoading(true);
    setPageCount(0);
    canvasRefs.current = {};

    const loadDocument = async () => {
      try {
        const pdfjs = await loadPdfJs();
        if (cancelled) return;

        const nextDocument = await pdfjs.getDocument({ url: fileUrl }).promise;
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
      } catch (error) {
        console.warn('Falling back to browser PDF viewer', error);
        setUseIframeFallback(true);
        setIsLoading(false);
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      const activeDocument = pdfDocumentRef.current;
      pdfDocumentRef.current = null;
      void activeDocument?.destroy?.();
    };
  }, [fileUrl]);

  useEffect(() => {
    if (useIframeFallback || !pageCount || !containerWidth || !pdfDocumentRef.current) {
      return;
    }

    let cancelled = false;
    const renderTasks: PDFRenderTask[] = [];
    const pdfDocument = pdfDocumentRef.current;

    const restoreScroll = () => {
      const container = containerRef.current;
      const saved = restorePositionRef.current;
      if (!container || !saved) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.scrollTo(saved.left, saved.top);
        });
      });
    };

    const renderPages = async () => {
      const targetWidth = Math.max(containerWidth - 48, 320);

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        if (cancelled) return;

        const canvas = canvasRefs.current[pageNumber];
        if (!canvas) continue;

        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / baseViewport.width;
        const cssViewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const renderViewport = page.getViewport({ scale: scale * outputScale });

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas 2D context is not available');
        }

        const renderTask = page.render({ canvasContext: context, viewport: renderViewport });
        renderTasks.push(renderTask);
        await renderTask.promise;

        page.cleanup?.();
        restoreScroll();
      }
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
  }, [containerWidth, pageCount, useIframeFallback]);

  useEffect(() => {
    if (useIframeFallback) return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      saveScrollPosition(storageKey, {
        top: container.scrollTop,
        left: container.scrollLeft
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [storageKey, useIframeFallback]);

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
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto bg-slate-900 px-4 py-6"
      data-testid="pdf-viewer-scroll-container"
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
        <div className="mx-auto flex w-fit max-w-full flex-col gap-4">
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <div
                key={pageNumber}
                className="overflow-hidden rounded-xl border border-slate-700/80 bg-white shadow-2xl shadow-black/30"
              >
                <canvas
                  ref={(node) => {
                    canvasRefs.current[pageNumber] = node;
                  }}
                  className="block max-w-full"
                  data-testid="pdf-page-canvas"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
