'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BookImage, ChevronLeft, ChevronRight } from 'lucide-react';
import type JSZip from 'jszip';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource } from '@/components/file-viewers/hooks/useFileResource';
import { useObjectUrls } from '@/components/file-viewers/hooks/useObjectUrls';
import { getFileExtension } from '@/lib/document-format';

interface ComicArchiveViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface ArchiveResource {
  zip: JSZip;
  entries: string[];
}

const IMAGE_RX = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const PREFETCH_AHEAD = 2;

export default function ComicArchiveViewer({ docName, fileUrl, onClose }: ComicArchiveViewerProps) {
  const [index, setIndex] = useState(0);
  const [pageUrls, setPageUrls] = useState<Map<number, string>>(new Map());
  const { create } = useObjectUrls();

  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }): Promise<ArchiveResource> => {
    if (getFileExtension(docName) === 'cbr') {
      throw new Error('Los archivos .cbr (RAR) no se pueden previsualizar en navegador. Convierte a .cbz (ZIP).');
    }
    const JSZipModule = (await import('jszip')).default;
    const zip = await JSZipModule.loadAsync(buffer);
    const entries = Object.keys(zip.files)
      .filter((name) => !zip.files[name]!.dir && IMAGE_RX.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    if (entries.length === 0) throw new Error('No se encontraron páginas en el archivo');
    return { zip, entries };
  }, [docName]);

  const state = useFileResource<ArchiveResource>(fileUrl, transform);

  // Reset al abrir un archivo distinto.
  useEffect(() => {
    setIndex(0);
    setPageUrls(new Map());
  }, [fileUrl]);

  const total = state.kind === 'ready' ? state.data.entries.length : 0;
  const archive = state.kind === 'ready' ? state.data : null;

  // Lazy: solo extrae las páginas necesarias (actual + prefetch).
  useEffect(() => {
    if (!archive) return;
    let cancelled = false;
    const targets = new Set<number>();
    for (let off = 0; off <= PREFETCH_AHEAD; off++) {
      if (index + off < total) targets.add(index + off);
    }

    (async () => {
      for (const i of targets) {
        if (cancelled || pageUrls.has(i)) continue;
        const name = archive.entries[i];
        if (!name) continue;
        const file = archive.zip.file(name);
        if (!file) continue;
        const blob = await file.async('blob');
        if (cancelled) return;
        const url = create(blob);
        setPageUrls((prev) => {
          if (prev.has(i)) return prev;
          const next = new Map(prev);
          next.set(i, url);
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [archive, index, total, pageUrls, create]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.kind, goNext, goPrev]);

  const actions = state.kind === 'ready' ? (
    <NavControls index={index} total={total} onPrev={goPrev} onNext={goNext} />
  ) : null;

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose} actions={actions}>
      {!fileUrl ? (
        <ViewerEmpty icon={BookImage} message="No se pudo cargar el archivo." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Abriendo archivo..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} />
      ) : (
        <PageView
          pageUrl={pageUrls.get(index) ?? null}
          name={archive?.entries[index] ?? ''}
          onPrev={goPrev}
          onNext={goNext}
          isFirst={index === 0}
          isLast={index === total - 1}
        />
      )}
    </FileViewerShell>
  );
}

function NavControls({ index, total, onPrev, onNext }: {
  index: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        disabled={index === 0}
        className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700 disabled:opacity-40"
        title="Anterior"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="font-mono text-xs text-slate-400">{index + 1} / {total}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={index === total - 1}
        className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700 disabled:opacity-40"
        title="Siguiente"
        aria-label="Página siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </>
  );
}

function PageView({ pageUrl, name, onPrev, onNext, isFirst, isLast }: {
  pageUrl: string | null;
  name: string;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="relative flex h-full items-center justify-center bg-slate-950">
      {!isFirst && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-0 top-0 z-10 flex h-full w-1/4 items-center justify-start pl-3 opacity-0 transition hover:opacity-100 md:focus:opacity-100"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-8 w-8 text-white drop-shadow" />
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-0 top-0 z-10 flex h-full w-1/4 items-center justify-end pr-3 opacity-0 transition hover:opacity-100 md:focus:opacity-100"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-8 w-8 text-white drop-shadow" />
        </button>
      )}
      {pageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- objectURL local del archivo
        <img
          src={pageUrl}
          alt={name}
          className="max-h-full max-w-full object-contain select-none"
        />
      ) : (
        <ViewerLoading label="Cargando página..." />
      )}
    </div>
  );
}

