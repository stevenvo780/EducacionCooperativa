/**
 * Client-side conversion of PDF/DOCX files to Markdown.
 * Runs entirely in the browser to bypass server-side size limits.
 *
 * PDF.js is loaded from CDN to avoid build issues with Next.js
 */

// PDF.js types
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getTextContent(): Promise<PDFTextContent>;
}

interface PDFTextContent {
  items: PDFTextItem[];
}

interface PDFTextItem {
  str: string;
  transform: number[];
}

interface PDFJSLib {
  getDocument(params: { data: ArrayBuffer }): { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
}

// Dynamic import cache
let pdfjsLib: PDFJSLib | null = null;
let mammoth: typeof import('mammoth') | null = null;
let TurndownService: typeof import('turndown').default | null = null;

/**
 * Load PDF.js from CDN (avoids build issues with Next.js/Terser)
 */
async function loadPdfJs(): Promise<PDFJSLib> {
  if (pdfjsLib) return pdfjsLib;

  const PDFJS_VERSION = '3.11.174';
  const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

  // Check if already loaded in global scope
  if (typeof window !== 'undefined' && (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib) {
    pdfjsLib = (window as unknown as { pdfjsLib: PDFJSLib }).pdfjsLib;
    return pdfjsLib;
  }

  // Load the library script
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });

  // Get the library from global scope
  const pdfjs = (window as unknown as { pdfjsLib: PDFJSLib }).pdfjsLib;
  if (!pdfjs) {
    throw new Error('PDF.js failed to initialize');
  }

  // Set worker source
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  pdfjsLib = pdfjs;

  return pdfjs;
}

/**
 * Lazy load Mammoth library
 */
async function loadMammoth() {
  if (mammoth) return mammoth;
  mammoth = await import('mammoth');
  return mammoth;
}

/**
 * Lazy load Turndown library
 */
async function loadTurndown() {
  if (TurndownService) return TurndownService;
  const turndownModule = await import('turndown');
  TurndownService = turndownModule.default;
  return TurndownService;
}

/**
 * Extract text from a PDF file using PDF.js
 */
async function extractPdfText(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Build text from items, preserving some structure
    let lastY: number | null = null;
    let pageText = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        const textItem = item as PDFTextItem;
        const currentY = textItem.transform[5];

        // Add newline when Y position changes significantly (new line)
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          pageText += '\n';
        } else if (lastY !== null && pageText.length > 0 && !pageText.endsWith(' ')) {
          pageText += ' ';
        }

        pageText += textItem.str;
        lastY = currentY;
      }
    }

    textParts.push(`\n\n<!-- Page ${pageNum} -->\n\n${pageText.trim()}`);

    if (onProgress) {
      onProgress(Math.round((pageNum / numPages) * 100));
    }
  }

  return textParts.join('\n');
}

/**
 * Convert PDF to Markdown (text extraction + basic formatting)
 */
async function pdfToMarkdown(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const rawText = await extractPdfText(file, onProgress);

  // Basic markdown formatting
  let markdown = rawText
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines
    .replace(/\n{4,}/g, '\n\n\n')
    // Trim lines
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();

  // Add document title from filename
  const title = file.name.replace(/\.pdf$/i, '');
  markdown = `# ${title}\n\n${markdown}`;

  return markdown;
}

/**
 * Convert DOCX to Markdown using Mammoth + Turndown
 */
async function docxToMarkdown(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const [mammothLib, TurndownClass] = await Promise.all([
    loadMammoth(),
    loadTurndown()
  ]);

  if (onProgress) onProgress(10);

  const arrayBuffer = await file.arrayBuffer();

  if (onProgress) onProgress(30);

  // Convert DOCX to HTML using Mammoth (browser mode uses arrayBuffer)
  const result = await (mammothLib as unknown as { convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> })
    .convertToHtml({ arrayBuffer });

  if (onProgress) onProgress(60);

  // Convert HTML to Markdown using Turndown
  const turndown = new TurndownClass({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });

  const markdown = turndown.turndown(result.value);

  if (onProgress) onProgress(100);

  // Add title from filename
  const title = file.name.replace(/\.(docx?|doc)$/i, '');
  return `# ${title}\n\n${markdown}`;
}

/**
 * Convert plain text file to Markdown
 */
async function textToMarkdown(file: File): Promise<string> {
  const content = await file.text();
  const title = file.name.replace(/\.[^.]+$/, '');
  return `# ${title}\n\n${content}`;
}

/**
 * Check if file can be converted to markdown
 */
export function canConvertToMarkdown(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type.toLowerCase();

  return (
    extension === 'pdf' ||
    mimeType === 'application/pdf' ||
    extension === 'docx' ||
    extension === 'doc' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    extension === 'txt' ||
    mimeType === 'text/plain'
  );
}

/**
 * Main conversion function - converts any supported file to Markdown
 */
export async function convertToMarkdown(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ markdown: string; suggestedName: string }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type.toLowerCase();

  let markdown: string;

  if (extension === 'pdf' || mimeType === 'application/pdf') {
    markdown = await pdfToMarkdown(file, onProgress);
  } else if (
    extension === 'docx' ||
    extension === 'doc' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    markdown = await docxToMarkdown(file, onProgress);
  } else if (extension === 'txt' || mimeType === 'text/plain') {
    markdown = await textToMarkdown(file);
    if (onProgress) onProgress(100);
  } else {
    throw new Error(`Unsupported file type: ${extension || mimeType}`);
  }

  // Generate suggested name
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const suggestedName = `${baseName}.md`;

  return { markdown, suggestedName };
}

export type ConversionProgress = {
  phase: 'loading' | 'converting' | 'done' | 'error';
  progress: number;
  error?: string;
};
