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

type SpreadsheetSheet = unknown;

interface SpreadsheetWorkbook {
  SheetNames: string[];
  Sheets: Record<string, SpreadsheetSheet>;
}

interface SpreadsheetModule {
  read(data: ArrayBuffer, options: { type: 'array' }): SpreadsheetWorkbook;
  write(workbook: unknown, options: { type: 'array'; bookType: 'xls' | 'xlsx' }): ArrayBuffer | Uint8Array;
  utils: {
    sheet_to_json<T extends unknown[]>(sheet: SpreadsheetSheet, options: { header: 1; defval: string; blankrows: boolean }): T[];
    aoa_to_sheet(rows: string[][]): SpreadsheetSheet;
    sheet_to_csv(sheet: SpreadsheetSheet, options: { FS: string }): string;
    book_new(): unknown;
    book_append_sheet(workbook: unknown, worksheet: SpreadsheetSheet, name: string): void;
  };
}

// Dynamic import cache
let pdfjsLib: PDFJSLib | null = null;
let mammoth: typeof import('mammoth') | null = null;
let TurndownService: typeof import('turndown').default | null = null;
let xlsxLib: SpreadsheetModule | null = null;

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
 * Lazy load SheetJS from the patched CDN build.
 */
export async function loadXlsx(): Promise<SpreadsheetModule> {
  if (xlsxLib) return xlsxLib;
  xlsxLib = await import(
    /* webpackIgnore: true */
    'https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs'
  ) as SpreadsheetModule;
  return xlsxLib;
}

/**
 * Escape pipe characters for Markdown table cells
 */
function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

/**
 * Convert a 2D array of strings into a Markdown table
 */
function arrayToMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  const header = rows[0].map(escapeTableCell);
  const separator = header.map(() => '---');
  const body = rows.slice(1).map(row => row.map(escapeTableCell));

  const lines: string[] = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`)
  ];

  return lines.join('\n');
}

/**
 * Convert Excel file (.xlsx / .xls) to Markdown tables
 */
async function excelToMarkdown(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const XLSX = await loadXlsx();
  if (onProgress) onProgress(10);

  const arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(30);

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  if (onProgress) onProgress(50);

  const title = file.name.replace(/\.[^.]+$/, '');
  const parts: string[] = [`# ${title}`];
  const sheetCount = workbook.SheetNames.length;

  workbook.SheetNames.forEach((name, idx) => {
    const sheet = workbook.Sheets[name];
    const rows: string[][] = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    // Normalizar: asegurar que todas las filas tengan la misma cantidad de columnas
    const maxCols = Math.max(...rows.map(r => r.length), 0);
    const normalized = rows.map(row => {
      const padded = row.map(cell => String(cell ?? ''));
      while (padded.length < maxCols) padded.push('');
      return padded;
    });

    if (sheetCount > 1) {
      parts.push(`\n## ${name}\n`);
    } else {
      parts.push('');
    }

    if (normalized.length > 0) {
      parts.push(arrayToMarkdownTable(normalized));
    } else {
      parts.push('*Hoja vacía*');
    }

    if (onProgress) {
      onProgress(50 + Math.round(((idx + 1) / sheetCount) * 50));
    }
  });

  return parts.join('\n');
}

/**
 * Parse CSV text into a 2D array (handles quoted fields, commas, newlines)
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        current.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field);
        field = '';
        if (current.some(c => c !== '')) rows.push(current);
        current = [];
        if (ch === '\r') i++; // skip \n in \r\n
      } else if (ch === '\r') {
        current.push(field);
        field = '';
        if (current.some(c => c !== '')) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }

  // Last field/row
  current.push(field);
  if (current.some(c => c !== '')) rows.push(current);

  return rows;
}

/**
 * Auto-detect CSV delimiter (comma, semicolon, tab)
 */
export function detectDelimiter(text: string): string {
  const firstLines = text.split('\n').slice(0, 5).join('\n');
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLines) {
    if (ch in counts) counts[ch]++;
  }
  // Return the delimiter with highest count, default to comma
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Convert CSV file to Markdown table
 */
