'use client';

import React from 'react';
import PdfViewer from '@/components/PdfViewer';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface PdfDocumentViewerProps {
  docId: string;
  workspaceId?: string;
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

export default function PdfDocumentViewer({
  docId,
  workspaceId,
  docName,
  fileUrl,
  onClose
}: PdfDocumentViewerProps) {
  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {fileUrl ? (
        <PdfViewer
          fileUrl={fileUrl}
          fileName={docName}
          workspaceId={workspaceId}
          docId={docId}
          storageKey={`${docId}:${fileUrl}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No se pudo cargar el archivo.
        </div>
      )}
    </FileViewerShell>
  );
}
