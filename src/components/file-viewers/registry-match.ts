import {
  isAudioMime,
  isBibtexDocument,
  isComicArchiveDocument,
  isDjvuDocument,
  isEpubDocument,
  isFb2Document,
  isHiResImageDocument,
  isImageMime,
  isKindleEbookDocument,
  isLatexDocument,
  isMusicNotationDocument,
  isNotebookDocument,
  isOdpDocument,
  isOdsDocument,
  isOdtDocument,
  isPdfMime,
  isPowerPointDocument,
  isRtfDocument,
  isSubtitleDocument,
  isTeiOrXmlDocument,
  isVideoMime,
  isWordDocument
} from '@/lib/document-format';

export interface ViewerMatchInput {
  docName: string;
  mimeType?: string;
}

export interface ViewerMatch {
  id: string;
  label: string;
  match: (input: ViewerMatchInput) => boolean;
}

/**
 * Lógica de selección de visor por nombre de archivo + mime type.
 * Pura, sin referencias a React: testeable y reutilizable.
 * El orden importa: primer match gana.
 */
export const VIEWER_MATCHES: ViewerMatch[] = [
  {
    id: 'pdf',
    label: 'PDF',
    match: ({ docName, mimeType }) => isPdfMime(mimeType) || docName.toLowerCase().endsWith('.pdf')
  },
  {
    id: 'docx',
    label: 'Word',
    match: ({ docName, mimeType }) => isWordDocument(docName, mimeType)
  },
  { id: 'odt', label: 'OpenDocument Text', match: ({ docName, mimeType }) => isOdtDocument(docName, mimeType) },
  { id: 'ods', label: 'OpenDocument Sheet', match: ({ docName, mimeType }) => isOdsDocument(docName, mimeType) },
  { id: 'odp', label: 'OpenDocument Presentation', match: ({ docName, mimeType }) => isOdpDocument(docName, mimeType) },
  { id: 'rtf', label: 'RTF', match: ({ docName, mimeType }) => isRtfDocument(docName, mimeType) },
  { id: 'pptx', label: 'PowerPoint', match: ({ docName, mimeType }) => isPowerPointDocument(docName, mimeType) },
  { id: 'epub', label: 'EPUB', match: ({ docName, mimeType }) => isEpubDocument(docName, mimeType) },
  { id: 'fb2', label: 'FictionBook', match: ({ docName, mimeType }) => isFb2Document(docName, mimeType) },
  { id: 'kindle', label: 'Kindle (sin preview)', match: ({ docName }) => isKindleEbookDocument(docName) },
  { id: 'djvu', label: 'DjVu (sin preview)', match: ({ docName }) => isDjvuDocument(docName) },
  { id: 'ipynb', label: 'Jupyter Notebook', match: ({ docName, mimeType }) => isNotebookDocument(docName, mimeType) },
  { id: 'latex', label: 'LaTeX', match: ({ docName }) => isLatexDocument(docName) },
  { id: 'bibtex', label: 'BibTeX', match: ({ docName }) => isBibtexDocument(docName) },
  { id: 'subtitle', label: 'Subtítulos', match: ({ docName }) => isSubtitleDocument(docName) },
  { id: 'comic', label: 'Comic / manga', match: ({ docName }) => isComicArchiveDocument(docName) },
  { id: 'music-notation', label: 'Partitura', match: ({ docName, mimeType }) => isMusicNotationDocument(docName, mimeType) },
  {
    id: 'tei-xml',
    label: 'TEI / XML',
    match: ({ docName, mimeType }) => {
      if (!isTeiOrXmlDocument(docName, mimeType)) return false;
      // MusicXML tiene precedencia.
      return !isMusicNotationDocument(docName, mimeType);
    }
  },
  { id: 'manuscript-image', label: 'Manuscrito / imagen alta resolución', match: ({ docName }) => isHiResImageDocument(docName) },
  { id: 'video', label: 'Video', match: ({ mimeType }) => isVideoMime(mimeType) },
  {
    id: 'audio',
    label: 'Audio',
    match: ({ docName, mimeType }) => isAudioMime(mimeType) || /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(docName)
  },
  {
    id: 'image',
    label: 'Imagen',
    match: ({ docName, mimeType }) => isImageMime(mimeType) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(docName)
  },
  { id: 'generic', label: 'Genérico', match: () => true }
];

export function resolveViewerId(input: ViewerMatchInput): string {
  for (const entry of VIEWER_MATCHES) {
    if (entry.match(input)) return entry.id;
  }
  return 'generic';
}
