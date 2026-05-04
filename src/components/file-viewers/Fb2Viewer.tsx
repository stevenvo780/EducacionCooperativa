'use client';

import React, { useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource, decodeText } from '@/components/file-viewers/hooks/useFileResource';
import { parseFb2, type Fb2Render } from '@/lib/parsers/fb2';
import { sanitizeHtml } from '@/lib/safe-html';

interface Fb2ViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface Fb2State {
  meta: Fb2Render['meta'] & { annotationHtml?: string };
  html: string;
}

export default function Fb2Viewer({ docName, fileUrl, onClose }: Fb2ViewerProps) {
  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }): Promise<Fb2State> => {
    const result = parseFb2(decodeText(buffer));
    return {
      meta: {
        ...result.meta,
        annotationHtml: result.meta.annotationHtml ? sanitizeHtml(result.meta.annotationHtml) : undefined
      },
      html: sanitizeHtml(result.html)
    };
  }, []);

  const state = useFileResource<Fb2State>(fileUrl, transform);

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={BookOpen} message="No se pudo cargar el libro." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Cargando FictionBook..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} />
      ) : (
        <div className="h-full overflow-auto bg-slate-950">
          <article className="fb2-rendered mx-auto max-w-[760px] px-10 py-8">
            {state.data.meta.title && <h1 className="fb2-book-title">{state.data.meta.title}</h1>}
            {state.data.meta.author && <p className="fb2-author">{state.data.meta.author}</p>}
            {state.data.meta.annotationHtml && (
              <aside className="fb2-annotation" dangerouslySetInnerHTML={{ __html: state.data.meta.annotationHtml }} />
            )}
            <div dangerouslySetInnerHTML={{ __html: state.data.html }} />
          </article>
        </div>
      )}
    </FileViewerShell>
  );
}
