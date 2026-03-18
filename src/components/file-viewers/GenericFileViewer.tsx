'use client';

import React from 'react';
import { FileBox } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface GenericFileViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

export default function GenericFileViewer({
  docName,
  fileUrl,
  onClose
}: GenericFileViewerProps) {
  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <FileBox className="h-10 w-10 text-slate-600" />
          <span className="text-sm">No se pudo cargar el archivo.</span>
        </div>
      ) : (
        <iframe
          src={fileUrl}
          title={docName}
          className="h-full w-full rounded border-0 bg-white"
        />
      )}
    </FileViewerShell>
  );
}
