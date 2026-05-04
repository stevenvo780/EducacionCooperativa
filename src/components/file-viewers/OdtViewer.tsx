'use client';

import React, { useCallback } from 'react';
import { FileText } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource, urlCacheKey } from '@/components/file-viewers/hooks/useFileResource';
import { renderOdfContent, type OdfVariant } from '@/lib/parsers/odf';
import { sanitizeHtml } from '@/lib/safe-html';

interface OdtViewerProps {
  docName: string;
  fileUrl: string | null;
  variant?: OdfVariant;
  onClose?: () => void;
}

interface OdtResult {
  html: string;
  warnings: string[];
}

export default function OdtViewer({ docName, fileUrl, variant = 'odt', onClose }: OdtViewerProps) {
  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }): Promise<OdtResult> => {
    const JSZipModule = (await import('jszip')).default;
    const zip = await JSZipModule.loadAsync(buffer);
    const contentFile = zip.file('content.xml');
    if (!contentFile) throw new Error('content.xml ausente');
    const xml = await contentFile.async('string');
    const result = renderOdfContent(xml, variant);
    return { html: sanitizeHtml(result.html), warnings: result.warnings };
  }, [variant]);

  const state = useFileResource<OdtResult>(fileUrl, transform, { cacheKey: urlCacheKey(`odf-${variant}`, fileUrl) });

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={FileText} message="No se pudo cargar el documento." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Procesando OpenDocument..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} hint="No se pudo procesar el archivo OpenDocument" />
      ) : (
        <div className="h-full overflow-auto bg-slate-950">
          {state.data.warnings.length > 0 && (
            <div className="sticky top-0 z-10 border-b border-amber-800/50 bg-amber-950/50 px-4 py-2 text-xs text-amber-200">
              Render parcial: {state.data.warnings.length} aviso(s). Para fidelidad completa abre con LibreOffice.
            </div>
          )}
          <article
            className="odt-rendered mx-auto max-w-[820px] bg-white px-12 py-10 text-slate-900 shadow-xl"
            dangerouslySetInnerHTML={{ __html: state.data.html }}
          />
        </div>
      )}
    </FileViewerShell>
  );
}
