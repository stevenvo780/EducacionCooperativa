'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Presentation, ExternalLink, Download } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface PowerPointViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

type ViewerStatus = 'loading' | 'office' | 'fallback';

const OFFICE_LOAD_TIMEOUT_MS = 14000;

export default function PowerPointViewer({
  docName,
  fileUrl,
  onClose
}: PowerPointViewerProps) {
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [iframeKey, setIframeKey] = useState(0);

  const officeUrl = useMemo(() => {
    if (!fileUrl) return null;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl]);

  const googleViewerUrl = useMemo(() => {
    if (!fileUrl) return null;
    return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl]);

  useEffect(() => {
    if (!officeUrl) return;
    setStatus('loading');
    const timer = window.setTimeout(() => {
      setStatus(prev => (prev === 'loading' ? 'fallback' : prev));
    }, OFFICE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [officeUrl, iframeKey]);

  if (!fileUrl || !officeUrl) {
    return (
      <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <Presentation className="h-10 w-10 text-slate-600" />
          <span className="text-sm">No se pudo cargar la presentación.</span>
        </div>
      </FileViewerShell>
    );
  }

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      <div className="relative h-full min-h-0">
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <span className="text-sm">Cargando presentación…</span>
            <span className="text-xs text-slate-500">Office Online puede tardar varios segundos.</span>
          </div>
        )}

        {status !== 'fallback' ? (
          <iframe
            key={iframeKey}
            src={officeUrl}
            title={docName}
            className="h-full w-full border-0 bg-slate-950"
            onLoad={() => setStatus(prev => (prev === 'loading' ? 'office' : prev))}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
            <Presentation className="h-12 w-12 text-slate-500" />
            <div className="space-y-1">
              <p className="text-base font-medium text-slate-200">No se pudo previsualizar la presentación</p>
              <p className="text-xs text-slate-400 max-w-md">
                Office Online no respondió a tiempo. La URL firmada puede expirar o el viewer rechaza el archivo. Abre o descarga el .pptx para verlo en PowerPoint, Keynote, LibreOffice o Google Slides.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-mandy-500 px-3 py-2 text-xs font-medium text-white hover:bg-mandy-400"
              >
                <ExternalLink className="h-4 w-4" /> Abrir directo
              </a>
              <a
                href={fileUrl}
                download={docName}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-600"
              >
                <Download className="h-4 w-4" /> Descargar
              </a>
              {googleViewerUrl && (
                <a
                  href={googleViewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  Probar Google Viewer
                </a>
              )}
              <button
                type="button"
                onClick={() => setIframeKey(k => k + 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </FileViewerShell>
  );
}
