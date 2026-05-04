import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
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
  isWordDocument,
  getFileExtension
} from '@/lib/document-format';

import GenericFileViewer from '@/components/file-viewers/GenericFileViewer';
import MediaFileViewer from '@/components/file-viewers/MediaFileViewer';
import PdfDocumentViewer from '@/components/file-viewers/PdfDocumentViewer';
import PowerPointViewer from '@/components/file-viewers/PowerPointViewer';

const DocxViewer = dynamic(() => import('@/components/file-viewers/DocxViewer'), { ssr: false });
const EpubViewer = dynamic(() => import('@/components/file-viewers/EpubViewer'), { ssr: false });
const NotebookViewer = dynamic(() => import('@/components/file-viewers/NotebookViewer'), { ssr: false });
const SourceTextViewer = dynamic(() => import('@/components/file-viewers/SourceTextViewer'), { ssr: false });
const OdtViewer = dynamic(() => import('@/components/file-viewers/OdtViewer'), { ssr: false });
const RtfViewer = dynamic(() => import('@/components/file-viewers/RtfViewer'), { ssr: false });
const Fb2Viewer = dynamic(() => import('@/components/file-viewers/Fb2Viewer'), { ssr: false });
const TeiXmlViewer = dynamic(() => import('@/components/file-viewers/TeiXmlViewer'), { ssr: false });
const ComicArchiveViewer = dynamic(() => import('@/components/file-viewers/ComicArchiveViewer'), { ssr: false });
const SubtitleViewer = dynamic(() => import('@/components/file-viewers/SubtitleViewer'), { ssr: false });
const MusicXmlViewer = dynamic(() => import('@/components/file-viewers/MusicXmlViewer'), { ssr: false });
const AudioWaveformViewer = dynamic(() => import('@/components/file-viewers/AudioWaveformViewer'), { ssr: false });
const ManuscriptImageViewer = dynamic(() => import('@/components/file-viewers/ManuscriptImageViewer'), { ssr: false });
const UnsupportedFormatViewer = dynamic(() => import('@/components/file-viewers/UnsupportedFormatViewer'), { ssr: false });

export interface ViewerMatchInput {
  docName: string;
  mimeType?: string;
}

export interface ViewerProps {
  docId: string;
  workspaceId?: string;
  docName: string;
  mimeType?: string;
  fileUrl: string | null;
  onClose?: () => void;
}

export interface ViewerEntry {
  id: string;
  label: string;
  match: (input: ViewerMatchInput) => boolean;
  Component: ComponentType<ViewerProps>;
}

function adapt<E>(
  Component: ComponentType<ViewerProps & E>,
  extra: E
): ComponentType<ViewerProps> {
  const Wrapped: ComponentType<ViewerProps> = (props) => {
    const merged = { ...props, ...extra } as ViewerProps & E;
    return <Component {...merged} />;
  };
  Wrapped.displayName = `Adapted(${Component.displayName || Component.name || 'Viewer'})`;
  return Wrapped;
}

const PdfMatch: ViewerEntry = {
  id: 'pdf',
  label: 'PDF',
  match: ({ docName, mimeType }) => isPdfMime(mimeType) || docName.toLowerCase().endsWith('.pdf'),
  Component: PdfDocumentViewer
};

const WordMatch: ViewerEntry = {
  id: 'docx',
  label: 'Word',
  match: ({ docName, mimeType }) => isWordDocument(docName, mimeType),
  Component: DocxViewer as ComponentType<ViewerProps>
};

const OdtMatch: ViewerEntry = {
  id: 'odt',
  label: 'OpenDocument Text',
  match: ({ docName, mimeType }) => isOdtDocument(docName, mimeType),
  Component: adapt(OdtViewer as ComponentType<ViewerProps & { variant?: 'odt' | 'ods' | 'odp' }>, { variant: 'odt' })
};

