'use client';

import React, { useCallback } from 'react';
import { FileText } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource } from '@/components/file-viewers/hooks/useFileResource';
import { sanitizeHtml } from '@/lib/safe-html';

interface DocxViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface DocxResult {
  html: string;
  warnings: string[];
}

const STYLE_MAP = [
  "p[style-name='Title'] => h1.docx-title",
  "p[style-name='Subtitle'] => h2.docx-subtitle",
  "p[style-name='Heading 1'] => h1",
  "p[style-name='Heading 2'] => h2",
  "p[style-name='Heading 3'] => h3",
  "p[style-name='Heading 4'] => h4",
  "p[style-name='Quote'] => blockquote",
  "p[style-name='Intense Quote'] => blockquote.intense"
];

export default function DocxViewer({ docName, fileUrl, onClose }: DocxViewerProps) {
  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }): Promise<DocxResult> => {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, { styleMap: STYLE_MAP });
    const warnings = (result.messages ?? [])
      .filter((m) => m.type === 'warning' || m.type === 'error')
      .map((m) => m.message ?? '')
      .filter(Boolean);
    return { html: sanitizeHtml(result.value), warnings };
  }, []);

  const state = useFileResource<DocxResult>(fileUrl, transform);

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={FileText} message="No se pudo cargar el documento." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Convirtiendo documento..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} hint="No se pudo procesar el archivo .docx" />
      ) : (
        <DocxContent html={state.data.html} warnings={state.data.warnings} />
      )}
    </FileViewerShell>
  );
}

function DocxContent({ html, warnings }: { html: string; warnings: string[] }) {
  return (
    <div className="h-full overflow-auto bg-slate-950">
      {warnings.length > 0 && <ConversionWarnings warnings={warnings} />}
      <article
        className="docx-rendered mx-auto max-w-[820px] bg-white px-12 py-10 text-slate-900 shadow-xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function ConversionWarnings({ warnings }: { warnings: string[] }) {
  const visible = warnings.slice(0, 5);
  const extra = warnings.length - visible.length;
  return (
    <div className="sticky top-0 z-10 border-b border-amber-800/50 bg-amber-950/50 px-4 py-2 text-xs text-amber-200">
      <div className="font-medium">Conversión con avisos ({warnings.length})</div>
      <ul className="mt-1 list-disc pl-4 text-amber-300/80">
        {visible.map((w, i) => <li key={i} className="truncate">{w}</li>)}
        {extra > 0 && <li>... y {extra} más</li>}
      </ul>
    </div>
  );
}
