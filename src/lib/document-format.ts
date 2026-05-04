export const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv', 'tsv']);
export const POWERPOINT_EXTENSIONS = new Set(['ppt', 'pptx']);
export const WORD_EXTENSIONS = new Set(['docx', 'doc']);
export const EPUB_EXTENSIONS = new Set(['epub']);
export const NOTEBOOK_EXTENSIONS = new Set(['ipynb']);
export const LATEX_EXTENSIONS = new Set(['tex', 'latex', 'ltx', 'sty', 'cls']);
export const BIBTEX_EXTENSIONS = new Set(['bib', 'bibtex']);

export const getFileExtension = (name?: string) => {
  const lower = (name ?? '').toLowerCase().trim();
  const dotIndex = lower.lastIndexOf('.');
  return dotIndex >= 0 ? lower.slice(dotIndex + 1) : '';
};

export const isMarkdownName = (name?: string) => {
  const ext = getFileExtension(name);
  return ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mkd';
};

export const isMarkdownMime = (mime?: string) => (mime ?? '').toLowerCase().includes('markdown');
export const isImageMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('image/');
export const isVideoMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('video/');
export const isAudioMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('audio/');
export const isPdfMime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/pdf';

export const isSpreadsheetMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || lower === 'application/vnd.ms-excel'
    || lower === 'text/csv'
    || lower === 'text/tab-separated-values'
    || lower === 'application/csv';
};

export const isPowerPointMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/vnd.ms-powerpoint'
    || lower === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    || lower === 'application/vnd.openxmlformats-officedocument.presentationml.slideshow';
};

export const isWordMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/msword'
    || lower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
};

export const isEpubMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/epub+zip' || lower === 'application/epub';
};

export const isNotebookMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/x-ipynb+json' || lower === 'application/vnd.jupyter';
};

export const isSpreadsheetDocument = (name?: string, mime?: string) => (
  SPREADSHEET_EXTENSIONS.has(getFileExtension(name)) || isSpreadsheetMime(mime)
);

export const isPowerPointDocument = (name?: string, mime?: string) => (
  POWERPOINT_EXTENSIONS.has(getFileExtension(name)) || isPowerPointMime(mime)
);

export const isWordDocument = (name?: string, mime?: string) => (
  WORD_EXTENSIONS.has(getFileExtension(name)) || isWordMime(mime)
);

export const isEpubDocument = (name?: string, mime?: string) => (
  EPUB_EXTENSIONS.has(getFileExtension(name)) || isEpubMime(mime)
);

export const isNotebookDocument = (name?: string, mime?: string) => (
  NOTEBOOK_EXTENSIONS.has(getFileExtension(name)) || isNotebookMime(mime)
);

export const isLatexDocument = (name?: string) => (
  LATEX_EXTENSIONS.has(getFileExtension(name))
);

export const isBibtexDocument = (name?: string) => (
  BIBTEX_EXTENSIONS.has(getFileExtension(name))
);

export const isMarkdownDocument = (name?: string, mime?: string) => (
  isMarkdownName(name) || isMarkdownMime(mime)
);

export const isDotfilePlainTextName = (name?: string) => {
  const trimmed = (name ?? '').trim();
  return trimmed.startsWith('.') && trimmed.indexOf('.', 1) === -1;
};

export const isPlainTextDocument = (name?: string, mime?: string) => {
  const lowerMime = (mime ?? '').toLowerCase();
  return isDotfilePlainTextName(name)
    || lowerMime.startsWith('text/')
    || lowerMime === 'application/json'
    || lowerMime === 'application/x-json'
    || lowerMime === 'application/yaml'
    || lowerMime === 'application/x-yaml';
};