const OdsMatch: ViewerEntry = {
  id: 'ods',
  label: 'OpenDocument Sheet',
  match: ({ docName, mimeType }) => isOdsDocument(docName, mimeType),
  Component: adapt(OdtViewer as ComponentType<ViewerProps & { variant?: 'odt' | 'ods' | 'odp' }>, { variant: 'ods' })
};

const OdpMatch: ViewerEntry = {
  id: 'odp',
  label: 'OpenDocument Presentation',
  match: ({ docName, mimeType }) => isOdpDocument(docName, mimeType),
  Component: adapt(OdtViewer as ComponentType<ViewerProps & { variant?: 'odt' | 'ods' | 'odp' }>, { variant: 'odp' })
};

const RtfMatch: ViewerEntry = {
  id: 'rtf',
  label: 'RTF',
  match: ({ docName, mimeType }) => isRtfDocument(docName, mimeType),
  Component: RtfViewer as ComponentType<ViewerProps>
};

const PptxMatch: ViewerEntry = {
  id: 'pptx',
  label: 'PowerPoint',
  match: ({ docName, mimeType }) => isPowerPointDocument(docName, mimeType),
  Component: PowerPointViewer
};

const EpubMatch: ViewerEntry = {
  id: 'epub',
  label: 'EPUB',
  match: ({ docName, mimeType }) => isEpubDocument(docName, mimeType),
  Component: EpubViewer as ComponentType<ViewerProps>
};

const Fb2Match: ViewerEntry = {
  id: 'fb2',
  label: 'FictionBook',
  match: ({ docName, mimeType }) => isFb2Document(docName, mimeType),
  Component: Fb2Viewer as ComponentType<ViewerProps>
};

const KindleMatch: ViewerEntry = {
  id: 'kindle',
  label: 'Kindle (sin preview)',
  match: ({ docName }) => isKindleEbookDocument(docName),
  Component: adapt<{ reason: string }>(UnsupportedFormatViewer as unknown as ComponentType<ViewerProps & { reason: string }>, { reason: 'kindle' })
};

const DjvuMatch: ViewerEntry = {
  id: 'djvu',
  label: 'DjVu (sin preview)',
  match: ({ docName }) => isDjvuDocument(docName),
  Component: adapt<{ reason: string }>(UnsupportedFormatViewer as unknown as ComponentType<ViewerProps & { reason: string }>, { reason: 'djvu' })
};

const NotebookMatch: ViewerEntry = {
  id: 'ipynb',
  label: 'Jupyter Notebook',
  match: ({ docName, mimeType }) => isNotebookDocument(docName, mimeType),
  Component: NotebookViewer as ComponentType<ViewerProps>
};

const LatexMatch: ViewerEntry = {
  id: 'latex',
  label: 'LaTeX',
  match: ({ docName }) => isLatexDocument(docName),
  Component: adapt(SourceTextViewer as ComponentType<ViewerProps & { language?: 'latex' | 'bibtex' | 'plain' }>, { language: 'latex' })
};

const BibtexMatch: ViewerEntry = {
  id: 'bibtex',
  label: 'BibTeX',
  match: ({ docName }) => isBibtexDocument(docName),
  Component: adapt(SourceTextViewer as ComponentType<ViewerProps & { language?: 'latex' | 'bibtex' | 'plain' }>, { language: 'bibtex' })
};

const SubtitleMatch: ViewerEntry = {
  id: 'subtitle',
  label: 'Subtítulos',
  match: ({ docName }) => isSubtitleDocument(docName),
  Component: SubtitleViewer as ComponentType<ViewerProps>
};

const ComicMatch: ViewerEntry = {
  id: 'comic',
  label: 'Comic / manga',
  match: ({ docName }) => isComicArchiveDocument(docName),
  Component: ComicArchiveViewer as ComponentType<ViewerProps>
};

const MusicMatch: ViewerEntry = {
  id: 'music-notation',
  label: 'Partitura',
  match: ({ docName, mimeType }) => isMusicNotationDocument(docName, mimeType),
  Component: MusicXmlViewer as ComponentType<ViewerProps>
};

