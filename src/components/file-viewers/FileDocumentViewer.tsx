'use client';

import React from 'react';
import GenericFileViewer from '@/components/file-viewers/GenericFileViewer';
import MediaFileViewer from '@/components/file-viewers/MediaFileViewer';
import PdfDocumentViewer from '@/components/file-viewers/PdfDocumentViewer';
import PowerPointViewer from '@/components/file-viewers/PowerPointViewer';
import {
  isAudioMime,
  isImageMime,
  isPdfMime,
  isPowerPointDocument,
  isVideoMime
} from '@/lib/document-format';

interface FileDocumentViewerProps {
  docId: string;
  docName: string;
  mimeType?: string;
  fileUrl?: string | null;
  onClose?: () => void;
}

export default function FileDocumentViewer({
  docId,
  docName,
  mimeType,
  fileUrl,
  onClose
}: FileDocumentViewerProps) {
  if (isPdfMime(mimeType) || docName.toLowerCase().endsWith('.pdf')) {
    return (
      <PdfDocumentViewer
        docId={docId}
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
