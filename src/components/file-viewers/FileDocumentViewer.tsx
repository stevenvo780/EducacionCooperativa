'use client';

import React from 'react';
import { resolveViewer } from '@/components/file-viewers/registry';

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
  const entry = resolveViewer({ docName, mimeType });
  const Viewer = entry.Component;
  return (
    <Viewer
      docId={docId}
      workspaceId={workspaceId}
      docName={docName}
      mimeType={mimeType}
      fileUrl={fileUrl ?? null}
      onClose={onClose}
    />
  );
}
