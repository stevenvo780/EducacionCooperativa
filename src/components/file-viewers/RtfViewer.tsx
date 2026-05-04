'use client';

import React, { useCallback } from 'react';
import { FileText } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource, decodeText } from '@/components/file-viewers/hooks/useFileResource';
import { rtfToHtml } from '@/lib/parsers/rtf';
import { sanitizeHtml } from '@/lib/safe-html';

interface RtfViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

export default function RtfViewer({ docName, fileUrl, onClose }: RtfViewerProps) {
  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }) => {
    return sanitizeHtml(rtfToHtml(decodeText(buffer)));
  }, []);

  const state = useFileResource<string>(fileUrl, transform, { maxBytes: 5 * 1024 * 1024 });

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={FileText} message="No se pudo cargar el documento." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Procesando RTF..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} />
      ) : (
        <div className="h-full overflow-auto bg-slate-950">
          <article
            className="rtf-rendered mx-auto max-w-[820px] bg-white px-12 py-10 text-slate-900 shadow-xl"
            dangerouslySetInnerHTML={{ __html: state.data }}
          />
        </div>
      )}
    </FileViewerShell>
  );
}
