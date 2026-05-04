export const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv', 'tsv']);
export const POWERPOINT_EXTENSIONS = new Set(['ppt', 'pptx']);
export const WORD_EXTENSIONS = new Set(['docx', 'doc']);
export const EPUB_EXTENSIONS = new Set(['epub']);
export const NOTEBOOK_EXTENSIONS = new Set(['ipynb']);
export const LATEX_EXTENSIONS = new Set(['tex', 'latex', 'ltx', 'sty', 'cls']);
export const BIBTEX_EXTENSIONS = new Set(['bib', 'bibtex']);
export const ODT_EXTENSIONS = new Set(['odt']);
export const ODS_EXTENSIONS = new Set(['ods']);
export const ODP_EXTENSIONS = new Set(['odp']);
export const RTF_EXTENSIONS = new Set(['rtf']);
export const FB2_EXTENSIONS = new Set(['fb2']);
export const TEI_EXTENSIONS = new Set(['tei', 'xml']);
export const COMIC_ARCHIVE_EXTENSIONS = new Set(['cbz', 'cbr']);
export const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt', 'sbv']);
export const MUSIC_NOTATION_EXTENSIONS = new Set(['musicxml', 'mxl', 'mscz']);
export const KINDLE_EXTENSIONS = new Set(['mobi', 'azw', 'azw3']);
export const DJVU_EXTENSIONS = new Set(['djvu', 'djv']);
export const RIS_EXTENSIONS = new Set(['ris']);
export const HIRES_IMAGE_EXTENSIONS = new Set(['tif', 'tiff']);

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

export const isOdtMime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/vnd.oasis.opendocument.text';
export const isOdsMime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/vnd.oasis.opendocument.spreadsheet';
export const isOdpMime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/vnd.oasis.opendocument.presentation';
export const isRtfMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/rtf' || lower === 'text/rtf';
};
export const isFb2Mime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/x-fictionbook+xml';
export const isXmlMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/xml' || lower === 'text/xml';
};
export const isMusicXmlMime = (mime?: string) => {
  const lower = (mime ?? '').toLowerCase();
  return lower === 'application/vnd.recordare.musicxml+xml'
    || lower === 'application/vnd.recordare.musicxml';
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

export const isLatexDocument = (name?: string) => LATEX_EXTENSIONS.has(getFileExtension(name));
export const isBibtexDocument = (name?: string) => BIBTEX_EXTENSIONS.has(getFileExtension(name));
export const isRisDocument = (name?: string) => RIS_EXTENSIONS.has(getFileExtension(name));

export const isOdtDocument = (name?: string, mime?: string) => (
  ODT_EXTENSIONS.has(getFileExtension(name)) || isOdtMime(mime)
);
export const isOdsDocument = (name?: string, mime?: string) => (
  ODS_EXTENSIONS.has(getFileExtension(name)) || isOdsMime(mime)
);
export const isOdpDocument = (name?: string, mime?: string) => (
  ODP_EXTENSIONS.has(getFileExtension(name)) || isOdpMime(mime)
);
export const isOpenDocumentFormat = (name?: string, mime?: string) => (
  isOdtDocument(name, mime) || isOdsDocument(name, mime) || isOdpDocument(name, mime)
);

export const isRtfDocument = (name?: string, mime?: string) => (
  RTF_EXTENSIONS.has(getFileExtension(name)) || isRtfMime(mime)
);

export const isFb2Document = (name?: string, mime?: string) => (
  FB2_EXTENSIONS.has(getFileExtension(name)) || isFb2Mime(mime)
);

export const isTeiOrXmlDocument = (name?: string, mime?: string) => (
  TEI_EXTENSIONS.has(getFileExtension(name)) || isXmlMime(mime)
);

export const isComicArchiveDocument = (name?: string) => (
  COMIC_ARCHIVE_EXTENSIONS.has(getFileExtension(name))
);

export const isSubtitleDocument = (name?: string) => (
  SUBTITLE_EXTENSIONS.has(getFileExtension(name))
);

export const isMusicNotationDocument = (name?: string, mime?: string) => (
  MUSIC_NOTATION_EXTENSIONS.has(getFileExtension(name)) || isMusicXmlMime(mime)
);

export const isKindleEbookDocument = (name?: string) => (
  KINDLE_EXTENSIONS.has(getFileExtension(name))
);

export const isDjvuDocument = (name?: string) => (
  DJVU_EXTENSIONS.has(getFileExtension(name))
);

export const isHiResImageDocument = (name?: string) => (
  HIRES_IMAGE_EXTENSIONS.has(getFileExtension(name))
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
