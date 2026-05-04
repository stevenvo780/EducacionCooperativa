'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import GenericFileViewer from '@/components/file-viewers/GenericFileViewer';
import MediaFileViewer from '@/components/file-viewers/MediaFileViewer';
import PdfDocumentViewer from '@/components/file-viewers/PdfDocumentViewer';
import PowerPointViewer from '@/components/file-viewers/PowerPointViewer';
import {
  isAudioMime,
  isBibtexDocument,
  isEpubDocument,
  isImageMime,
  isLatexDocument,
  isNotebookDocument,
  isPdfMime,
  isPowerPointDocument,
  isVideoMime,
  isWordDocument
} from '@/lib/document-format';

const DocxViewer = dynamic(() => import('@/components/file-viewers/DocxViewer'), { ssr: false });
const EpubViewer = dynamic(() => import('@/components/file-viewers/EpubViewer'), { ssr: false });
const NotebookViewer = dynamic(() => import('@/components/file-viewers/NotebookViewer'), { ssr: false });
const SourceTextViewer = dynamic(() => import('@/components/file-viewers/SourceTextViewer'), { ssr: false });

interface FileDocumentViewerProps {
  docId: string;
  workspaceId?: string;
  docName: string;
  mimeType?: string;
  fileUrl?: string | null;
  onClose?: () => void;
}

export default function FileDocumentViewer({
  docId,
  workspaceId,
  docName,
  mimeType,
  fileUrl,
  onClose
}: FileDocumentViewerProps) {
  if (isPdfMime(mimeType) || docName.toLowerCase().endsWith('.pdf')) {
    return (
      <PdfDocumentViewer
        docId={docId}
        workspaceId={workspaceId}
        docName={docName}
        fileUrl={fileUrl ?? null}
        onClose={onClose}
      />
    );
  }

  if (isPowerPointDocument(docName, mimeType)) {
    return (
      <PowerPointViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        onClose={onClose}
      />
    );
  }

  if (isWordDocument(docName, mimeType)) {
    return (
      <DocxViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        onClose={onClose}
      />
    );
  }

  if (isEpubDocument(docName, mimeType)) {
    return (
      <EpubViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        onClose={onClose}
      />
    );
  }

  if (isNotebookDocument(docName, mimeType)) {
    return (
      <NotebookViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        onClose={onClose}
      />
    );
  }

  if (isLatexDocument(docName)) {
    return (
      <SourceTextViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        language="latex"
        onClose={onClose}
      />
    );
  }

  if (isBibtexDocument(docName)) {
    return (
      <SourceTextViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        language="bibtex"
        onClose={onClose}
      />
    );
  }

  if (isImageMime(mimeType) || /\.(png|jpe?g|gif|webp|svg)$/i.test(docName)) {
    return (
      <MediaFileViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        kind="image"
        onClose={onClose}
      />
    );
  }

  if (isVideoMime(mimeType)) {
    return (
      <MediaFileViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        kind="video"
        onClose={onClose}
      />
    );
  }

  if (isAudioMime(mimeType)) {
    return (
      <MediaFileViewer
        docName={docName}
        fileUrl={fileUrl ?? null}
        kind="audio"
        onClose={onClose}
      />
    );
  }

  return (
    <GenericFileViewer
      docName={docName}
      fileUrl={fileUrl ?? null}
      onClose={onClose}
    />
  );
}
