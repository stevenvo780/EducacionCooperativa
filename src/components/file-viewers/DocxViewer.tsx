'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, FileText, AlertTriangle } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface DocxViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; html: string; messages: string[] }
  | { kind: 'error'; error: string };

export default function DocxViewer({ docName, fileUrl, onClose }: DocxViewerProps) {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!fileUrl) {
      setState({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const mammoth = await import('mammoth/mammoth.browser');
        const result = await mammoth.convertToHtml(
          { arrayBuffer: buffer },
          {
            styleMap: [
              "p[style-name='Title'] => h1.docx-title",
              "p[style-name='Subtitle'] => h2.docx-subtitle",
              "p[style-name='Heading 1'] => h1",
              "p[style-name='Heading 2'] => h2",
              "p[style-name='Heading 3'] => h3",
              "p[style-name='Heading 4'] => h4",
              "p[style-name='Quote'] => blockquote",
              "p[style-name='Intense Quote'] => blockquote.intense"
            ]
          }
        );
        if (cancelled) return;
        const messages = (result.messages ?? [])
          .filter((m: { type?: string }) => m.type === 'warning' || m.type === 'error')
          .map((m: { message?: string }) => m.message ?? '')
          .filter(Boolean);
        setState({ kind: 'ready', html: result.value, messages });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setState({ kind: 'error', error: message });
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl]);

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <EmptyState />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <LoadingState />
      ) : state.kind === 'error' ? (
        <ErrorState message={state.error} />
      ) : (
        <DocxContent html={state.html} warnings={state.messages} />
      )}
    </FileViewerShell>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
      <FileText className="h-10 w-10 text-slate-600" />
      <span className="text-sm">No se pudo cargar el documento.</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      <span className="text-sm">Convirtiendo documento...</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-300">
      <AlertTriangle className="h-10 w-10 text-amber-400" />
      <span className="text-sm">No se pudo procesar el archivo .docx</span>
      <code className="text-xs text-slate-500">{message}</code>
    </div>
  );
}

function DocxContent({ html, warnings }: { html: string; warnings: string[] }) {
  return (
    <div className="h-full overflow-auto bg-slate-950">
      {warnings.length > 0 && (
        <div className="sticky top-0 z-10 border-b border-amber-800/50 bg-amber-950/50 px-4 py-2 text-xs text-amber-200">
          <div className="font-medium">Conversión con avisos ({warnings.length})</div>
          <ul className="mt-1 list-disc pl-4 text-amber-300/80">
            {warnings.slice(0, 5).map((w, i) => <li key={i} className="truncate">{w}</li>)}
            {warnings.length > 5 && <li>... y {warnings.length - 5} más</li>}
          </ul>
        </div>
      )}
      <article
        className="docx-rendered mx-auto max-w-[820px] bg-white px-12 py-10 text-slate-900 shadow-xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        .docx-rendered { font-family: 'Times New Roman', Times, serif; line-height: 1.65; font-size: 16px; }
        .docx-rendered h1 { font-size: 1.9em; margin: 1.2em 0 0.6em; font-weight: 700; }
        .docx-rendered h2 { font-size: 1.5em; margin: 1.1em 0 0.5em; font-weight: 700; }
        .docx-rendered h3 { font-size: 1.25em; margin: 1em 0 0.4em; font-weight: 600; }
        .docx-rendered h4 { font-size: 1.1em; margin: 0.9em 0 0.3em; font-weight: 600; }
        .docx-rendered p { margin: 0.6em 0; }
        .docx-rendered blockquote { border-left: 3px solid #cbd5e1; padding-left: 1em; color: #475569; margin: 1em 0; }
        .docx-rendered blockquote.intense { border-color: #6366f1; background: #eef2ff; padding: 0.6em 1em; }
        .docx-rendered table { border-collapse: collapse; margin: 1em 0; }
        .docx-rendered table td, .docx-rendered table th { border: 1px solid #94a3b8; padding: 0.4em 0.7em; }
        .docx-rendered img { max-width: 100%; height: auto; }
        .docx-rendered ul, .docx-rendered ol { padding-left: 1.6em; margin: 0.6em 0; }
        .docx-rendered .docx-title { text-align: center; font-size: 2.2em; }
        .docx-rendered .docx-subtitle { text-align: center; color: #64748b; font-weight: 400; }
      `}</style>
    </div>
  );
}
