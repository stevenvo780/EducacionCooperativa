'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, FileText } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';

interface SourceTextViewerProps {
  docName: string;
  fileUrl: string | null;
  language?: 'latex' | 'bibtex' | 'plain';
  onClose?: () => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; text: string }
  | { kind: 'error'; error: string };

const MAX_BYTES = 2 * 1024 * 1024;

export default function SourceTextViewer({ docName, fileUrl, language = 'plain', onClose }: SourceTextViewerProps) {
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
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (blob.size > MAX_BYTES) {
          throw new Error(`Archivo demasiado grande (${(blob.size / 1024 / 1024).toFixed(1)} MB). Descárgalo para abrirlo.`);
        }
        const text = await blob.text();
        if (cancelled) return;
        setState({ kind: 'ready', text });
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
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <FileText className="h-10 w-10 text-slate-600" />
          <span className="text-sm">No se pudo cargar el archivo.</span>
        </div>
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-sm">Cargando...</span>
        </div>
      ) : state.kind === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-300">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <span className="text-sm">No se pudo abrir el archivo</span>
          <code className="text-xs text-slate-500">{state.error}</code>
        </div>
      ) : language === 'bibtex' ? (
        <BibtexView text={state.text} />
      ) : (
        <PlainSourceView text={state.text} language={language} />
      )}
    </FileViewerShell>
  );
}

function PlainSourceView({ text, language }: { text: string; language: string }) {
  const highlighted = useMemo(() => highlightLines(text, language), [text, language]);
  return (
    <div className="h-full overflow-auto bg-slate-950">
      <pre className="min-w-full px-6 py-4 text-xs leading-relaxed">
        <code className="font-mono text-slate-200">
          {highlighted.map((line, i) => (
            <div key={i} className="flex">
              <span className="mr-4 select-none text-right text-slate-600" style={{ minWidth: 32 }}>{i + 1}</span>
              <span className="flex-1 whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: line }} />
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

interface BibEntry {
  type: string;
  key: string;
  fields: { name: string; value: string }[];
}

function parseBibtex(text: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const type = match[1].toLowerCase();
    const key = match[2];
    const body = match[3];
    const fields: { name: string; value: string }[] = [];
    const fieldRe = /(\w+)\s*=\s*[\{"]([\s\S]*?)[\}"](?=\s*,|\s*$)/g;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(body)) !== null) {
      fields.push({ name: fm[1].toLowerCase(), value: fm[2].replace(/\s+/g, ' ').trim() });
    }
    entries.push({ type, key, fields });
  }
  return entries;
}

function BibtexView({ text }: { text: string }) {
  const entries = useMemo(() => parseBibtex(text), [text]);
  if (entries.length === 0) {
    return <PlainSourceView text={text} language="bibtex" />;
  }
  return (
    <div className="h-full overflow-auto bg-slate-950 px-6 py-6">
      <div className="mx-auto flex max-w-[920px] flex-col gap-3">
        <div className="text-xs text-slate-500">{entries.length} entradas</div>
        {entries.map((entry, i) => (
          <div key={i} className="rounded border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-emerald-300">
                {entry.type}
              </span>
              <code className="text-sm font-mono text-blue-300">{entry.key}</code>
            </div>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
              {entry.fields.map((f, j) => (
                <React.Fragment key={j}>
                  <dt className="font-mono text-slate-500">{f.name}</dt>
                  <dd className="text-slate-200">{f.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLines(text: string, language: string): string[] {
  const lines = text.split('\n');
  if (language === 'latex') {
    return lines.map((line) => {
      const escaped = escapeHtml(line);
      return escaped
        .replace(/(%.*$)/g, '<span style="color:#64748b">$1</span>')
        .replace(/(\\[a-zA-Z]+\*?)/g, '<span style="color:#60a5fa">$1</span>')
        .replace(/(\{[^{}]*\})/g, '<span style="color:#fcd34d">$1</span>')
        .replace(/(\$[^$]*\$)/g, '<span style="color:#a78bfa">$1</span>');
    });
  }
  if (language === 'bibtex') {
    return lines.map((line) => {
      const escaped = escapeHtml(line);
      return escaped
        .replace(/(@\w+)/g, '<span style="color:#34d399">$1</span>')
        .replace(/(\w+)\s*=/g, '<span style="color:#60a5fa">$1</span>=')
        .replace(/(\{[^{}]*\})/g, '<span style="color:#fcd34d">$1</span>');
    });
  }
  return lines.map(escapeHtml);
}