async function csvToMarkdown(file: File, onProgress?: (progress: number) => void): Promise<string> {
  if (onProgress) onProgress(20);
  const text = await file.text();
  if (onProgress) onProgress(50);

  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);

  // Normalizar columnas
  const maxCols = Math.max(...rows.map(r => r.length), 0);
  const normalized = rows.map(row => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push('');
    return padded;
  });

  const title = file.name.replace(/\.[^.]+$/, '');
  let markdown = `# ${title}\n\n`;

  if (normalized.length > 0) {
    markdown += arrayToMarkdownTable(normalized);
  } else {
    markdown += '*Archivo vacío*';
  }

  if (onProgress) onProgress(100);
  return markdown;
}

/**
 * Convert plain text file to Markdown
 */
async function textToMarkdown(file: File): Promise<string> {
  const content = await file.text();
  const title = file.name.replace(/\.[^.]+$/, '');
  return `# ${title}\n\n${content}`;
}

// ...existing code...
/**
 * Convert HTML file to Markdown using Turndown
 */
async function htmlToMarkdown(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const TurndownClass = await loadTurndown();
  if (onProgress) onProgress(30);

  const text = await file.text();
  if (onProgress) onProgress(60);

  const turndown = new TurndownClass({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });

  const markdown = turndown.turndown(text);
  if (onProgress) onProgress(100);

  const title = file.name.replace(/\.(html?|htm)$/i, '');
  return `# ${title}\n\n${markdown}`;
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
    extension === 'xlsx' ||
    extension === 'xls' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    extension === 'txt' ||
    extension === 'text' ||
    extension === 'md' ||
    extension === 'markdown' ||
    extension === 'json' ||
    extension === 'xml' ||
    extension === 'csv' ||
    extension === 'tsv' ||
    extension === 'html' ||
    extension === 'htm' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/html' ||
    mimeType === 'application/json' ||
    mimeType === 'text/xml' ||
    mimeType === 'text/csv' ||
    mimeType === 'text/tab-separated-values'
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

  try {
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      markdown = await pdfToMarkdown(file, onProgress);
    } else if (
      extension === 'docx' ||
      extension === 'doc' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      markdown = await docxToMarkdown(file, onProgress);
    } else if (extension === 'html' || extension === 'htm' || mimeType === 'text/html') {
      markdown = await htmlToMarkdown(file, onProgress);
    } else if (
      extension === 'xlsx' ||
      extension === 'xls' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      markdown = await excelToMarkdown(file, onProgress);
    } else if (
      extension === 'csv' ||
      extension === 'tsv' ||
      mimeType === 'text/csv' ||
      mimeType === 'text/tab-separated-values'
    ) {
      markdown = await csvToMarkdown(file, onProgress);
    } else if (
      extension === 'txt' ||
      extension === 'text' ||
      extension === 'md' ||
      extension === 'markdown' ||
      extension === 'json' ||
      extension === 'xml' ||
      mimeType === 'text/plain' ||
      mimeType === 'application/json' ||
      mimeType === 'text/xml'
    ) {
      const content = await file.text();
      let formattedContent = content;

      // Intentar formatear JSON si es posible
      if (extension === 'json' || mimeType === 'application/json') {
          try {
              formattedContent = JSON.stringify(JSON.parse(content), null, 2);
          } catch (e) {
              // Si falla el parseo, dejar como está
          }
      }

      const title = file.name.replace(/\.[^.]+$/, '');
      const lang = extension === 'json' ? 'json' : extension === 'xml' ? 'xml' : '';

      if (lang) {
          markdown = `# ${title}\n\n\`\`\`${lang}\n${formattedContent}\n\`\`\``;
      } else {
          markdown = `# ${title}\n\n${formattedContent}`;
      }

      if (onProgress) onProgress(100);
    } else {
      throw new Error(`Unsupported file type: ${extension || mimeType}`);
    }
  } catch (error) {
    console.error('Conversion error:', error);
    throw error;
  }

  // Generate suggested name
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const suggestedName = `${baseName}.md`;

  return { markdown, suggestedName };
}
// ...existing code...

export type ConversionProgress = {
  phase: 'loading' | 'converting' | 'done' | 'error';
  progress: number;
  error?: string;
};