const TeiMatch: ViewerEntry = {
  id: 'tei-xml',
  label: 'TEI / XML',
  match: ({ docName, mimeType }) => {
    if (!isTeiOrXmlDocument(docName, mimeType)) return false;
    // El XML de MusicXML/MEI debe usar el viewer musical, no el de TEI.
    if (isMusicNotationDocument(docName, mimeType)) return false;
    return true;
  },
  Component: TeiXmlViewer as ComponentType<ViewerProps>
};

const HiResImageMatch: ViewerEntry = {
  id: 'manuscript-image',
  label: 'Imagen alta resolución / manuscrito',
  match: ({ docName, mimeType }) => {
    if (isHiResImageDocument(docName)) return true;
    if (!isImageMime(mimeType) && !/\.(png|jpe?g|webp|gif|svg)$/i.test(docName)) return false;
    // Defer normal images to MediaFileViewer (galería simple). Manuscritos usan zoom/pan.
    return false;
  },
  Component: ManuscriptImageViewer as ComponentType<ViewerProps>
};

const ImageMatch: ViewerEntry = {
  id: 'image',
  label: 'Imagen',
  match: ({ docName, mimeType }) => isImageMime(mimeType) || /\.(png|jpe?g|gif|webp|svg)$/i.test(docName),
  Component: adapt<{ kind: string }>(MediaFileViewer as unknown as ComponentType<ViewerProps & { kind: string }>, { kind: 'image' })
};

const VideoMatch: ViewerEntry = {
  id: 'video',
  label: 'Video',
  match: ({ mimeType }) => isVideoMime(mimeType),
  Component: adapt<{ kind: string }>(MediaFileViewer as unknown as ComponentType<ViewerProps & { kind: string }>, { kind: 'video' })
};

const AudioMatch: ViewerEntry = {
  id: 'audio',
  label: 'Audio',
  match: ({ docName, mimeType }) => {
    if (isAudioMime(mimeType)) return true;
    return /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(docName);
  },
  Component: AudioWaveformViewer as ComponentType<ViewerProps>
};

const GenericMatch: ViewerEntry = {
  id: 'generic',
  label: 'Genérico',
  match: () => true,
  Component: GenericFileViewer
};

export const VIEWER_REGISTRY: ViewerEntry[] = [
  PdfMatch,
  WordMatch,
  OdtMatch,
  OdsMatch,
  OdpMatch,
  RtfMatch,
  PptxMatch,
  EpubMatch,
  Fb2Match,
  KindleMatch,
  DjvuMatch,
  NotebookMatch,
  LatexMatch,
  BibtexMatch,
  SubtitleMatch,
  ComicMatch,
  MusicMatch,
  TeiMatch,
  HiResImageMatch,
  VideoMatch,
  AudioMatch,
  ImageMatch,
  GenericMatch
];

export function resolveViewer(input: ViewerMatchInput): ViewerEntry {
  for (const entry of VIEWER_REGISTRY) {
    if (entry.match(input)) return entry;
  }
  return GenericMatch;
}

export function getSupportedExtensions(): string[] {
  return Array.from(new Set([
    'pdf', 'docx', 'doc', 'odt', 'ods', 'odp', 'rtf', 'ppt', 'pptx',
    'epub', 'fb2', 'mobi', 'azw', 'azw3', 'djvu', 'djv',
    'ipynb', 'tex', 'latex', 'ltx', 'sty', 'cls', 'bib', 'bibtex',
    'srt', 'vtt', 'sbv',
    'cbz', 'cbr',
    'musicxml', 'mxl', 'mscz',
    'tei', 'xml',
    'tif', 'tiff',
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif',
    'mp4', 'webm', 'mov', 'mkv',
    'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus',
    'csv', 'tsv', 'xls', 'xlsx',
    'md', 'markdown'
  ]));
}

export { getFileExtension };
