'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, Presentation } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface PowerPointViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

export default function PowerPointViewer({
  docName,
  fileUrl,
  onClose
}: PowerPointViewerProps) {
  const [loading, setLoading] = useState(Boolean(fileUrl));
  const embedUrl = useMemo(() => {
    if (!fileUrl) return null;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl]);

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!embedUrl ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <Presentation className="h-10 w-10 text-slate-600" />
          <span className="text-sm">No se pudo cargar la presentacion.</span>
        </div>
      ) : (
        <div className="relative h-full min-h-0">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-slate-300">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <span className="text-sm">Cargando presentacion...</span>
              <span className="text-xs text-slate-500">
                Si no abre, usa los botones de abrir o descargar.
              </span>
            </div>
          )}
          <iframe
            src={embedUrl}
            title={docName}
            className="h-full w-full border-0 bg-slate-950"
            onLoad={() => setLoading(false)}
          />
        </div>
      )}
    </FileViewerShell>
  );
}
