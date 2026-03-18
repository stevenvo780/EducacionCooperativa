'use client';

import React from 'react';
import Image from 'next/image';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface MediaFileViewerProps {
  docName: string;
  fileUrl: string | null;
  kind: 'image' | 'video' | 'audio';
  onClose?: () => void;
}

export default function MediaFileViewer({
  docName,
  fileUrl,
  kind,
  onClose
}: MediaFileViewerProps) {
  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No se pudo cargar el archivo.
        </div>
      ) : (
        <div className="flex h-full items-center justify-center p-4">
          {kind === 'image' && (
            <div className="relative h-full w-full">
              <Image
                src={fileUrl}
                alt={docName}
                fill
                unoptimized
                sizes="100vw"
                className="object-contain"
              />
            </div>
          )}
          {kind === 'video' && (
            <video src={fileUrl} controls className="max-h-full max-w-full rounded shadow" />
          )}
          {kind === 'audio' && (
            <audio src={fileUrl} controls className="w-full max-w-2xl" />
          )}
        </div>
      )}
    </FileViewerShell>
  );
}
