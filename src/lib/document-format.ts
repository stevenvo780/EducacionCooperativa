export const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv', 'tsv']);
export const POWERPOINT_EXTENSIONS = new Set(['ppt', 'pptx']);

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

export const isSpreadsheetDocument = (name?: string, mime?: string) => (
  SPREADSHEET_EXTENSIONS.has(getFileExtension(name)) || isSpreadsheetMime(mime)
);

export const isPowerPointDocument = (name?: string, mime?: string) => (
  POWERPOINT_EXTENSIONS.has(getFileExtension(name)) || isPowerPointMime(mime)
);

export const isMarkdownDocument = (name?: string, mime?: string) => (
  isMarkdownName(name) || isMarkdownMime(mime)
);
