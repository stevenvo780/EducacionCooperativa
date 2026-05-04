import { createElement, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { getFileExtension } from '@/lib/document-format';
import { VIEWER_MATCHES, type ViewerMatchInput } from '@/components/file-viewers/registry-match';

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

export type { ViewerMatchInput };

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

/**
 * Adapta un visualizador que recibe props extra fijos (variant, kind, etc.)
 * a la interfaz `ViewerProps` del registry. Único punto donde se rompe la
 * varianza estructural — todos los viewers son function components seguros.
 */
function adapt<E>(
  Component: ComponentType<ViewerProps & E>,
  extra: E
): ComponentType<ViewerProps> {
  const Wrapped: ComponentType<ViewerProps> = (props) => {
    const merged = { ...props, ...extra } as ViewerProps & E;
    return createElement(Component, merged);
  };
  Wrapped.displayName = `Adapted(${Component.displayName || Component.name || 'Viewer'})`;
  return Wrapped;
}

/**
 * Asocia cada `id` de match con su componente. Si añades un match nuevo en
 * `registry-match.ts`, debes registrar su componente aquí.
 */
const COMPONENTS_BY_ID: Record<string, ComponentType<ViewerProps>> = {
  pdf: PdfDocumentViewer,
  docx: DocxViewer as ComponentType<ViewerProps>,
  odt: adapt(OdtViewer as ComponentType<ViewerProps & { variant?: 'odt' | 'ods' | 'odp' }>, { variant: 'odt' as const }),
  ods: adapt(OdtViewer as ComponentType<ViewerProps & { variant?: 'odt' | 'ods' | 'odp' }>, { variant: 'ods' as const }),
  odp: adapt(OdtViewer as ComponentType<ViewerProps & { variant?: 'odt' | 'ods' | 'odp' }>, { variant: 'odp' as const }),
  rtf: RtfViewer as ComponentType<ViewerProps>,
  pptx: PowerPointViewer,
  epub: EpubViewer as ComponentType<ViewerProps>,
  fb2: Fb2Viewer as ComponentType<ViewerProps>,
  kindle: adapt(UnsupportedFormatViewer as unknown as ComponentType<ViewerProps & { reason: string }>, { reason: 'kindle' }),
  djvu: adapt(UnsupportedFormatViewer as unknown as ComponentType<ViewerProps & { reason: string }>, { reason: 'djvu' }),
  ipynb: NotebookViewer as ComponentType<ViewerProps>,
  latex: adapt(SourceTextViewer as ComponentType<ViewerProps & { language?: 'latex' | 'bibtex' | 'plain' }>, { language: 'latex' as const }),
  bibtex: adapt(SourceTextViewer as ComponentType<ViewerProps & { language?: 'latex' | 'bibtex' | 'plain' }>, { language: 'bibtex' as const }),
  subtitle: SubtitleViewer as ComponentType<ViewerProps>,
  comic: ComicArchiveViewer as ComponentType<ViewerProps>,
  'music-notation': MusicXmlViewer as ComponentType<ViewerProps>,
  'tei-xml': TeiXmlViewer as ComponentType<ViewerProps>,
  'manuscript-image': ManuscriptImageViewer as ComponentType<ViewerProps>,
  video: adapt(MediaFileViewer as unknown as ComponentType<ViewerProps & { kind: string }>, { kind: 'video' }),
  audio: AudioWaveformViewer as ComponentType<ViewerProps>,
  image: adapt(MediaFileViewer as unknown as ComponentType<ViewerProps & { kind: string }>, { kind: 'image' }),
  generic: GenericFileViewer
};

export const VIEWER_REGISTRY: ViewerEntry[] = VIEWER_MATCHES.map((entry) => ({
  ...entry,
  Component: COMPONENTS_BY_ID[entry.id] ?? GenericFileViewer
}));

export function resolveViewer(input: ViewerMatchInput): ViewerEntry {
  for (const entry of VIEWER_REGISTRY) {
    if (entry.match(input)) return entry;
  }
  return VIEWER_REGISTRY[VIEWER_REGISTRY.length - 1]!;
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
