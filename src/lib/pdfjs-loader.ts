import { PDFJS_CDN } from '@/components/pdf-viewer/pdfStorage';

export interface PdfJsTextItem {
  str?: string;
  transform: number[];
}

export interface PdfJsTextContent {
  items: PdfJsTextItem[];
}

export interface PdfJsViewportProxy {
  width: number;
  height: number;
}

export interface PdfJsRenderTask {
  promise: Promise<void>;
  cancel?: () => void;
}

export interface PdfJsPageProxy {
  getViewport(params: { scale: number }): PdfJsViewportProxy;
  getTextContent: (params?: Record<string, unknown>) => Promise<PdfJsTextContent>;
  /** API moderna de pdf.js (v3+); preferida sobre getTextContent. */
  streamTextContent?: (params?: Record<string, unknown>) => unknown;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfJsViewportProxy }) => PdfJsRenderTask;
  cleanup?: () => void;
}

export interface PdfJsDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPageProxy>;
  destroy?: () => Promise<void> | void;
}

export interface PdfJsLib {
  getDocument(params: { url?: string; data?: ArrayBuffer }): { promise: Promise<PdfJsDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
  renderTextLayer: (params: Record<string, unknown>) => PdfJsRenderTask;
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

let pdfJsPromise: Promise<PdfJsLib> | null = null;

const resolveLoadedPdfJs = () => {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js failed to initialize');
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  return window.pdfjsLib;
};

export async function loadPdfJs(): Promise<PdfJsLib> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js requires a browser environment');
  }

  if (window.pdfjsLib) {
    return resolveLoadedPdfJs();
  }

  if (!pdfJsPromise) {
    pdfJsPromise = new Promise<PdfJsLib>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${PDFJS_CDN}/pdf.min.js"]`);
      const handleLoad = () => {
        try {
          resolve(resolveLoadedPdfJs());
        } catch (error) {
          reject(error);
        }
      };
      const handleError = () => reject(new Error('Failed to load PDF.js'));

      if (existing) {
        if (window.pdfjsLib) {
          handleLoad();
          return;
        }
        existing.addEventListener('load', handleLoad, { once: true });
        existing.addEventListener('error', handleError, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `${PDFJS_CDN}/pdf.min.js`;
      script.async = true;
      script.onload = handleLoad;
      script.onerror = handleError;
      document.head.appendChild(script);
    }).catch((error) => {
      pdfJsPromise = null;
      throw error;
    });
  }

  return pdfJsPromise;
}
