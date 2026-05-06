'use client';

import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import PdfViewer from '@/components/PdfViewer';
import {
  isAudioMime,
  isImageMime,
  isPdfMime,
  isVideoMime
} from '@/components/mosaic-editor/utils';

interface FilePreviewPaneProps {
  fileName: string;
  fileMime: string;
  fileUrl: string | null;
  docId?: string | null;
  onClose?: () => void;
}

export function FilePreviewPane({
  fileName,
  fileMime,
  fileUrl,
  docId,
  onClose
}: FilePreviewPaneProps) {
  const safeName = fileName || 'Archivo';
  const lowerName = safeName.toLowerCase();
  const isImage = isImageMime(fileMime) || /\.(png|jpe?g|gif|webp|svg)$/.test(lowerName);
  const isPdf = isPdfMime(fileMime) || lowerName.endsWith('.pdf');
  const isVideo = isVideoMime(fileMime);
  const isAudio = isAudioMime(fileMime);

  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
          )}
          <div className="h-4 w-px bg-slate-700" />
          <span className="truncate text-xs font-medium text-slate-400">{safeName}</span>
        </div>
        <div className="flex items-center gap-2">
          {fileUrl && (
            <>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              >
                Abrir
              </a>
              <a
                href={fileUrl}
                download
                className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-500"
              >
                Descargar
              </a>
            </>
          )}
        </div>
      </div>
      <div
        className={clsx(
          'flex-1 bg-slate-900',
          isPdf ? 'min-h-0' : 'flex items-center justify-center p-4'
        )}
      >
        {!fileUrl && <div className="text-sm text-slate-400">No se pudo cargar el archivo.</div>}
        {fileUrl && isImage && (
          <div className="relative h-full w-full">
            <Image
              src={fileUrl}
              alt={safeName}
              fill
              unoptimized
              sizes="100vw"
              className="rounded object-contain shadow"
            />
          </div>
        )}
        {fileUrl && isVideo && (
          <video src={fileUrl} controls className="max-h-full max-w-full rounded shadow" />
        )}
        {fileUrl && isAudio && <audio src={fileUrl} controls className="w-full max-w-xl" />}
        {fileUrl && isPdf && (
          <PdfViewer
            fileUrl={fileUrl}
            fileName={safeName}
            docId={docId ?? undefined}
            storageKey={docId ? `${docId}:${fileUrl}` : fileUrl}
          />
        )}
        {fileUrl && !isPdf && !isImage && !isVideo && !isAudio && (
          <iframe
            src={fileUrl}
            className="h-full min-h-[70vh] w-full rounded border border-slate-700 bg-white"
            title={safeName}
          />
        )}
      </div>
    </div>
  );
}
